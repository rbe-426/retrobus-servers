// Calcul d'itinéraires bus sur le réseau routier (Valhalla/OSM, profil "bus").
// Le profil bus autorise les voies de transport urbain et respecte les sens uniques ;
// un second calcul "poids lourd" sert de contrôle (tonnage, gabarit).
const VALHALLA_URL = (process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de').replace(/\/$/, '');
const OSRM_URL = 'https://router.project-osrm.org';

const FAR_FROM_ROAD_M = 40;
const DETOUR_MIN_S = 240;
const REORDER_MIN_GAIN_S = 120;
const REORDER_MIN_GAIN_RATIO = 0.05;
const HEAVY_CONFLICT_MIN_M = 120;
const MAX_MATRIX_POINTS = 40;

const cache = new Map();

export const vehicleKey = (vehicle) => [vehicle?.heightM, vehicle?.widthM, vehicle?.lengthM, vehicle?.weightT].map((value) => Number(value) || 0).join('|');

export const decodePolyline6 = (encoded) => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const readValue = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += readValue();
    lng += readValue();
    points.push([lat / 1e6, lng / 1e6]);
  }
  return points;
};

const distanceMeters = (a, b) => {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Distance d'un point à un segment, en mètres (projection locale équirectangulaire)
const pointToSegmentMeters = (p, a, b) => {
  const kLat = 111320;
  const kLng = 111320 * Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * kLng;
  const py = p[0] * kLat;
  const ax = a[1] * kLng;
  const ay = a[0] * kLat;
  const bx = b[1] * kLng;
  const by = b[0] * kLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const costingOptions = (costing, vehicle = {}) => {
  const options = {};
  if (Number(vehicle.heightM) > 0) options.height = Number(vehicle.heightM);
  if (Number(vehicle.widthM) > 0) options.width = Number(vehicle.widthM);
  if (costing === 'truck') {
    if (Number(vehicle.lengthM) > 0) options.length = Number(vehicle.lengthM);
    options.weight = Number(vehicle.weightT) > 0 ? Number(vehicle.weightT) : 12;
  }
  return { [costing]: options };
};

const postValhalla = async (path, body, signal) => {
  const key = `${path}${JSON.stringify(body)}`;
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(`${VALHALLA_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Erreur ${response.status}`);
    error.status = response.status;
    error.routing = true; // refus du moteur (pas de chemin, point inaccessible) ≠ panne réseau
    throw error;
  }
  cache.set(key, data);
  return data;
};

const toLocation = (point) => ({ lat: point.lat, lon: point.lng, type: 'break' });

const valhallaRoute = async (points, costing, vehicle, signal) => {
  const data = await postValhalla('/route', {
    locations: points.map(toLocation),
    costing,
    costing_options: costingOptions(costing, vehicle),
    directions_type: 'none',
  }, signal);
  return data.trip.legs.map((leg) => ({
    coords: decodePolyline6(leg.shape),
    timeS: leg.summary.time,
    km: leg.summary.length,
  }));
};

const osrmRoute = async (points, signal) => {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const response = await fetch(`${OSRM_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!response.ok) throw new Error('OSRM indisponible');
  const route = (await response.json()).routes?.[0];
  if (!route) throw new Error('OSRM sans résultat');
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    timeS: route.duration,
    km: route.distance / 1000,
  };
};

const straightLeg = (from, to) => ({ coords: [[from.lat, from.lng], [to.lat, to.lng]], timeS: 0, km: distanceMeters([from.lat, from.lng], [to.lat, to.lng]) / 1000, failed: true });

const summarize = (engine, legs, extra = {}) => ({
  engine,
  legs,
  coords: legs.flatMap((leg) => leg.coords),
  totalKm: legs.reduce((sum, leg) => sum + (leg.km || 0), 0),
  totalTimeS: legs.reduce((sum, leg) => sum + (leg.timeS || 0), 0),
  failedLegs: legs.map((leg, index) => (leg.failed ? index : -1)).filter((index) => index >= 0),
  ...extra,
});

const isNetworkFailure = (error) => error?.name !== 'AbortError' && !error?.routing;

// Tronçons du tracé bus qui s'écartent du tracé "poids lourd" (voie réservée bus, tonnage, gabarit)
const findHeavyConflicts = (busCoords, truckCoords) => {
  if (busCoords.length < 2 || truckCoords.length < 2) return [];
  const conflicts = [];
  let current = null;
  const close = () => {
    if (current && current.lengthM >= HEAVY_CONFLICT_MIN_M) conflicts.push(current);
    current = null;
  };
  for (let i = 0; i < busCoords.length; i += 1) {
    const point = busCoords[i];
    let minDistance = Infinity;
    for (let j = 0; j < truckCoords.length - 1 && minDistance > 25; j += 1) {
      minDistance = Math.min(minDistance, pointToSegmentMeters(point, truckCoords[j], truckCoords[j + 1]));
    }
    if (minDistance > 25) {
      if (!current) current = { coords: [], lengthM: 0 };
      if (current.coords.length) current.lengthM += distanceMeters(current.coords[current.coords.length - 1], point);
      current.coords.push(point);
    } else {
      close();
    }
  }
  close();
  return conflicts;
};

export async function computeBusRoute(points, vehicle = {}, signal) {
  if (points.length < 2) return summarize('none', []);

  try {
    const legs = await valhallaRoute(points, 'bus', vehicle, signal);
    const result = summarize('bus', legs, { heavyConflicts: [] });
    try {
      const truckLegs = await valhallaRoute(points, 'truck', vehicle, signal);
      result.heavyConflicts = findHeavyConflicts(result.coords, truckLegs.flatMap((leg) => leg.coords));
      result.heavyChecked = true;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      result.heavyChecked = false;
    }
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (isNetworkFailure(error)) {
      try {
        const route = await osrmRoute(points, signal);
        return summarize('car', [route], { heavyConflicts: [] });
      } catch (osrmError) {
        if (osrmError?.name === 'AbortError') throw osrmError;
        return summarize('straight', points.slice(1).map((point, index) => straightLeg(points[index], point)));
      }
    }
  }

  // Le moteur refuse le trajet complet : on isole les tronçons impossibles en bus
  const legs = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    try {
      const [leg] = await valhallaRoute([points[index], points[index + 1]], 'bus', vehicle, signal);
      legs.push(leg);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      legs.push(straightLeg(points[index], points[index + 1]));
    }
  }
  return summarize('bus', legs, { heavyConflicts: [], heavyChecked: false });
}

const pathCost = (matrix, order) => {
  let total = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    const value = matrix[order[i]]?.[order[i + 1]];
    if (value == null) return Infinity;
    total += value;
  }
  return total;
};

// Améliore l'ordre des arrêts intermédiaires (premier et dernier points fixes) : 2-opt + déplacement d'un arrêt
const optimizeOrder = (matrix, size) => {
  let best = Array.from({ length: size }, (_, index) => index);
  let bestCost = pathCost(matrix, best);
  if (!Number.isFinite(bestCost) || size < 4) return { order: best, cost: bestCost };
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < size - 1 && !improved; i += 1) {
      for (let j = i + 1; j < size - 1 && !improved; j += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const cost = pathCost(matrix, candidate);
        if (cost < bestCost - 1) { best = candidate; bestCost = cost; improved = true; }
      }
    }
    for (let i = 1; i < size - 1 && !improved; i += 1) {
      const without = best.filter((_, index) => index !== i);
      for (let j = 1; j < size - 1 && !improved; j += 1) {
        if (j === i) continue;
        const candidate = [...without.slice(0, j), best[i], ...without.slice(j)];
        const cost = pathCost(matrix, candidate);
        if (cost < bestCost - 1) { best = candidate; bestCost = cost; improved = true; }
      }
    }
  }
  return { order: best, cost: bestCost };
};

const stopName = (point, index) => `« ${String(point.label || point.name || `Étape ${index + 1}`).split(',')[0]} »`;

export async function analyzeStops(points, vehicle = {}, signal) {
  if (points.length < 2) return [];
  if (points.length > MAX_MATRIX_POINTS) {
    return [{ id: 'too-many', type: 'info', severity: 'info', stopIndexes: [], message: `Analyse limitée à ${MAX_MATRIX_POINTS} arrêts.` }];
  }
  const locations = points.map((point) => ({ lat: point.lat, lon: point.lng }));
  const data = await postValhalla('/sources_to_targets', {
    sources: locations,
    targets: locations,
    costing: 'bus',
    costing_options: costingOptions('bus', vehicle),
  }, signal);
  const cells = data.sources_to_targets;
  const time = cells.map((row) => row.map((cell) => (cell.time == null ? null : cell.time)));
  const suggestions = [];

  points.forEach((point, index) => {
    const others = points.map((_, other) => other).filter((other) => other !== index);
    const reachable = others.some((other) => time[index][other] != null || time[other][index] != null);
    if (!reachable) {
      suggestions.push({ id: `inaccessible-${index}`, type: 'inaccessible', severity: 'error', stopIndexes: [index], message: `${stopName(point, index)} est inaccessible en bus (voie interdite, sens unique ou impasse). Déplacez-le sur une voie ouverte aux bus.` });
      return;
    }
    const fromCell = cells[index].find((cell) => cell.begin_lat != null);
    const toCell = cells.map((row) => row[index]).find((cell) => cell?.end_lat != null);
    const snap = fromCell ? [fromCell.begin_lat, fromCell.begin_lon] : toCell ? [toCell.end_lat, toCell.end_lon] : null;
    if (snap) {
      const gap = distanceMeters([point.lat, point.lng], snap);
      if (gap > FAR_FROM_ROAD_M) {
        suggestions.push({ id: `far-${index}`, type: 'farFromRoad', severity: 'warning', stopIndexes: [index], message: `${stopName(point, index)} est à ${Math.round(gap)} m de la voie praticable en bus la plus proche.`, action: { type: 'snap', index, lat: snap[0], lng: snap[1], label: 'Placer sur la voie' } });
      }
    }
  });

  for (let i = 0; i < points.length - 1; i += 1) {
    if (time[i][i + 1] == null && !suggestions.some((item) => item.stopIndexes.includes(i) || item.stopIndexes.includes(i + 1))) {
      suggestions.push({ id: `nopath-${i}`, type: 'noPath', severity: 'error', stopIndexes: [i, i + 1], message: `Aucun trajet possible en bus de ${stopName(points[i], i)} vers ${stopName(points[i + 1], i + 1)} (sens interdits ou restrictions).` });
    }
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    const before = time[i - 1][i];
    const after = time[i][i + 1];
    const direct = time[i - 1][i + 1];
    if (before == null || after == null || direct == null) continue;
    const extra = before + after - direct;
    if (extra >= DETOUR_MIN_S) {
      suggestions.push({ id: `detour-${i}`, type: 'detour', severity: 'warning', stopIndexes: [i], message: `${stopName(points[i], i)} rallonge le trajet d'environ ${Math.round(extra / 60)} min. Vérifiez son emplacement ou sa nécessité.`, action: { type: 'remove', index: i, label: 'Retirer cet arrêt' } });
    }
  }

  const current = pathCost(time, points.map((_, index) => index));
  if (Number.isFinite(current)) {
    const { order, cost } = optimizeOrder(time, points.length);
    const gain = current - cost;
    if (gain >= REORDER_MIN_GAIN_S && gain / current >= REORDER_MIN_GAIN_RATIO) {
      suggestions.push({ id: 'reorder', type: 'reorder', severity: 'info', stopIndexes: [], message: `Un autre ordre des arrêts intermédiaires ferait gagner environ ${Math.round(gain / 60)} min (de ${Math.round(current / 60)} à ${Math.round(cost / 60)} min). L'ordre actuel est conservé tant que vous ne l'appliquez pas.`, action: { type: 'reorder', order, label: 'Appliquer le nouvel ordre' } });
    }
  }

  return suggestions;
}

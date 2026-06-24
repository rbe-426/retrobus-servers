import { Router } from 'express';

const router = Router();

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifie' });
  next();
};

const decodeEntities = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const cleanText = (html = '') => decodeEntities(String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<br\s*\/?>(\s*)/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

const extractRows = (html) => {
  const rows = [];
  const trMatches = String(html).match(/<tr[\s\S]*?<\/tr>/gi) || [];

  trMatches.forEach((rowHtml) => {
    const cells = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let match;
    while ((match = cellRegex.exec(rowHtml))) {
      const text = cleanText(match[1]);
      if (text) cells.push(text);
    }
    if (cells.length >= 2) rows.push([cells[0], cells.slice(1).join(' ')]);
  });

  return rows;
};

const pickRows = (rows) => {
  const entries = {};
  rows.forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!entries[normalizedKey]) entries[normalizedKey] = value;
  });
  const get = (...keys) => keys.map((key) => entries[key.toLowerCase()]).find(Boolean) || '';

  return {
    fleetNumber: get('Numéro', 'N°'),
    manufacturer: get('Constructeur'),
    model: get('Modèle', 'Modele'),
    registration: get('Immatriculation'),
    firstRegistration: get('Mise en circulation'),
    vin: get('Numéro de série', 'Numero de serie'),
    length: get('Longueur'),
    capacity: get('Nombre de places'),
    status: get('Statut'),
    energy: get('Énergie', 'Energie'),
    euroNorm: get('Norme Euro'),
    engine: get('Moteur'),
    gearbox: get('Boîte de vitesses', 'Boite de vitesses'),
    doors: get('Nombre de portes'),
    livery: get('Livrée', 'Livree'),
    destinationSign: get('Girouette'),
    airConditioning: get('Climatisation')
  };
};

const extractTitle = (html) => {
  const heading = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || String(html).match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return heading ? cleanText(heading[1]).replace(/\s+-\s+TC Infos.*$/i, '') : '';
};

const validateTcInfosUrl = (rawUrl) => {
  const parsed = new URL(String(rawUrl || '').trim());
  const host = parsed.hostname.toLowerCase();

  if (!['tc-infos.fr', 'www.tc-infos.fr'].includes(host)) {
    throw new Error('Le lien doit pointer vers tc-infos.fr');
  }

  if (!/^\/vehicule\/\d+\/?$/.test(parsed.pathname)) {
    throw new Error('Le lien doit cibler une fiche véhicule TC Infos');
  }

  parsed.hash = '';
  return parsed;
};

router.post('/tc-infos/identify', requireAuth, async (req, res) => {
  try {
    const target = validateTcInfosUrl(req.body?.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(target.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'RetroBus-Process-PARC/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `TC Infos a repondu ${response.status}` });
    }

    const html = await response.text();
    const rows = extractRows(html);
    const vehicle = pickRows(rows);
    const title = extractTitle(html) || [vehicle.manufacturer, vehicle.model, vehicle.fleetNumber ? `n°${vehicle.fleetNumber}` : ''].filter(Boolean).join(' ');

    return res.json({
      ok: true,
      source: 'tc-infos',
      sourceUrl: target.toString(),
      tcInfosId: target.pathname.split('/').filter(Boolean).pop(),
      title,
      vehicle,
      detectedFields: Object.entries(vehicle).filter(([, value]) => Boolean(value)).length
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message || 'Lien TC Infos invalide' });
  }
});

export default router;
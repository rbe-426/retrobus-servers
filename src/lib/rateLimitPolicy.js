// Requêtes qui ne doivent pas consommer le quota global (100 requêtes / 15 min / IP) :
// - le logiciel embarqué Inéo RétroBus (UC), qui interroge l'API toutes les 15 à 60 s depuis le même réseau que les utilisateurs
//   (il a ses propres limiteurs, voir server.js) ;
// - l'interrogation régulière de l'état du véhicule pilote par un utilisateur authentifié.
const DESKTOP_PREFIX = '/api/ineo-rbe-desktop/';
const AUTHENTICATED_POLLING_PATHS = new Set(['/api/ineo/pilot', '/ineo/pilot']);

export function isGeneralLimiterExempt(req) {
  const path = String(req?.path || '');
  if (path.startsWith(DESKTOP_PREFIX)) return true;
  return req?.method === 'GET' && AUTHENTICATED_POLLING_PATHS.has(path) && Boolean(req?.headers?.authorization);
}

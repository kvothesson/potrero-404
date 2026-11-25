// Métricas sin cookies ni nada que identifique: el navegador avisa eventos sueltos y el servidor
// solo suma contadores por día (ver server/metricas.js). Para saber si alguien vuelve, este
// navegador recuerda la fecha de su primera visita; esa fecha no sale de acá, solo "vuelve a los N días".
import { urlApi } from './red.js';
import { IDIOMA } from './idioma.js';
import { esTactil } from './tactil.js';

// No se cuenta al equipo: tu jugador (Kvothesson) ni los navegadores marcados desde la página de métricas.
const EQUIPO = ['v7trgxvw'];
function esDelEquipo() {
  try {
    if (localStorage.getItem('potrero404.equipo') === '1') return true;
    const yo = JSON.parse(localStorage.getItem('potrero404.yo') || 'null');
    return !!(yo && EQUIPO.includes(yo.id));
  } catch { return false; }
}
// De dónde viene: si el juego está dentro de otra página, el sitio que lo muestra.
function origen() {
  // ?de=yt (o cualquier marca corta) en el link: para saber de qué video o página llegó la gente
  const de = (new URLSearchParams(location.search).get('de') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
  if (de) return 'de-' + de;
  let ref = '';
  try { ref = window.top !== window.self ? document.referrer : ''; } catch { ref = document.referrer; }
  if (!ref) return 'directo';
  if (/itch\.(io|zone)/.test(ref)) return 'itch';
  if (/gamejolt\.(com|net)/.test(ref)) return 'gamejolt';
  if (/newgrounds\.com|ungrounded\.net/.test(ref)) return 'newgrounds';
  return 'otro';
}

export function evento(e) {
  if (esDelEquipo()) return;
  try {
    fetch(`${urlApi()}/evento`, { method: 'POST', body: JSON.stringify(e), keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch { /* sin red */ }
}

export function visita() {
  const hoy = new Date().toISOString().slice(0, 10);
  let primera = null, ultima = null;
  try { primera = localStorage.getItem('potrero404.primera'); ultima = localStorage.getItem('potrero404.ultima'); } catch { /* sin almacenamiento */ }
  let vuelta;
  if (!primera) vuelta = 'nuevo';
  else if (ultima === hoy) vuelta = 'hoy';
  else {
    const dias = Math.round((Date.parse(hoy) - Date.parse(primera)) / 86400000);
    vuelta = dias <= 1 ? '1' : dias <= 7 ? '2a7' : dias <= 30 ? '8a30' : 'mas30';
  }
  try { if (!primera) localStorage.setItem('potrero404.primera', hoy); localStorage.setItem('potrero404.ultima', hoy); } catch { /* sin almacenamiento */ }
  evento({ t: 'visita', vuelta, disp: esTactil() ? 'celu' : 'compu', idioma: IDIOMA });
  if (vuelta === 'nuevo') evento({ t: 'origen', de: origen() });
}

export const duracion = (ms) => (ms < 60000 ? 'menos1' : ms < 180000 ? '1a3' : ms < 360000 ? '3a6' : 'mas6');

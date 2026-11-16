// Pide a Cloudflare Turnstile una prueba de que no sos un bot, para pedir un código por mail.
// Devuelve el token, o '' en la PC (ahí el servidor local no lo pide).
import { TURNSTILE_SITE_KEY } from './cuentas-config.js';

const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
let cargando = null;
function cargar() {
  if (!cargando) cargando = new Promise((ok, mal) => {
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    sc.async = true; sc.onload = () => ok(window.turnstile); sc.onerror = mal;
    document.head.appendChild(sc);
  });
  return cargando;
}

// lugar: el elemento donde aparece la casilla "no soy un robot" si Cloudflare tiene dudas
// (casi siempre no aparece nada y pasa solo).
export async function pruebaHumano(lugar) {
  if (local || !TURNSTILE_SITE_KEY) return '';
  const ts = await cargar().catch(() => null);
  if (!ts) return '';
  return new Promise((ok) => {
    const caja = document.createElement('div');
    (lugar || document.body).appendChild(caja);
    let listo = false;
    const fin = (t) => { if (listo) return; listo = true; try { ts.remove(id); } catch { /* ya no está */ } caja.remove(); ok(t || ''); };
    const id = ts.render(caja, {
      sitekey: TURNSTILE_SITE_KEY, appearance: 'interaction-only', size: 'flexible',
      language: ({ pt: 'pt-br' })[document.documentElement.lang] || document.documentElement.lang || 'auto',
      callback: fin, 'expired-callback': () => fin(''),   // si falla, Turnstile reintenta solo
    });
    setTimeout(() => fin(''), 60000);   // si en un minuto no se resolvió, se corta
  });
}

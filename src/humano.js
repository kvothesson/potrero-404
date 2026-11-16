// Pide a Cloudflare Turnstile (invisible) una prueba de que no sos un bot, para pedir un código por mail.
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

export async function pruebaHumano() {
  if (local || !TURNSTILE_SITE_KEY) return '';
  const ts = await cargar();
  return new Promise((ok) => {
    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(caja);
    const fin = (t) => { try { ts.remove(id); } catch { /* ya no está */ } caja.remove(); ok(t || ''); };
    const id = ts.render(caja, { sitekey: TURNSTILE_SITE_KEY, size: 'invisible', callback: fin, 'error-callback': () => fin(''), 'timeout-callback': () => fin('') });
    setTimeout(() => fin(''), 15000);
  });
}

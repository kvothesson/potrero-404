// API del ranking, igual para el servidor local y para Cloudflare (usa Request/Response estándar).
//   POST /registro {nombre}      → {id, llave, nombre, elo}   (la llave solo la guarda tu navegador)
//   GET  /yo?id=&llave=          → tus datos, o 401 si la llave no coincide
//   GET  /ranking?yo=            → {lista, propio}: los primeros 50 y tu puesto si no estás entre ellos
//   GET  /buscar                 → {codigo}: la sala rankeada a la que entrar (con alguien esperando, o nueva)
import { registrar, verificar, tabla } from './ranking.js';

const ORIGENES = ['https://kvothesson.com'];
export function cabecerasCors(req) {
  const o = req.headers.get('Origin');
  const h = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'Origin' };
  if (o && (ORIGENES.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o))) h['access-control-allow-origin'] = o;
  return h;
}

const json = (req, datos, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabecerasCors(req) },
});

// Devuelve una Response si la ruta es de la API, o null si no.
export async function api(req, { db, buscar }) {
  const url = new URL(req.url);
  const rutas = ['/registro', '/yo', '/ranking', '/buscar'];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecerasCors(req) });
  try {
    if (url.pathname === '/registro' && req.method === 'POST') {
      const cuerpo = await req.json().catch(() => ({}));
      const r = await registrar(db, cuerpo.nombre);
      return r.error ? json(req, r, 400) : json(req, r);
    }
    if (url.pathname === '/yo') {
      const j = await verificar(db, url.searchParams.get('id'), url.searchParams.get('llave'));
      return j ? json(req, j) : json(req, { error: 'llave' }, 401);
    }
    if (url.pathname === '/ranking') return json(req, await tabla(db, url.searchParams.get('yo')));
    if (url.pathname === '/buscar') return json(req, { codigo: await buscar() });
  } catch (e) {
    return json(req, { error: 'servidor' }, 500);
  }
  return json(req, { error: 'ruta' }, 404);
}

// Fila para las rankeadas: el primero que busca abre una sala y queda esperando; el que busca
// dentro de los segundos siguientes entra a esa misma sala. Si nadie llega, la sala trae una IA.
export function crearFila(esperaMs) {
  let esperando = null;
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return function buscar(ahora = Date.now()) {
    if (esperando && ahora - esperando.desde < esperaMs) { const c = esperando.codigo; esperando = null; return c; }
    let c = 'R';
    for (let i = 0; i < 6; i++) c += letras[(Math.random() * letras.length) | 0];
    esperando = { codigo: c, desde: ahora };
    return c;
  };
}

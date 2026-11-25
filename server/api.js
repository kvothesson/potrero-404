// API del ranking, igual para el servidor local y para Cloudflare (usa Request/Response estándar).
//   POST /registro {nombre}      → {id, llave, nombre, elo}   (la llave solo la guarda tu navegador)
//   GET  /yo?id=&llave=          → tus datos, o 401 si la llave no coincide
//   GET  /ranking?yo=            → {lista, propio}: los primeros 50 y tu puesto si no estás entre ellos
//   GET  /buscar                 → {codigo}: la sala rankeada a la que entrar (con alguien esperando, o nueva)
//   POST /mail {mail}            → manda un código de 6 números a ese mail
//   POST /entrar {google | mail+codigo, id?, llave?, nombre?} → {id, llave, nombre} (ver server/cuentas.js)
//   GET  /liga                   → {ultimos, porDia, ias, ritmo}: la liga de IAs (ver server/liga.js)
import { registrar, verificar, tabla } from './ranking.js';
import { pedirCodigo, entrar, cuentasDe, dentroDelLimite, verificarHumano } from './cuentas.js';
import { sumar, resumen } from './metricas.js';
import { resumenLiga } from './liga.js';

const ORIGENES = ['https://kvothesson.com'];
export function cabecerasCors(req) {
  const o = req.headers.get('Origin');
  const h = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-clave', vary: 'Origin' };
  if (o && (ORIGENES.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o))) h['access-control-allow-origin'] = o;
  return h;
}

const json = (req, datos, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabecerasCors(req) },
});

// Devuelve una Response si la ruta es de la API, o null si no.
export async function api(req, { db, buscar, cuentas }) {
  const url = new URL(req.url);
  const rutas = ['/registro', '/yo', '/ranking', '/buscar', '/mail', '/entrar', '/evento', '/metricas', '/liga'];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecerasCors(req) });
  // la conexión: en Cloudflare viene en CF-Connecting-IP; en la PC es siempre la misma
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local';
  const limite = async (que) => !cuentas?.sal || await dentroDelLimite(db, cuentas.sal, que, ip);
  try {
    if (url.pathname === '/registro' && req.method === 'POST') {
      if (!(await limite('registro'))) return json(req, { error: 'muchos' }, 429);
      const cuerpo = await req.json().catch(() => ({}));
      const r = await registrar(db, cuerpo.nombre);
      return r.error ? json(req, r, 400) : json(req, r);
    }
    if (url.pathname === '/yo') {
      const j = await verificar(db, url.searchParams.get('id'), url.searchParams.get('llave'));
      return j ? json(req, { ...j, cuentas: await cuentasDe(db, j.id) }) : json(req, { error: 'llave' }, 401);
    }
    if (url.pathname === '/mail' && req.method === 'POST') {
      const cuerpo = await req.json().catch(() => ({}));
      if (!(await verificarHumano(cuentas, cuerpo.humano, ip))) return json(req, { error: 'humano' }, 403);
      if (!(await limite('mail'))) return json(req, { error: 'muchos' }, 429);
      const r = await pedirCodigo(db, cuentas, cuerpo.mail);
      return json(req, r, r.error ? (r.error === 'mail' ? 400 : 429) : 200);
    }
    if (url.pathname === '/entrar' && req.method === 'POST') {
      const cuerpo = await req.json().catch(() => ({}));
      if (!(await limite('entrar'))) return json(req, { error: 'muchos' }, 429);
      const r = await entrar(db, cuentas, cuerpo, { verificar, crearJugador: registrar });
      return json(req, r, r.error ? 400 : 200);
    }
    if (url.pathname === '/ranking') return json(req, { ...(await tabla(db, url.searchParams.get('yo'))), entrar: !!cuentas?.listo });
    if (url.pathname === '/liga') return json(req, await resumenLiga(db, Math.max(1, Math.min(50, Number(url.searchParams.get('n')) || 20))));
    if (url.pathname === '/buscar') return json(req, { codigo: await buscar() });
    // métricas: el navegador manda eventos sueltos (como texto, para no pedir permiso CORS antes)
    if (url.pathname === '/evento' && req.method === 'POST') {
      if (!(await limite('evento'))) return new Response(null, { status: 204, headers: cabecerasCors(req) });
      const cuerpo = JSON.parse((await req.text().catch(() => '')).slice(0, 512) || '{}');
      await sumar(db, cuerpo);
      return new Response(null, { status: 204, headers: cabecerasCors(req) });
    }
    if (url.pathname === '/metricas') {
      // solo con la clave (en la PC no hace falta)
      if (cuentas?.metricas && req.headers.get('x-clave') !== cuentas.metricas) return json(req, { error: 'clave' }, 401);
      return json(req, await resumen(db, Math.min(90, Number(url.searchParams.get('dias')) || 30)));
    }
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

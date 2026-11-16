// Servidor para jugar y probar en la PC: sirve los archivos del juego, la API del ranking y las
// salas online por WebSocket, todo en el mismo puerto. En internet esto lo hace Cloudflare (nube/).
//   node server/local.mjs            → http://127.0.0.1:5421
//   LAG=120 node server/local.mjs    → simula 120 ms de ida y 120 de vuelta, para probar el lag
// El ranking local se guarda en server/datos/ranking.sqlite (no se sube al repo).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { crearSala, ESPERA_IA } from './sala.js';
import { api, crearFila } from './api.js';
import { preparar, verificar, elegirIA, anotar } from './ranking.js';
import { mailResend } from './cuentas.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUERTO = Number(process.env.PORT || 5421);
const LAG = Number(process.env.LAG || 0);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Base local con la misma interfaz que D1 en Cloudflare.
await mkdir(fileURLToPath(new URL('./datos/', import.meta.url)), { recursive: true });
const sqlite = new DatabaseSync(process.env.RANKING || fileURLToPath(new URL('./datos/ranking.sqlite', import.meta.url)));
const db = {
  todas: async (sql, ...p) => sqlite.prepare(sql).all(...p),
  una: async (sql, ...p) => sqlite.prepare(sql).get(...p) || null,
  correr: async (sql, ...p) => sqlite.prepare(sql).run(...p),
};
await preparar(db);
const buscar = crearFila(ESPERA_IA - 500);
// Cuentas: en la PC el código del mail no se manda, se muestra acá en la consola.
// Con RESEND=<clave> sí se manda de verdad.
const cuentas = {
  listo: true,
  sal: process.env.SAL || 'sal-local-de-prueba',
  enviarMail: process.env.RESEND ? mailResend(process.env.RESEND)
    : async (mail, codigo) => { console.log(`[mail] código para ${mail}: ${codigo}`); return true; },
};

const http = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // API del ranking
  const cuerpo = req.method === 'POST' ? await new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > (url.pathname === '/captura' ? 4e6 : 4096)) req.destroy(); }); req.on('end', () => ok(d)); }) : undefined;
  const respuesta = await api(new Request(url, { method: req.method, headers: req.headers, body: cuerpo }), { db, buscar: () => buscar(), cuentas });
  if (respuesta) {
    res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
    res.end(await respuesta.text());
    return;
  }
  // solo en la PC: guardar una captura del juego (POST /captura?n=nombre con un PNG en data URL)
  if (url.pathname === '/captura' && req.method === 'POST') {
    const n = (url.searchParams.get('n') || 'captura').replace(/[^a-z0-9_-]/gi, '');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(fileURLToPath(new URL(`./datos/${n}.png`, import.meta.url)), Buffer.from(cuerpo.split(',')[1], 'base64'));
    res.writeHead(204).end(); return;
  }
  // archivos del juego
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(normalize(RAIZ)) || archivo.includes('node_modules') || archivo.includes('server') || archivo.includes('nube')) {
    res.writeHead(404).end(); return;
  }
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(datos);
  } catch { res.writeHead(404).end(); }
});

const salas = new Map();
const wss = new WebSocketServer({ server: http, path: '/sala' });
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const codigo = (url.searchParams.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!codigo) { ws.close(); return; }
  const rankeada = url.searchParams.get('rank') === '1';
  // quién sos: obligatorio en la rankeada; en una sala con amigos solo sirve para mostrar el nombre
  const jugador = await verificar(db, url.searchParams.get('id'), url.searchParams.get('llave'));
  if (rankeada && !jugador) { ws.send(JSON.stringify({ t: 'sinIdentidad' })); ws.close(); return; }
  let sala = salas.get(codigo);
  if (!sala) {
    sala = crearSala({ fisica: url.searchParams.get('fisica'), rankeada, pedirIA: (elo) => elegirIA(db, elo), alTerminar: (r) => anotar(db, r) });
    sala.reloj = setInterval(() => sala.avanzar(performance.now()), 4);
    salas.set(codigo, sala);
  }
  const demorar = (f) => (LAG ? setTimeout(f, LAG) : f());
  const con = { enviar: (t) => demorar(() => ws.readyState === 1 && ws.send(t)), jugador: jugador || null };
  sala.entrar(con);
  ws.on('message', (d) => demorar(() => sala.mensaje(con, String(d))));
  ws.on('close', () => {
    sala.salir(con);
    if (sala.vacia) { clearInterval(sala.reloj); salas.delete(codigo); }
  });
});

http.listen(PUERTO, '127.0.0.1', () => console.log(`Potrero 404 en http://127.0.0.1:${PUERTO}${LAG ? ` (lag simulado ${LAG} ms)` : ''}`));

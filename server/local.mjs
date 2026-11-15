// Servidor para jugar y probar en la PC: sirve los archivos del juego y las salas online
// por WebSocket en el mismo puerto. En internet esto lo hace Cloudflare (server/worker.js).
//   node server/local.mjs            → http://127.0.0.1:5421
//   LAG=120 node server/local.mjs    → simula 120 ms de ida y 120 de vuelta, para probar el lag
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { crearSala } from './sala.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUERTO = Number(process.env.PORT || 5421);
const LAG = Number(process.env.LAG || 0);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const http = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(normalize(RAIZ)) || archivo.includes('node_modules') || archivo.includes(`${'server'}`)) {
    res.writeHead(404).end(); return;
  }
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(datos);
  } catch { res.writeHead(404).end(); }
});

const salas = new Map();
const wss = new WebSocketServer({ server: http, path: '/sala' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const codigo = (url.searchParams.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!codigo) { ws.close(); return; }
  let sala = salas.get(codigo);
  if (!sala) {
    sala = crearSala({ fisica: url.searchParams.get('fisica') });
    sala.reloj = setInterval(() => sala.avanzar(performance.now()), 4);
    salas.set(codigo, sala);
  }
  const demorar = (f) => (LAG ? setTimeout(f, LAG) : f());
  const con = { enviar: (t) => demorar(() => ws.readyState === 1 && ws.send(t)) };
  sala.entrar(con);
  ws.on('message', (d) => demorar(() => sala.mensaje(con, String(d))));
  ws.on('close', () => {
    sala.salir(con);
    if (sala.vacia) { clearInterval(sala.reloj); salas.delete(codigo); }
  });
});

http.listen(PUERTO, '127.0.0.1', () => console.log(`Potrero 404 en http://127.0.0.1:${PUERTO}${LAG ? ` (lag simulado ${LAG} ms)` : ''}`));

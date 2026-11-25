// Mide el servidor real: ritmo de cuadros, espacio entre mensajes, tamaño y teclas pendientes.
// Uso: node server/medir-lag.mjs [wss://servidor] [segundos]
const srv = process.argv[2] || 'wss://potrero-404.kvothesson.workers.dev';
const seg = +(process.argv[3] || 15);
const codigo = `MED${Date.now() % 100000}`;
const abrir = () => new Promise((ok) => { const w = new WebSocket(`${srv}/sala?codigo=${codigo}`); w.onopen = () => ok(w); });
const t0 = performance.now();
const a = await abrir(); const b = await abrir();
const conectado = performance.now() - t0;
const llegadas = [], tam = [], cuadrosSrv = [], atraso = [];
let seq = 0; const enviado = new Map(); const rtts = [];
let ultimoAck = 0;
a.onmessage = (ev) => {
  const t = performance.now();
  const m = JSON.parse(ev.data);
  if (m.t !== 'estado') return;
  llegadas.push(t); tam.push(ev.data.length); cuadrosSrv.push([t, m.f]);
  if (m.ack > ultimoAck) { const ts = enviado.get(m.ack); if (ts) rtts.push(t - ts); ultimoAck = m.ack; }
  atraso.push(seq - m.ack);
};
b.onmessage = () => {};
const inicio = performance.now();
await new Promise((fin) => {
  let k = 0;
  const iv = setInterval(() => {
    // a ritmo de 60 por segundo según el reloj, como el navegador
    const deben = Math.floor((performance.now() - inicio) / (1000 / 60));
    while (k < deben) { k++; seq++; enviado.set(seq, performance.now()); a.send(JSON.stringify({ t: 'in', s: seq, k: k % 90 < 60 ? 1 : 9 })); b.send(JSON.stringify({ t: 'in', s: seq, k: 0 })); }
    if (performance.now() - inicio > seg * 1000) { clearInterval(iv); fin(); }
  }, 4);
});
a.close(); b.close();
const dif = llegadas.slice(1).map((t, i) => t - llegadas[i]).sort((x, y) => x - y);
const p = (arr, q) => arr.length ? +arr[Math.min(arr.length - 1, Math.floor(arr.length * q))].toFixed(1) : null;
const rt = rtts.sort((x, y) => x - y);
const [ta, fa] = cuadrosSrv[10], [tb, fb] = cuadrosSrv.at(-1);
const at = [...atraso].sort((x, y) => x - y);
console.log(JSON.stringify({
  servidor: srv, conectarMs: +conectado.toFixed(0), mensajes: llegadas.length,
  porSegundo: +(llegadas.length / seg).toFixed(1),
  cuadrosServidorPorSeg: +((fb - fa) / ((tb - ta) / 1000)).toFixed(1),
  entreMensajesMs: { p50: p(dif, .5), p90: p(dif, .9), p99: p(dif, .99), max: p(dif, 1) },
  huecosMas100ms: dif.filter((d) => d > 100).length,
  bytesPorMensaje: Math.round(tam.reduce((s, x) => s + x, 0) / tam.length), kbPorSeg: +(tam.reduce((s, x) => s + x, 0) / seg / 1024).toFixed(1),
  teclaIdaYVueltaMs: { p50: p(rt, .5), p90: p(rt, .9), p99: p(rt, .99), max: p(rt, 1) },
  teclasPendientes: { p50: p(at, .5), p90: p(at, .9), max: p(at, 1) },
}, null, 1));
process.exit(0);

// Prueba de la red sin navegador: dos clientes entran a la misma sala, uno maneja y se mide
// cuánto se equivoca la predicción (cuánto salta el auto propio cuando llega el estado
// del servidor). Uso: node server/prueba-red.mjs [puerto]
globalThis.location = { search: '', protocol: process.argv[4] || 'http:', host: process.argv[2] === "443" ? process.argv[3] : `${process.argv[3] || "127.0.0.1"}:${process.argv[2] || 5421}` };
const { conectar } = await import('../src/red.js');

const codigo = `PRUEBA${Date.now() % 1000}`;
const a = conectar({ codigo }), b = conectar({ codigo });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
while (!(a.estado && b.estado && a.jugadores === 2)) await espera(20);
// esperar a que termine la cuenta regresiva
while (a.estado.fase !== 'juego') { a.tic({}); b.tic({}); await espera(1000 / 60); }

let saltoMax = 0, cuadros = 0;
const tecla = (k) => ({ up: k < 120, right: k > 40 && k < 70, freno: k > 50 && k < 65, nitro: k > 80 && k < 100, salto: k === 110 });
let previo = null;
const t0 = performance.now();
for (let k = 0; k < 240; k++) {
  // a ritmo real, como el navegador
  while (performance.now() - t0 < k * 1000 / 60) await espera(1);
  const antes = previo;
  const s = a.tic(tecla(k)); b.tic({});
  const c = s.autos[0];
  if (antes) {
    // salto = diferencia entre dónde predijo que iba a estar y dónde quedó
    const d = Math.hypot(c.x - antes.x - antes.vx, c.y - antes.y - antes.vy);
    if (d > saltoMax) saltoMax = d;
    if (d > 5 && process.env.DEBUG) console.log("salto", k, d.toFixed(1), s.fase, a.pendientes.length);
  }
  previo = { x: c.x, y: c.y, vx: c.vx, vy: c.vy };
  cuadros++;
}
await espera(500);
for (let k = 0; k < 30; k++) { a.tic({}); b.tic({}); await espera(1000 / 60); }
const ca = a.estado.autos[0], cb = b.estado.autos[0];
console.log(JSON.stringify({
  cuadros, saltoMaximoPx: +saltoMax.toFixed(2), pendientesAlFinal: a.pendientes.length,
  azulSegunA: [+ca.x.toFixed(1), +ca.y.toFixed(1)], azulSegunB: [+cb.x.toFixed(1), +cb.y.toFixed(1)],
}));
a.cerrar(); b.cerrar();
process.exit(0);

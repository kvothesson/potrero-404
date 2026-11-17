// Muchos partidos de bots para ver que la Luz Mala nunca se escape ni salte al centro de golpe,
// y que los autos no atraviesen las paredes: node server/prueba-pelota.mjs [partidos]
import { nuevoEstado, paso, paredes, CAMPO, W, H } from '../src/sim.js';
import { crearBot } from '../src/bot.js';

const P = paredes().puntos;
const adentro = (x, y) => { let ok = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok; } return ok; };
const N = Number(process.argv[2] || 40);
let afuera = 0, saltos = 0, autosAfuera = 0, cuadros = 0, goles = 0, cuanticos = 0, paredRide = 0;
for (let k = 0; k < N; k++) {
  const s = nuevoEstado();
  const a = crearBot(0, 1 + (k % 8)), b = crearBot(1, 1 + ((k * 3) % 8));
  let prev = { ...s.pelota };
  for (let f = 0; f < 60 * 240 && s.fase !== 'fin'; f++) {
    paso(s, [a(s), b(s)]);
    cuadros++;
    const p = s.pelota;
    if (s.fase === 'juego') {
      if (!adentro(p.x, p.y)) afuera++;
      const salto = Math.hypot(p.x - prev.x, p.y - prev.y);
      const esCuantico = s.eventos.some((e) => e.t === 'cuantico');
      if (esCuantico) cuanticos++;
      if (salto > 30 && !esCuantico && !(s.camion && s.camion.estado === 'pasa')) saltos++;   // el camión la puede empujar de golpe
      for (const c of s.autos) if (!c.aplastado && !adentro(c.x, c.y)) autosAfuera++;
    }
    if (s.eventos.some((e) => e.t === 'gol')) goles++;
    prev = { x: p.x, y: p.y };
  }
}
console.log(JSON.stringify({ partidos: N, cuadros, goles, cuanticos, pelotaAfuera: afuera, saltosRaros: saltos, autosAfuera }));
process.exit(afuera || saltos || autosAfuera ? 1 : 0);

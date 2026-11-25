// Las 8 IAs del ranking jugando entre ellas, sin pantalla, con src/sim.js y las reglas reales
// (3 minutos o 3 goles, gol de oro). Muestra:
//   1. el todos contra todos (orden de fuerza, y si hay estilos que se ganan "de mano"),
//   2. métricas por estilo que prueban que juegan distinto,
//   3. que ningún partido se traba,
//   4. que el retraso de reacción se cumple (se cambia el mundo y se mide cuándo reacciona),
//   5. las IAs contra un "principiante" simulado (el bot viejo, con reacción de 250 ms).
//
//   node server/prueba-estilos.mjs [partidos por cruce] [partidos contra el principiante]
// Sale con error si algo no se cumple.
import { nuevoEstado, paso, FPS, W, CAMPO } from '../src/sim.js';
import { crearBot, RETRASO_HUMANO } from '../src/bot.js';
import { IAS } from './ranking.js';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

// ---------- el principiante simulado ----------
// Es el bot de src/bot.js hasta el 2026-11-23, copiado tal cual, pero mirando el partido con un
// retraso de reacción (una foto de hace `retraso` cuadros) en vez del estado exacto.
function crearBotViejo(lado, nivel, retraso) {
  const pensar = botViejo(lado, nivel), fotos = [];
  return (s) => {
    fotos.push(structuredClone({ fase: s.fase, autos: s.autos, pelota: s.pelota, camion: s.camion }));
    if (fotos.length > retraso + 1) fotos.shift();
    return pensar(fotos[0]);
  };
}
function botViejo(lado, nivel = 5) {
  const n = Math.max(1, Math.min(8, nivel));
  const arcoContrario = { x: W / 2, y: lado === 1 ? CAMPO.T - 20 : CAMPO.B + 20 };
  const arcoPropio = { x: W / 2, y: lado === 1 ? CAMPO.B : CAMPO.T };
  const cadaCuanto = Math.max(1, 10 - n);
  const punteria = 4 + (8 - n) * 3;
  const errorApunte = (8 - n) * 9;
  const usaNitro = n >= 3, frenaMal = n <= 2;
  let trabado = 0, ultima = {}, cuenta = 0, error = { x: 0, y: 0 };
  return function pensar(s) {
    const c = s.autos[lado], b = s.pelota;
    if (s.fase !== 'juego' || c.aplastado) return {};
    if (cuenta-- > 0) return ultima;
    cuenta = cadaCuanto - 1;
    if (Math.random() < 0.05) error = { x: (Math.random() - 0.5) * errorApunte * 2, y: (Math.random() - 0.5) * errorApunte * 2 };
    const dx = arcoContrario.x - b.x, dy = arcoContrario.y - b.y, d = Math.hypot(dx, dy) || 1;
    let tx = b.x - dx / d * 22 + error.x, ty = b.y - dy / d * 22 + error.y;
    const pelotaAtras = lado === 1 ? b.y > c.y + 10 : b.y < c.y - 10;
    if (pelotaAtras) { tx = (b.x + arcoPropio.x) / 2; ty = (b.y + arcoPropio.y) / 2; }
    const k = s.camion;
    if (k && (k.estado === 'aviso' || k.estado === 'pasa') && Math.abs(c.x - k.x) < 70 && n >= 2) {
      tx = c.x + (c.x < k.x ? -160 : 160); ty = c.y;
    }
    const ang = Math.atan2(ty - c.y, tx - c.x) * 180 / Math.PI;
    const dif = ((ang - c.rot + 540) % 360) - 180;
    const lejos = Math.hypot(tx - c.x, ty - c.y);
    if (Math.abs(c.vel) < 0.3) trabado += cadaCuanto; else trabado = Math.max(0, trabado - 2 * cadaCuanto);
    if (trabado > 40) { if (trabado > 70) trabado = 0; return (ultima = { down: true, left: true }); }
    ultima = {
      up: (Math.abs(dif) < 120 || lejos > 60) && !(frenaMal && Math.random() < 0.15),
      down: Math.abs(dif) > 150 && lejos < 50,
      right: dif > punteria, left: dif < -punteria,
      freno: Math.abs(dif) > 75 && Math.abs(c.vel) > 3,
      nitro: usaNitro && c.nitro > 30 && Math.abs(dif) < 12 && lejos > 120,
    };
    return ultima;
  };
}

const N = Number(process.argv[2] || 10);          // por cruce (mitad de cada lado)
const NP = Number(process.argv[3] || 20);         // contra el principiante
const TOPE = 12 * 60 * FPS;                       // si un partido llega a 12 minutos, está trabado
const SIN_TOQUE = 25 * FPS;                       // 25 s sin que nadie toque la pelota: trabado
const QUIETA = 30 * FPS;                          // 30 s con la pelota quieta: trabado (la liga corta ahí)
const fallas = [];

function nuevasMetricas() {
  return { cuadros: 0, distArco: 0, posesion: 0, nitro: 0, pastillas: 0, toques: 0, bandas: 0, golesBanda: 0, choques: 0, demoliciones: 0, cerca: 0, velPelotaToque: 0 };
}

// Un partido. a y b son fábricas: (lado) => pensar. Devuelve ganador, goles y métricas por lado.
function partido(fa, fb) {
  const s = nuevoEstado();
  const bots = [fa(0), fb(1)];
  const met = [nuevasMetricas(), nuevasMetricas()];
  let ultimoToque = -1, cuadroToque = -999, conBanda = false, sinToque = 0, maxSinToque = 0, quieta = 0, maxQuieta = 0, f = 0;
  for (; f < TOPE && s.fase !== 'fin'; f++) {
    const e0 = bots[0](s), e1 = bots[1](s);
    paso(s, [e0, e1]);
    for (const ev of s.eventos) if (ev.t === 'gol' && ev.quien === ultimoToque && conBanda) met[ev.quien].golesBanda++;
    if (s.fase !== 'juego') { sinToque = 0; continue; }
    sinToque++;
    const b = s.pelota;
    quieta = Math.hypot(b.vx, b.vy) < 0.3 ? quieta + 1 : 0; maxQuieta = Math.max(maxQuieta, quieta);
    for (const c of s.autos) {
      const m = met[c.i], otro = s.autos[1 - c.i];
      m.cuadros++;
      m.distArco += c.i === 0 ? c.y - 90 : 1350 - c.y;
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < 70) m.cerca++;
      if (d < 70 && d < Math.hypot(b.x - otro.x, b.y - otro.y)) m.posesion++;
      if (c.nitroActivo) m.nitro++;
    }
    for (const ev of s.eventos) {
      if (ev.t === 'toque' && ev.quien >= 0) {
        met[ev.quien].toques++; met[ev.quien].velPelotaToque += ev.fuerza;
        ultimoToque = ev.quien; cuadroToque = f; sinToque = 0;
        conBanda = false;
      } else if (ev.t === 'pared' && ultimoToque >= 0 && f - cuadroToque < 120 && ev.fuerza > 2 &&
        (b.x < CAMPO.L + 16 || b.x > CAMPO.R - 16) && (ultimoToque === 0 ? b.vy > 0 : b.vy < 0)) {
        // banda: después de su toque la pelota pega en una pared de los costados y sigue hacia el arco rival
        met[ultimoToque].bandas++; cuadroToque = -999; conBanda = true;
      } else if (ev.t === 'nitro') met[ev.quien].pastillas++;
      else if (ev.t === 'choqueAutos') {
        // el que embistió es el que iba más rápido hacia el otro
        const [a, z] = s.autos, nx = z.x - a.x, ny = z.y - a.y, l = Math.hypot(nx, ny) || 1;
        const va = (a.vx * nx + a.vy * ny) / l, vz = -(z.vx * nx + z.vy * ny) / l;
        met[va >= vz ? 0 : 1].choques++;
      } else if (ev.t === 'aplastado' && ev.demolicion) met[1 - ev.quien].demoliciones++;
    }
    maxSinToque = Math.max(maxSinToque, sinToque);
  }
  return { ganador: s.fase === 'fin' ? s.ganador : -1, goles: [s.autos[0].goles, s.autos[1].goles], met, cuadros: f, oro: s.oro, maxSinToque, maxQuieta };
}

const fabrica = (ia) => (lado) => crearBot(lado, ia.nivel, ia.estilo);
// El principiante: el bot de antes (src/bot.js hasta 2026-11-23) en su nivel 3, viendo con 250 ms de retraso.
const principiante = (lado) => crearBotViejo(lado, 3, 15);
const jugar = (t) => partido(t.a < 0 ? principiante : fabrica(IAS[t.a]), t.b < 0 ? principiante : fabrica(IAS[t.b]));

// Los partidos se reparten entre hilos (uno por núcleo, hasta 4) para que tarde menos.
if (!isMainThread) {
  parentPort.postMessage(workerData.map(jugar));
} else {
  await principal();
}

async function principal() {
const inicio = Date.now();
const k = IAS.length;
const tareas = [];
for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) for (let r = 0; r < N; r++) {
  const [a, b] = r % 2 ? [j, i] : [i, j];             // mitad de cada lado (el azul dobla mejor, el rojo corre más)
  tareas.push({ a, b });
}
for (let i = 0; i < k; i++) for (let r = 0; r < NP; r++) tareas.push(r % 2 === 0 ? { a: i, b: -1, p: i } : { a: -1, b: i, p: i });
const hilos = Math.max(1, Math.min(4, cpus().length));
const partes = Array.from({ length: hilos }, (_, h) => tareas.filter((_, i) => i % hilos === h));
const resultados = await Promise.all(partes.map((parte) => new Promise((ok, mal) => {
  const w = new Worker(new URL(import.meta.url), { workerData: parte, argv: process.argv.slice(2) });
  w.once('message', ok); w.once('error', mal);
})));
const todos = [];
partes.forEach((parte, h) => parte.forEach((t, i) => todos.push({ ...t, res: resultados[h][i] })));

// ---------- 1. todos contra todos ----------
const gana = Array.from({ length: k }, () => Array(k).fill(0));
const jugados = Array.from({ length: k }, () => Array(k).fill(0));
const porEstilo = IAS.map(() => ({ ...nuevasMetricas(), partidos: 0, goles: 0, contra: 0 }));
let trabados = 0, quietas = 0, maxQuieta = 0, maxSinToque = 0, maxCuadros = 0, oros = 0, partidos = 0;
for (const { a, b, res } of todos.filter((t) => t.a >= 0 && t.b >= 0)) {
    partidos++;
    if (res.ganador < 0 || res.maxSinToque > SIN_TOQUE || res.maxQuieta >= QUIETA) trabados++;
    if (res.maxQuieta >= QUIETA) quietas++;
    maxQuieta = Math.max(maxQuieta, res.maxQuieta);
    maxSinToque = Math.max(maxSinToque, res.maxSinToque); maxCuadros = Math.max(maxCuadros, res.cuadros);
    if (res.oro) oros++;
    if (res.ganador === 0) gana[a][b]++; else if (res.ganador === 1) gana[b][a]++;
    jugados[a][b]++; jugados[b][a]++;
    [a, b].forEach((x, lado) => {
      const m = res.met[lado], t = porEstilo[x];
      for (const c of Object.keys(m)) t[c] += m[c];
      t.partidos++; t.goles += res.goles[lado]; t.contra += res.goles[1 - lado];
    });
}

// Elo ajustado a los resultados (para ver el orden y qué cruces se salen de lo esperado)
const elo = Array(k).fill(1000);
for (let it = 0; it < 3000; it++) {
  for (let i = 0; i < k; i++) {
    let real = 0, esperado = 0;
    for (let j = 0; j < k; j++) if (i !== j && jugados[i][j]) {
      real += gana[i][j]; esperado += jugados[i][j] / (1 + 10 ** ((elo[j] - elo[i]) / 400));
    }
    elo[i] += (real - esperado) * 0.5;
  }
  const media = elo.reduce((a, b) => a + b) / k; for (let i = 0; i < k; i++) elo[i] += 1000 - media;
}

const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
const pad = (t, n) => String(t).padStart(n);
console.log(`\n1. TODOS CONTRA TODOS: ${partidos} partidos (${N} por cruce, mitad de cada lado). % de victorias de la fila contra la columna\n`);
console.log('            ' + IAS.map((ia) => pad(ia.id, 6)).join('') + '   total   Elo ajustado');
for (let i = 0; i < k; i++) {
  let gt = 0, jt = 0;
  const fila = IAS.map((_, j) => { if (i === j) return pad('-', 6); gt += gana[i][j]; jt += jugados[i][j]; return pad(pct(gana[i][j], jugados[i][j]), 6); }).join('');
  console.log(`${IAS[i].id} ${IAS[i].estilo.padEnd(11)}`.slice(0, 12) + fila + pad(pct(gt, jt) + '%', 8) + pad(Math.round(elo[i]), 10));
}
// no transitivo: cruces donde el de menos Elo ajustado le gana al de más, y "de mano" (se sale
// más de 15 puntos de lo que diría el Elo)
const sorpresas = [], deMano = [];
for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j && jugados[i][j]) {
  const real = gana[i][j] / jugados[i][j], esp = 1 / (1 + 10 ** ((elo[j] - elo[i]) / 400));
  if (elo[i] < elo[j] && real > 0.5) sorpresas.push(`${IAS[i].id} (${IAS[i].estilo}) le gana ${pct(gana[i][j], jugados[i][j])}% a ${IAS[j].id} (${IAS[j].estilo})`);
  if (real - esp > 0.15) deMano.push(`${IAS[i].estilo} contra ${IAS[j].estilo}: ${Math.round(real * 100)}% (el Elo diría ${Math.round(esp * 100)}%)`);
}
console.log(`\nCruces donde gana el de menos Elo (no transitivo): ${sorpresas.length}`);
sorpresas.forEach((t) => console.log('  ' + t));
console.log(`Estilos que se ganan "de mano" (más de 15 puntos arriba de lo esperado por Elo): ${deMano.length}`);
deMano.forEach((t) => console.log('  ' + t));
const ordenElo = [...elo.keys()].sort((a, b) => elo[b] - elo[a]);
if (ordenElo[0] !== k - 1) fallas.push(`la más fuerte no es ia-8 sino ${IAS[ordenElo[0]].id}`);
if (elo[k - 1] - elo[0] < 300) fallas.push('poca diferencia entre ia-1 e ia-8');

// ---------- 2. métricas por estilo ----------
console.log('\n2. CÓMO JUEGA CADA UNA (promedios por partido; % sobre el tiempo de juego)\n');
console.log('              estilo       goles  contra  dist.arco  posesión  cerca  nitro%  pastillas  toques  bandas/toque  goles banda  choques  demol.  vel.pelota');
IAS.forEach((ia, i) => {
  const t = porEstilo[i], pj = t.partidos;
  console.log(`${ia.id.padEnd(5)} ${ia.nombre.slice(0, 7).padEnd(7)} ${ia.estilo.padEnd(11)}` +
    pad((t.goles / pj).toFixed(2), 7) + pad((t.contra / pj).toFixed(2), 8) +
    pad(Math.round(t.distArco / t.cuadros), 11) + pad(pct(t.posesion, t.cuadros) + '%', 10) + pad(pct(t.cerca, t.cuadros) + '%', 7) +
    pad(pct(t.nitro, t.cuadros) + '%', 8) + pad((t.pastillas / pj).toFixed(1), 11) + pad((t.toques / pj).toFixed(1), 8) +
    pad((t.bandas / Math.max(1, t.toques)).toFixed(2), 14) + pad((t.golesBanda / pj).toFixed(2), 13) + pad((t.choques / pj).toFixed(1), 9) + pad((t.demoliciones / pj).toFixed(2), 8) +
    pad((t.velPelotaToque / Math.max(1, t.toques)).toFixed(1), 12));
});
// cada estilo tiene que destacarse en lo suyo
const col = (c, div = 'cuadros') => IAS.map((_, i) => porEstilo[i][c] / porEstilo[i][div]);
const idx = (estilo) => IAS.findIndex((ia) => ia.estilo === estilo);
const esMax = (arr, e) => arr[idx(e)] === Math.max(...arr);
const esMin = (arr, e) => arr[idx(e)] === Math.min(...arr);
const firmas = [
  ['arquero: el más cerca de su arco', esMin(col('distArco'), 'arquero')],
  ['contra: entre los 2 más cerca de su arco', [...col('distArco')].sort((a, b) => a - b).slice(0, 2).includes(col('distArco')[idx('contra')])],
  ['choque: el que más embiste', esMax(col('choques', 'partidos'), 'choque')],
  ['nitro: el que más nitro usa', esMax(col('nitro'), 'nitro')],
  ['nitro: el que más pastillas junta', esMax(col('pastillas', 'partidos'), 'nitro')],
  // (el arquero también: despeja hacia los costados)
  ['pared: entre los 2 que más tiran de banda (pared del costado y sigue al arco rival)', [...col('bandas', 'toques')].sort((a, b) => b - a).slice(0, 2).includes(col('bandas', 'toques')[idx('pared')])],
  ['pared: el que más goles de banda hace', esMax(col('golesBanda', 'partidos'), 'pared')],
  ['gambeta: el que más tiempo tiene la pelota', esMax(col('posesion'), 'gambeta')],
  ['gambeta: entre los 2 que más despacio le pegan', [...col('velPelotaToque', 'toques')].sort((a, b) => a - b).slice(0, 2).includes(col('velPelotaToque', 'toques')[idx('gambeta')])],
];
console.log('\nFirmas de estilo:');
for (const [t, ok] of firmas) { console.log(`  ${ok ? 'sí ' : 'NO '} ${t}`); if (!ok) fallas.push(`firma: ${t}`); }

// ---------- 3. que no se trabe ----------
console.log(`\n3. TRABAS: ${trabados} partidos trabados de ${partidos} (${quietas} con la pelota quieta 30 s o más; lo más que estuvo quieta: ${(maxQuieta / FPS).toFixed(1)} s). Lo más largo sin que nadie toque la pelota: ${(maxSinToque / FPS).toFixed(1)} s. ` +
  `Partido más largo: ${(maxCuadros / FPS / 60).toFixed(1)} min. Con gol de oro: ${oros}.`);
if (trabados) fallas.push(`${trabados} partidos trabados`);

// ---------- 4. retraso de reacción ----------
// Dos mundos idénticos con bots idénticos (misma semilla). En un cuadro se cambia la pelota en uno
// solo de los mundos; se mide cuántos cuadros tarda la IA en apretar algo distinto. Si mirara el
// estado de ahora, reaccionaría antes de su retraso.
console.log('\n4. RETRASO DE REACCIÓN (cuadros desde que cambia la pelota hasta que la IA aprieta distinto)\n');
const clonar = (x) => structuredClone(x);
IAS.forEach((ia) => {
  const tiempos = [];
  let antes = 0;
  for (let prueba = 0; prueba < 40; prueba++) {
    const base = nuevoEstado(); base.camion = null;
    const semA = 1000 + prueba, semB = 5000 + prueba;
    const mundos = [0, 1].map(() => ({ s: clonar(base), yo: crearBot(0, ia.nivel, ia.estilo, { semilla: semA }), otro: crearBot(1, 6, 'completo', { semilla: semB }) }));
    const calentar = 240 + prueba * 23;          // cuadros de juego antes del cambio
    let t0 = -1, reaccion = -1;
    for (let f = 0; f < calentar + 120; f++) {
      if (f === calentar) {
        t0 = f;
        const b = mundos[1].s.pelota;          // la pelota salta 150 px al costado y cambia de rumbo
        b.x = b.x < 480 ? b.x + 150 : b.x - 150; b.vx = -b.vx + (b.vx >= 0 ? -3 : 3); b.vy = -b.vy;
      }
      const salidas = mundos.map((w) => { const e = [w.yo(w.s), w.otro(w.s)]; paso(w.s, e); return JSON.stringify(e[0]); });
      if (t0 < 0 && salidas[0] !== salidas[1]) { antes++; break; }
      if (t0 >= 0 && salidas[0] !== salidas[1]) { reaccion = f - t0; break; }
    }
    if (reaccion >= 0) tiempos.push(reaccion);
  }
  const p = crearBot(0, ia.nivel, ia.estilo);
  const min = Math.min(...tiempos), media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  console.log(`  ${ia.id} ${ia.estilo.padEnd(11)} retraso ${p.retraso} cuadros (${Math.round(p.retraso * 1000 / FPS)} ms), decide cada ${p.cadencia}: ` +
    `reaccionó en ${tiempos.length}/40 pruebas, la más rápida a los ${min} cuadros (${Math.round(min * 1000 / FPS)} ms), en promedio ${media.toFixed(1)}`);
  if (min < p.retraso || min < RETRASO_HUMANO) fallas.push(`${ia.id} reaccionó en ${min} cuadros, antes de su retraso ${p.retraso}`);
  if (antes) fallas.push(`${ia.id}: los dos mundos se separaron antes del cambio (la prueba no es pareja)`);
  if (tiempos.length < 20) fallas.push(`${ia.id}: casi nunca reaccionó al cambio`);
});

// ---------- 5. contra el principiante ----------
console.log(`
5. CONTRA UN PRINCIPIANTE SIMULADO (bot viejo nivel 3 con 250 ms de reacción), ${NP} partidos cada una
`);
let trabadosP = 0;
const contraP = IAS.map((ia, i) => {
  let g = 0, goles = 0, recibidos = 0;
  for (const { a, res } of todos.filter((t) => t.p === i)) {
    const lado = a === i ? 0 : 1;
    if (res.ganador === lado) g++;
    if (res.ganador < 0 || res.maxQuieta >= QUIETA) trabadosP++;
    goles += res.goles[lado]; recibidos += res.goles[1 - lado];
  }
  console.log(`  ${ia.id} ${ia.nombre.padEnd(20)} ${ia.estilo.padEnd(11)} gana ${pad(pct(g, NP), 3)}%  goles ${(goles / NP).toFixed(1)} a ${(recibidos / NP).toFixed(1)}`);
  return g / NP;
});
console.log(`  Trabados contra el principiante: ${trabadosP}`);
if (trabadosP) fallas.push(`${trabadosP} partidos trabados contra el principiante`);
if (contraP[k - 1] < 0.9) fallas.push('ia-8 no le gana casi siempre al principiante');

console.log(`\n${((Date.now() - inicio) / 1000).toFixed(0)} s.`);
if (fallas.length) { console.log('\nFALLAS:'); fallas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
console.log('\nTodo bien.');
}

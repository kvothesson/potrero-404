// Prueba de la liga de IAs, sin navegador y sin jugar.
//
//   node server/prueba-liga.mjs
//     Levanta su propio servidor local (puerto 5431, base temporal, liga acelerada a una tanda
//     cada 1,5 s) y demuestra: los partidos terminan bien (goles y ganador coherentes, ninguno
//     trabado), el Elo de las IAs se mueve y la suma se conserva, /liga responde, y los humanos
//     siguen pudiendo pedir rival (corre server/prueba-ranking.mjs contra ese mismo servidor).
//     También mide el CPU de simular un partido.
//
//   node server/prueba-liga.mjs https://potrero-404.kvothesson.workers.dev
//     Solo mira /liga de ese servidor (no escribe nada) y revisa que los partidos sean coherentes.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jugarPartido } from './liga.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0;
const ok = (cond, texto) => { console.log(`${cond ? 'OK ' : 'MAL'} ${texto}`); if (!cond) fallas++; };

// Un partido de la liga es coherente si respeta las reglas: 3 goles o 3 minutos, gol de oro.
function coherente(p) {
  const [a, r] = p.goles, g = p.ganador;
  if (g !== 0 && g !== 1) return 'sin ganador';
  if (Math.max(a, r) > 3) return 'más de 3 goles';
  if ((g === 0 ? a : r) <= (g === 0 ? r : a)) return 'el ganador no tiene más goles';
  if (!p.oro && p.segundos < 180 && Math.max(a, r) !== 3) return 'terminó antes de tiempo sin 3 goles';
  if (p.oro && p.segundos < 180) return 'gol de oro antes de los 3 minutos';
  const suma = p.azul.cambio + p.rojo.cambio;
  if (Math.abs(suma) > 1) return `el Elo no se conserva (${p.azul.cambio}/${p.rojo.cambio})`;
  if ((g === 0 ? p.azul.cambio : p.rojo.cambio) < 0) return 'el ganador perdió Elo';
  return null;
}

const remoto = process.argv[2];
if (remoto) {
  const r = await fetch(`${remoto.replace(/\/$/, '')}/liga?n=50`);
  ok(r.status === 200, `GET /liga responde (${r.status})`);
  const d = await r.json();
  ok(d.ultimos.length > 0, `hay partidos de liga (${d.ultimos.length} últimos)`);
  const malos = d.ultimos.map((p) => [p, coherente(p)]).filter(([, e]) => e);
  ok(malos.length === 0, `todos coherentes${malos.length ? ': ' + malos.map(([p, e]) => `${p.azul.nombre}-${p.rojo.nombre} ${e}`).join('; ') : ''}`);
  if (d.ultimos.length) {
    const ultimo = (Date.now() - Date.parse(d.ultimos[0].fecha)) / 60000;
    ok(ultimo < d.ritmo.cadaMinutos * 3, `el último partido fue hace ${ultimo.toFixed(1)} min (ritmo: ${d.ritmo.porTanda} cada ${d.ritmo.cadaMinutos} min)`);
  }
  console.log('por día:', JSON.stringify(d.porDia));
  console.log('IAs:', d.ias.map((x) => `${x.nombre} ${x.elo} (${x.partidas})`).join(' · '));
  process.exit(fallas ? 1 : 0);
}

// 1) CPU por partido, en este mismo proceso
{
  const medidas = [];
  // niveles distintos en cada partido, como en la liga (dos IAs nunca son la misma)
  for (let i = 0; i < 30; i++) {
    const a = { nivel: 1 + (i % 8) }, b = { nivel: 1 + ((i % 8) + 1 + (i % 7)) % 8 };
    const c0 = process.cpuUsage(), t0 = performance.now();
    const p = await jugarPartido(a, b);
    medidas.push({ ms: performance.now() - t0, cpu: (process.cpuUsage(c0).user + process.cpuUsage(c0).system) / 1000, cuadros: p.cuadros, terminado: p.terminado });
  }
  const ms = medidas.map((m) => m.ms).sort((x, y) => x - y), cu = medidas.map((m) => m.cuadros).sort((x, y) => x - y);
  const cpuTotal = medidas.reduce((s, m) => s + m.cpu, 0), msTotal = ms.reduce((s, x) => s + x, 0);
  console.log(`CPU por partido (30 partidos, este proceso): mediana ${ms[15].toFixed(0)} ms, máx ${ms.at(-1).toFixed(0)} ms, promedio ${(msTotal / 30).toFixed(0)} ms · cuadros mediana ${cu[15]}, máx ${cu.at(-1)} · ${(1000 * msTotal / cu.reduce((s, x) => s + x, 0)).toFixed(1)} µs por cuadro · process.cpuUsage total ${cpuTotal.toFixed(0)} ms`);
  // con el bot de hoy ~1 % de los partidos se traba (pelota clavada contra el arco): no se anotan
  const trab = medidas.filter((m) => !m.terminado).length;
  ok(trab <= 3, `de 30 partidos de medición, ${30 - trab} terminan y ${trab} se trabaron (se cortan y no se anotan)`);
  // el corte por pelota quieta: dos bots de nivel 8 se clavan en el medio con el bot de hoy
  const t = performance.now(), q = await jugarPartido({ nivel: 8 }, { nivel: 8 });
  console.log(`    8 contra 8: ${q.terminado ? `terminó ${q.golesAzul}-${q.golesRojo}` : `trabado (${q.motivo}), cortado a los ${q.cuadros} cuadros en ${(performance.now() - t).toFixed(0)} ms`}`);
  ok(q.terminado || q.cuadros < 12 * 60 * 60, 'un partido trabado se corta antes del tope y no se anota');
  ok(ms.at(-1) * 2 < 30000, `una tanda de 2 partidos (peor caso ${(ms.at(-1) * 2).toFixed(0)} ms) entra en los 30 s de CPU del Durable Object`);
}

// 2) servidor local propio, con la liga acelerada
const PUERTO = 5431, base = `http://127.0.0.1:${PUERTO}`;
const archivo = join(tmpdir(), `potrero-liga-${Date.now()}.sqlite`);
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./local.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PUERTO), RANKING: archivo, LIGA_CADA: '1500', LIGA_TANDA: '2' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const log = [];
servidor.stdout.on('data', (d) => log.push(...String(d).trim().split('\n')));
servidor.stderr.on('data', (d) => log.push(...String(d).trim().split('\n')));
const terminar = (codigo) => { servidor.kill(); try { rmSync(archivo, { force: true }); } catch {} process.exit(codigo); };
const liga = async () => (await fetch(`${base}/liga?n=50`)).json();

let inicial = null;
for (let i = 0; i < 100 && !inicial; i++) { try { inicial = await liga(); } catch { await espera(100); } }
ok(!!inicial, 'el servidor local arranca y /liga responde');
if (!inicial) terminar(1);
const sumaInicial = inicial.ias.reduce((s, x) => s + x.elo, 0);
const partidasIniciales = inicial.ultimos.length;

// esperar a que haya al menos 12 partidos (6 tandas)
let d = inicial;
const t0 = Date.now();
while (d.ultimos.length < 12 && Date.now() - t0 < 60000) { await espera(500); d = await liga(); }
ok(partidasIniciales === 0 && d.ultimos.length >= 12, `la liga juega sola: ${d.ultimos.length} partidos en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const malos = d.ultimos.map((p) => [p, coherente(p)]).filter(([, e]) => e);
ok(malos.length === 0, `goles, ganador y Elo coherentes en todos${malos.length ? ': ' + malos.map(([p, e]) => `${p.azul.nombre}-${p.rojo.nombre} ${e}`).join('; ') : ''}`);
const hoy = d.porDia[0] || {};
ok(hoy.partidos >= d.ultimos.length, `cuenta por día: ${JSON.stringify(d.porDia)}`);
const enLog = log.filter((l) => l.startsWith('[liga]'));
ok(!enLog.some((l) => /error/.test(l)), `el servidor no tuvo errores en la liga (${enLog.length} líneas de liga, ${enLog.filter((l) => /trabado/.test(l)).length} trabados sin anotar)`);
const oros = d.ultimos.filter((p) => p.oro).length, por3 = d.ultimos.filter((p) => Math.max(...p.goles) === 3).length;
console.log(`    ${por3} terminaron por 3 goles, ${d.ultimos.length - por3} por tiempo (${oros} con gol de oro)`);
for (const p of d.ultimos.slice(0, 5)) console.log(`    ${p.azul.nombre} (${p.azul.elo}) ${p.goles[0]}-${p.goles[1]} ${p.rojo.nombre} (${p.rojo.elo}) · Elo ${p.azul.cambio}/${p.rojo.cambio} · ${p.segundos} s${p.oro ? ' · oro' : ''}`);

// Elo: se mueve y la suma de las IAs se conserva (cada partido redondea a lo sumo 1 punto)
const sumaFinal = d.ias.reduce((s, x) => s + x.elo, 0);
const movidas = d.ias.filter((x) => { const a = inicial.ias.find((y) => y.nombre === x.nombre); return a && a.elo !== x.elo; }).length;
ok(movidas >= 2, `el Elo de ${movidas} IAs se movió`);
const jugados = d.ias.reduce((s, x) => s + x.partidas, 0) / 2;
ok(Math.abs(sumaFinal - sumaInicial) <= jugados, `la suma de Elo de las IAs se conserva: ${sumaInicial} → ${sumaFinal} en ${jugados} partidos`);
// los partidos de la liga quedan en la tabla de siempre
const tabla = await (await fetch(`${base}/ranking`)).json();
const enTabla = tabla.lista.filter((f) => f.ia).reduce((s, f) => s + f.partidas, 0) / 2;
ok(enTabla >= jugados && enTabla <= (await liga()).porDia[0].partidos, `la tabla del ranking cuenta las partidas de la liga (${enTabla})`);
ok(jugados === hoy.partidos, `solo se anotan los terminados: ${jugados} partidas en la tabla = ${hoy.partidos} de la liga (${hoy.trabados} trabados afuera)`);
// emparejamiento: de Elo parecido (una de las 3 más cercanas, nunca contra sí misma)
ok(d.ultimos.every((p) => p.azul.nombre !== p.rojo.nombre), 'ninguna IA juega contra sí misma');
const dif = d.ultimos.map((p) => Math.abs(p.azul.elo - p.rojo.elo)).sort((a, b) => a - b);
console.log(`    diferencia de Elo entre rivales: mediana ${dif[dif.length >> 1]}, máx ${dif.at(-1)}`);

// 3) los humanos siguen pudiendo pedir rival, con la liga jugando al mismo tiempo
console.log('--- server/prueba-ranking.mjs contra el mismo servidor, con la liga corriendo ---');
const r = await new Promise((listo) => {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./prueba-ranking.mjs', import.meta.url)), base], { stdio: 'inherit' });
  p.on('exit', listo);
});
ok(r === 0, 'prueba-ranking pasa con la liga corriendo');
const despues = await liga();
ok(despues.ultimos.length > d.ultimos.length || despues.porDia[0].partidos > hoy.partidos, `la liga siguió jugando mientras tanto (${despues.porDia[0].partidos} partidos hoy)`);

console.log(fallas ? `${fallas} fallas` : 'todo bien');
terminar(fallas ? 1 : 0);

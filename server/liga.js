// Liga de IAs: las IAs del ranking juegan partidos de verdad entre ellas, sin pantalla, y cada
// partido se anota con Elo en las mismas tablas que los humanos (anotar() de ranking.js).
// Así la tabla se mueve aunque no haya nadie jugando. Lógica pura: la usan igual el servidor
// local (server/local.mjs, con un setInterval) y Cloudflare (nube/, alarma del Durable Object Liga).
//
// Reglas de siempre: la misma src/sim.js del juego, 3 minutos o 3 goles, gol de oro si empatan.
// Emparejamiento como el de los humanos: una IA al azar contra una de las tres de Elo más parecido.
import { nuevoEstado, paso, FPS } from '../src/sim.js';
import { crearBot } from '../src/bot.js';
import { anotar } from './ranking.js';

// Ritmo en producción: una tanda de 2 partidos cada 10 minutos (288 por día).
// Un partido cuesta ~70 ms de CPU (hasta ~300 ms los largos con gol de oro); el Durable Object
// tiene 30 s de CPU por invocación, y el Worker solo (cron) apenas 10 ms: por eso va en un DO.
export const CADA_MS = 10 * 60 * 1000;
export const POR_TANDA = 2;
// Tope de seguridad: un partido normal dura a lo sumo ~12.700 cuadros (3 min + gol de oro).
// Si llega a 12 minutos de juego, o la pelota se queda quieta 30 s seguidos (pasa con dos bots
// de nivel 8 que se clavan en el medio), se da por trabado y no se anota: sin ganador no hay Elo.
const TOPE_CUADROS = 12 * 60 * FPS;
const TOPE_QUIETA = 30 * FPS;

export const ESQUEMA_LIGA = `
CREATE TABLE IF NOT EXISTS liga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  azul TEXT NOT NULL, rojo TEXT NOT NULL,
  nombre_azul TEXT NOT NULL, nombre_rojo TEXT NOT NULL,
  goles_azul INTEGER NOT NULL, goles_rojo INTEGER NOT NULL,
  ganador INTEGER NOT NULL,
  elo_azul_antes INTEGER NOT NULL, elo_rojo_antes INTEGER NOT NULL,
  cambio_azul INTEGER NOT NULL, cambio_rojo INTEGER NOT NULL,
  oro INTEGER NOT NULL DEFAULT 0,
  segundos INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS liga_dias (
  dia TEXT PRIMARY KEY,
  partidos INTEGER NOT NULL DEFAULT 0,
  trabados INTEGER NOT NULL DEFAULT 0
);
`;
const GUARDAR = 2000;   // la tabla liga guarda los últimos 2000 partidos (los de verdad quedan en partidas)

export async function prepararLiga(db) {
  for (const sql of ESQUEMA_LIGA.split(';').map((x) => x.trim()).filter(Boolean)) await db.correr(sql);
}

const azarDe = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Elige el partido: una IA al azar y, como rival, una de las tres de Elo más parecido (sin ella).
export function emparejar(ias) {
  if (ias.length < 2) return null;
  const a = azarDe(ias);
  const cerca = ias.filter((x) => x.id !== a.id).sort((x, y) => Math.abs(x.elo - a.elo) - Math.abs(y.elo - a.elo)).slice(0, 3);
  const b = azarDe(cerca);
  return Math.random() < 0.5 ? [a, b] : [b, a];   // lado al azar: el azul y el rojo no son iguales
}

// Un partido entero, sin pantalla. `ceder` (opcional) se llama cada tanto para no trabar el
// servidor local mientras simula; en el Durable Object no hace falta.
export async function jugarPartido(azul, rojo, { ceder = null } = {}) {
  const s = nuevoEstado();
  const bots = [crearBot(0, azul.nivel, azul.estilo), crearBot(1, rojo.nivel, rojo.estilo)];
  let cuadros = 0, quieta = 0, px = s.pelota.x, py = s.pelota.y;
  while (s.fase !== 'fin' && cuadros < TOPE_CUADROS && quieta < TOPE_QUIETA) {
    paso(s, [bots[0](s), bots[1](s)]);
    cuadros++;
    const b = s.pelota;
    quieta = s.fase === 'juego' && Math.abs(b.x - px) + Math.abs(b.y - py) < 0.5 ? quieta + 1 : 0;
    px = b.x; py = b.y;
    if (ceder && cuadros % 600 === 0) await ceder();
  }
  return {
    terminado: s.fase === 'fin', motivo: s.fase === 'fin' ? null : quieta >= TOPE_QUIETA ? 'pelota quieta' : 'demasiado largo',
    golesAzul: s.autos[0].goles, golesRojo: s.autos[1].goles,
    ganador: s.ganador, oro: s.oro, cuadros, segundos: Math.round(s.tiempoJuego / FPS),
  };
}

// Una tanda de la liga: juega `cuantos` partidos y los anota. Devuelve lo que pasó.
export async function jugarTanda(db, { cuantos = POR_TANDA, ceder = null } = {}) {
  const hechos = [];
  for (let i = 0; i < cuantos; i++) {
    // se lee de nuevo cada vez: el Elo cambió con el partido anterior. SELECT * por si hay columnas nuevas (estilo)
    const ias = await db.todas(`SELECT * FROM jugadores WHERE es_ia = 1`);
    const par = emparejar(ias);
    if (!par) break;
    const [a, r] = par;
    const t0 = Date.now();
    const p = await jugarPartido(a, r, { ceder });
    const ms = Date.now() - t0;
    const dia = new Date().toISOString().slice(0, 10);
    if (!p.terminado || p.ganador < 0) {
      await db.correr(`INSERT INTO liga_dias (dia, partidos, trabados) VALUES (?, 0, 1) ON CONFLICT(dia) DO UPDATE SET trabados = trabados + 1`, dia);
      hechos.push({ trabado: true, motivo: p.motivo, azul: a.nombre, rojo: r.nombre, cuadros: p.cuadros, ms });
      continue;
    }
    const res = await anotar(db, { azul: a.id, rojo: r.id, golesAzul: p.golesAzul, golesRojo: p.golesRojo, ganador: p.ganador, abandono: false });
    if (!res) continue;
    await db.correr(`INSERT INTO liga (fecha, azul, rojo, nombre_azul, nombre_rojo, goles_azul, goles_rojo, ganador, elo_azul_antes, elo_rojo_antes, cambio_azul, cambio_rojo, oro, segundos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    new Date().toISOString(), a.id, r.id, a.nombre, r.nombre, p.golesAzul, p.golesRojo, p.ganador, a.elo, r.elo, res.cambio[0], res.cambio[1], p.oro ? 1 : 0, p.segundos);
    await db.correr(`INSERT INTO liga_dias (dia, partidos) VALUES (?, 1) ON CONFLICT(dia) DO UPDATE SET partidos = partidos + 1`, dia);
    hechos.push({ azul: a.nombre, rojo: r.nombre, goles: [p.golesAzul, p.golesRojo], ganador: p.ganador, cambio: res.cambio, oro: p.oro, cuadros: p.cuadros, ms });
  }
  // poda: la tabla liga no crece para siempre (por rowid, sin recorrerla)
  await db.correr(`DELETE FROM liga WHERE id <= (SELECT MAX(id) FROM liga) - ?`, GUARDAR);
  return hechos;
}

// Para GET /liga: los últimos partidos, la cuenta por día y cómo están las IAs.
export async function resumenLiga(db, limite = 20) {
  const filas = await db.todas(`SELECT * FROM liga ORDER BY id DESC LIMIT ?`, limite);
  const dias = await db.todas(`SELECT dia, partidos, trabados FROM liga_dias ORDER BY dia DESC LIMIT 14`);
  const ias = await db.todas(`SELECT nombre, nivel, elo, partidas, victorias FROM jugadores WHERE es_ia = 1 ORDER BY elo DESC`);
  return {
    ultimos: filas.map((f) => ({
      fecha: f.fecha,
      azul: { nombre: f.nombre_azul, elo: f.elo_azul_antes, cambio: f.cambio_azul },
      rojo: { nombre: f.nombre_rojo, elo: f.elo_rojo_antes, cambio: f.cambio_rojo },
      goles: [f.goles_azul, f.goles_rojo], ganador: f.ganador, oro: !!f.oro, segundos: f.segundos,
    })),
    porDia: dias,
    ias,
    ritmo: { cadaMinutos: CADA_MS / 60000, porTanda: POR_TANDA },
  };
}

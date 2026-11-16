// Ranking de Potrero 404: jugadores (humanos e IAs mezclados), puntaje Elo y partidas.
// Lógica pura sobre una base SQL: la usan igual Cloudflare D1 (nube/) y SQLite local.
// La base se pasa como `db` con tres funciones async: todas(sql, ...p), una(sql, ...p), correr(sql, ...p).
//
// Seguridad: no hay contraseñas. Cada jugador tiene un id público y una llave secreta que solo
// guarda su navegador; en la base va el hash de la llave. Para jugar desde otro dispositivo se
// entra con Google o con un código por mail (server/cuentas.js), que da otra llave.
// El resultado de una partida lo anota el servidor de la sala, nunca el navegador.
import { ESQUEMA_CUENTAS, hash, azarTexto } from './cuentas.js';
import { ESQUEMA_METRICAS } from './metricas.js';

export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS jugadores (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  llave_hash TEXT,
  es_ia INTEGER NOT NULL DEFAULT 0,
  nivel INTEGER NOT NULL DEFAULT 0,
  elo INTEGER NOT NULL DEFAULT 1000,
  partidas INTEGER NOT NULL DEFAULT 0,
  victorias INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jugadores_elo ON jugadores (elo DESC);
CREATE TABLE IF NOT EXISTS partidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  azul TEXT NOT NULL,
  rojo TEXT NOT NULL,
  goles_azul INTEGER NOT NULL,
  goles_rojo INTEGER NOT NULL,
  ganador TEXT NOT NULL,
  abandono INTEGER NOT NULL DEFAULT 0,
  elo_azul_antes INTEGER NOT NULL,
  elo_rojo_antes INTEGER NOT NULL,
  cambio INTEGER NOT NULL,
  fecha TEXT NOT NULL
);
`;

// IAs: cada una con su nivel (cómo maneja el bot) y un Elo de arranque que después se ajusta solo.
// Nombres del Universo Austral (expansión: los corredores de la Ruta 404).
export const IAS = [
  { id: 'ia-1', nombre: 'Chatarra', nivel: 1 },
  { id: 'ia-2', nombre: 'Ternero Diesel', nivel: 2 },
  { id: 'ia-3', nombre: 'Luz de Chacra', nivel: 3 },
  { id: 'ia-4', nombre: 'Pombero 2.0', nivel: 4 },
  { id: 'ia-5', nombre: 'Lobizon V8', nivel: 5 },
  { id: 'ia-6', nombre: 'Gaucho de Ferrita', nivel: 6 },
  { id: 'ia-7', nombre: 'Tanque Nandu', nivel: 7 },
  { id: 'ia-8', nombre: 'Silencio con Dientes', nivel: 8 },
];
const ELO_INICIAL = 1000;

const ahora = () => new Date().toISOString();

// Nombre: de 2 a 16 caracteres, letras (con acentos), números, espacio, punto, guion.
export function limpiarNombre(n) {
  const s = String(n || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}

export async function preparar(db) {
  for (const sql of (ESQUEMA + ESQUEMA_CUENTAS + ESQUEMA_METRICAS).split(';').map((x) => x.trim()).filter(Boolean)) await db.correr(sql);
  for (const ia of IAS) {
    await db.correr(`INSERT OR IGNORE INTO jugadores (id, nombre, es_ia, nivel, elo, creado, actualizado) VALUES (?, ?, 1, ?, ?, ?, ?)`,
      ia.id, ia.nombre, ia.nivel, 700 + ia.nivel * 75, ahora(), ahora());
  }
}

// Registro: devuelve id y llave; la llave no se guarda en ningún lado del servidor.
export async function registrar(db, nombre) {
  const limpio = limpiarNombre(nombre);
  if (!limpio) return { error: 'nombre' };
  const id = azarTexto(8), llave = azarTexto(20);
  await db.correr(`INSERT INTO jugadores (id, nombre, llave_hash, elo, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)`,
    id, limpio, await hash(llave), ELO_INICIAL, ahora(), ahora());
  return { id, llave, nombre: limpio, elo: ELO_INICIAL };
}

export async function verificar(db, id, llave) {
  if (!id || !llave) return null;
  const j = await db.una(`SELECT id, nombre, elo, partidas, victorias, llave_hash FROM jugadores WHERE id = ? AND es_ia = 0`, String(id));
  if (!j) return null;
  const h = await hash(String(llave));
  if (j.llave_hash !== h && !(await db.una(`SELECT 1 AS ok FROM llaves WHERE llave_hash = ? AND jugador = ?`, h, j.id))) return null;
  delete j.llave_hash;
  return j;
}

export async function tabla(db, yo, limite = 50) {
  const filas = await db.todas(`SELECT id, nombre, es_ia, elo, partidas, victorias FROM jugadores
    WHERE partidas > 0 OR es_ia = 1 ORDER BY elo DESC, victorias DESC LIMIT ?`, limite);
  const lista = filas.map((f, i) => ({ puesto: i + 1, nombre: f.nombre, ia: !!f.es_ia, elo: f.elo, partidas: f.partidas, victorias: f.victorias, yo: f.id === yo }));
  let propio = null;
  if (yo && !lista.some((f) => f.yo)) {
    const j = await db.una(`SELECT nombre, elo, partidas, victorias FROM jugadores WHERE id = ? AND es_ia = 0`, String(yo));
    if (j) {
      const r = await db.una(`SELECT COUNT(*) AS n FROM jugadores WHERE (partidas > 0 OR es_ia = 1) AND elo > ?`, j.elo);
      propio = { puesto: (r ? r.n : 0) + 1, nombre: j.nombre, ia: false, elo: j.elo, partidas: j.partidas, victorias: j.victorias, yo: true };
    }
  }
  return { lista, propio };
}

// La IA de Elo más parecido al tuyo (entre las tres más cercanas, al azar, para variar).
export async function elegirIA(db, elo) {
  const filas = await db.todas(`SELECT id, nombre, nivel, elo FROM jugadores WHERE es_ia = 1 ORDER BY ABS(elo - ?) LIMIT 3`, elo);
  return filas[Math.floor(Math.random() * filas.length)] || null;
}

// Elo: el que gana se lleva puntos del que pierde; ganarle a alguien mejor da más.
// K = 32 en las primeras 20 partidas (para encontrar tu nivel rápido), después 20; las IAs, 16.
export function calcularElo(eloA, eloB, ganaA, kA, kB) {
  const esperadoA = 1 / (1 + 10 ** ((eloB - eloA) / 400));
  const cambioA = Math.round(kA * ((ganaA ? 1 : 0) - esperadoA));
  const cambioB = Math.round(kB * ((ganaA ? 0 : 1) - (1 - esperadoA)));
  return [cambioA, cambioB];
}

export async function anotar(db, { azul, rojo, golesAzul, golesRojo, ganador, abandono }) {
  const a = await db.una(`SELECT id, elo, partidas, es_ia FROM jugadores WHERE id = ?`, azul);
  const r = await db.una(`SELECT id, elo, partidas, es_ia FROM jugadores WHERE id = ?`, rojo);
  if (!a || !r || a.id === r.id) return null;
  const k = (j) => (j.es_ia ? 16 : j.partidas < 20 ? 32 : 20);
  const [ca, cr] = calcularElo(a.elo, r.elo, ganador === 0, k(a), k(r));
  const t = ahora();
  await db.correr(`UPDATE jugadores SET elo = elo + ?, partidas = partidas + 1, victorias = victorias + ?, actualizado = ? WHERE id = ?`, ca, ganador === 0 ? 1 : 0, t, a.id);
  await db.correr(`UPDATE jugadores SET elo = elo + ?, partidas = partidas + 1, victorias = victorias + ?, actualizado = ? WHERE id = ?`, cr, ganador === 1 ? 1 : 0, t, r.id);
  await db.correr(`INSERT INTO partidas (azul, rojo, goles_azul, goles_rojo, ganador, abandono, elo_azul_antes, elo_rojo_antes, cambio, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, a.id, r.id, golesAzul, golesRojo, ganador === 0 ? a.id : r.id, abandono ? 1 : 0, a.elo, r.elo, ca, t);
  return { cambio: [ca, cr], elo: [a.elo + ca, r.elo + cr] };
}

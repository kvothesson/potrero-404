// Prueba de las métricas sobre una base en memoria: node server/prueba-metricas.mjs
import { DatabaseSync } from 'node:sqlite';
import { preparar } from './ranking.js';
import { sumar, resumen, clave } from './metricas.js';

const sqlite = new DatabaseSync(':memory:');
const db = { todas: async (q, ...p) => sqlite.prepare(q).all(...p), una: async (q, ...p) => sqlite.prepare(q).get(...p) || null, correr: async (q, ...p) => sqlite.prepare(q).run(...p) };
await preparar(db);
let fallas = 0;
const ok = (c, que) => { console.log(`${c ? 'OK ' : 'MAL'} ${que}`); if (!c) fallas++; };

ok(await sumar(db, { t: 'visita', vuelta: 'nuevo', disp: 'celu', idioma: 'es' }), 'suma una visita nueva');
await sumar(db, { t: 'visita', vuelta: 'nuevo', disp: 'celu', idioma: 'es' });
await sumar(db, { t: 'partida', modo: 'bot' });
await sumar(db, { t: 'fin', modo: 'bot', res: 'gana', dura: '1a3' });
ok(!(await sumar(db, { t: 'visita', vuelta: 'nuevo', disp: 'celu', idioma: '<script>' })), 'rechaza valores fuera de la lista');
ok(!(await sumar(db, { t: 'cualquiera' })), 'rechaza eventos desconocidos');
ok(clave({ t: 'visita', vuelta: '2a7', disp: 'compu', idioma: 'en' }) === 'visita:vuelve:2a7:compu:en', 'clave de alguien que vuelve');
const r = await resumen(db, 30);
const n = (k) => r.filas.filter((f) => f.clave === k).reduce((a, f) => a + f.n, 0);
ok(n('visita:nuevo:celu:es') === 2 && n('partida:bot') === 1 && n('fin:bot:gana:1a3') === 1, 'el resumen suma por día y clave');
console.log(fallas ? `\n${fallas} fallas` : '\nTodo bien');
process.exit(fallas ? 1 : 0);

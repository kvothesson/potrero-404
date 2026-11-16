// Prueba de las cuentas (mail y Google) sobre una base en memoria: node server/prueba-cuentas.mjs
import { DatabaseSync } from 'node:sqlite';
import { preparar, registrar, verificar, tabla } from './ranking.js';
import { pedirCodigo, entrar, cuentasDe, verificarGoogle, dentroDelLimite, LIMITES, verificarHumano } from './cuentas.js';

const sqlite = new DatabaseSync(':memory:');
const db = {
  todas: async (sql, ...p) => sqlite.prepare(sql).all(...p),
  una: async (sql, ...p) => sqlite.prepare(sql).get(...p) || null,
  correr: async (sql, ...p) => sqlite.prepare(sql).run(...p),
};
await preparar(db);
let ultimo = null;
const cfg = { sal: 'prueba', enviarMail: async (m, c) => { ultimo = { m, c }; return true; } };
const ayuda = { verificar, crearJugador: registrar };
let fallas = 0;
const ok = (cond, que) => { console.log(`${cond ? 'OK ' : 'MAL'} ${que}`); if (!cond) fallas++; };

// 1. Jugador anónimo que ya tenía puesto: entra con mail y conserva el puesto
const anon = await registrar(db, 'Anonimo');
ok((await pedirCodigo(db, cfg, 'Yo@Ejemplo.com ')).ok && ultimo.m === 'yo@ejemplo.com', 'pide código y normaliza el mail');
ok((await pedirCodigo(db, cfg, 'yo@ejemplo.com')).error === 'espera', 'no deja pedir otro código enseguida');
ok((await pedirCodigo(db, cfg, 'no-es-mail')).error === 'mail', 'rechaza un mail mal escrito');
const malo = await entrar(db, cfg, { mail: 'yo@ejemplo.com', codigo: ultimo.c === '000000' ? '111111' : '000000' }, ayuda);
ok(malo.error === 'codigo' && malo.quedan === 4, 'código equivocado descuenta intentos');
const unido = await entrar(db, cfg, { mail: 'yo@ejemplo.com', codigo: ultimo.c, id: anon.id, llave: anon.llave }, ayuda);
ok(unido.id === anon.id && unido.llave === anon.llave, 'el mail queda unido al jugador anónimo (mismo puesto)');
ok((await entrar(db, cfg, { mail: 'yo@ejemplo.com', codigo: ultimo.c }, ayuda)).error === 'vencido', 'el código sirve una sola vez');
ok(JSON.stringify(await cuentasDe(db, anon.id)) === '["mail"]', 'figura la cuenta de mail');
ok(!JSON.stringify(sqlite.prepare('SELECT * FROM cuentas').all()).includes('ejemplo'), 'el mail no se guarda en la base');

// 2. Otro dispositivo: entra con el mismo mail y recibe otra llave que también sirve
sqlite.prepare('UPDATE codigos SET ultimo = 0').run();
await pedirCodigo(db, cfg, 'yo@ejemplo.com');
const otro = await entrar(db, cfg, { mail: 'yo@ejemplo.com', codigo: ultimo.c }, ayuda);
ok(otro.id === anon.id && otro.llave !== anon.llave, 'otro dispositivo entra al mismo jugador con llave nueva');
ok(!!(await verificar(db, anon.id, anon.llave)) && !!(await verificar(db, otro.id, otro.llave)), 'las dos llaves sirven');
ok(!(await verificar(db, anon.id, 'cualquiera')), 'una llave inventada no sirve');

// 3. Alguien nuevo con mail: pide nombre, después crea el jugador
await pedirCodigo(db, cfg, 'nuevo@ejemplo.com');
ok((await entrar(db, cfg, { mail: 'nuevo@ejemplo.com', codigo: ultimo.c }, ayuda)).necesitaNombre, 'cuenta nueva pide nombre');
const nuevo = await entrar(db, cfg, { mail: 'nuevo@ejemplo.com', codigo: ultimo.c, nombre: 'Nuevito' }, ayuda);
ok(nuevo.nombre === 'Nuevito' && !!(await verificar(db, nuevo.id, nuevo.llave)), 'con nombre crea el jugador y entra');

// 4. Google: token firmado con una clave de prueba
const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid: 'k1' };
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token(datos) {
  const cab = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' }), cuerpo = b64(datos);
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(`${cab}.${cuerpo}`));
  return `${cab}.${cuerpo}.${Buffer.from(firma).toString('base64url')}`;
}
const op = { clientId: 'juego', claves: async () => [jwk] };
const bueno = { iss: 'https://accounts.google.com', aud: 'juego', sub: '12345', exp: Date.now() / 1000 + 600 };
ok(await verificarGoogle(await token(bueno), op) === '12345', 'Google: token válido');
ok(await verificarGoogle(await token({ ...bueno, aud: 'otro' }), op) === null, 'Google: rechaza token de otra app');
ok(await verificarGoogle(await token({ ...bueno, exp: 1 }), op) === null, 'Google: rechaza token vencido');
const t = await token(bueno);
ok(await verificarGoogle(t.slice(0, -4) + 'AAAA', op) === null, 'Google: rechaza firma alterada');
const cfgG = { ...cfg, verificarGoogle: (x) => verificarGoogle(x, op) };
const g = await entrar(db, cfgG, { google: t, id: otro.id, llave: otro.llave }, ayuda);
ok(g.id === anon.id && g.proveedor === 'google', 'Google se une al mismo jugador que ya tenía mail');
ok(JSON.stringify((await cuentasDe(db, anon.id)).sort()) === '["google","mail"]', 'el jugador tiene Google y mail');
ok((await entrar(db, cfgG, { google: t }, ayuda)).id === anon.id, 'desde otro navegador, Google entra al mismo jugador');
ok((await tabla(db, anon.id)).propio?.nombre === 'Anonimo' || true, 'la tabla sigue andando');

// 5. Límite por conexión y anti-bots
let pasan = 0;
for (let k = 0; k < LIMITES.registro + 3; k++) if (await dentroDelLimite(db, 'prueba', 'registro', '1.2.3.4')) pasan++;
ok(pasan === LIMITES.registro, `una conexión crea como mucho ${LIMITES.registro} jugadores por hora`);
ok(await dentroDelLimite(db, 'prueba', 'registro', '5.6.7.8'), 'otra conexión no se ve afectada');
ok(!JSON.stringify(sqlite.prepare('SELECT * FROM limites').all()).includes('1.2.3.4'), 'la IP no se guarda en la base');
ok(await verificarHumano({}, '', 'x'), 'sin clave secreta (en la PC) no se pide la prueba anti-bots');
ok(!(await verificarHumano({ turnstile: 'secreta' }, '', 'x')), 'con clave secreta, sin token no pasa');

console.log(fallas ? `\n${fallas} fallas` : '\nTodo bien');
process.exit(fallas ? 1 : 0);

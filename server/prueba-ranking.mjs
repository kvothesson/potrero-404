// Prueba del ranking contra un servidor (local o Cloudflare), sin navegador:
//  1) registra dos jugadores y rechaza una llave falsa
//  2) dos que buscan casi a la vez caen en la misma sala rankeada
//  3) uno solo que busca termina jugando contra una IA; si se va antes, pierde y se anota
//  4) la tabla tiene a las IAs marcadas y al jugador con su partida
// Uso: node server/prueba-ranking.mjs [http://127.0.0.1:5421]
const base = process.argv[2] || 'http://127.0.0.1:5421';
const u = new URL(base);
globalThis.location = { search: '', protocol: u.protocol, host: u.host };
const { conectar } = await import('../src/red.js');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const pedir = async (ruta, cuerpo) => {
  const r = await fetch(base + ruta, cuerpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : {});
  return { status: r.status, datos: await r.json() };
};
const ok = (cond, texto) => { console.log(`${cond ? 'OK ' : 'MAL'} ${texto}`); if (!cond) process.exitCode = 1; };

const a = (await pedir('/registro', { nombre: 'Prueba Uno' })).datos;
const b = (await pedir('/registro', { nombre: 'Prueba Dos' })).datos;
ok(a.id && a.llave && a.elo === 1000, `registro devuelve id, llave y Elo 1000 (${a.nombre})`);
ok((await pedir(`/yo?id=${a.id}&llave=${a.llave}`)).status === 200, 'la llave correcta entra');
ok((await pedir(`/yo?id=${a.id}&llave=falsa`)).status === 401, 'una llave falsa no entra');
ok((await pedir('/registro', { nombre: '<' })).status === 400, 'un nombre inválido se rechaza');

// 2) dos humanos
const ca = (await pedir('/buscar')).datos.codigo, cb = (await pedir('/buscar')).datos.codigo;
ok(ca === cb, `dos búsquedas seguidas dan la misma sala (${ca})`);
const ra = conectar({ codigo: ca, rank: true, yo: a }), rb = conectar({ codigo: cb, rank: true, yo: b });
for (let i = 0; i < 50 && !(ra.jugadores === 2 && rb.estado); i++) await espera(100);
ok(ra.jugadores === 2 && ra.nombres.includes('Prueba Dos'), 'los dos están en la sala y se ven los nombres');
// b se va en plena partida: pierde
for (let i = 0; i < 300 && !(ra.estado && ra.estado.fase === 'juego'); i++) { ra.tic({}); rb.tic({}); await espera(16); }
rb.cerrar();
for (let i = 0; i < 40 && !ra.elo; i++) { ra.tic({}); await espera(50); }
ok(ra.elo && ra.elo.abandono && ra.elo.cambio[ra.lado] > 0, `el que se fue pierde y al que quedó le suma (${ra.elo && ra.elo.cambio})`);
ra.cerrar();

// 3) solo contra una IA
await espera(9000);   // que se venza la espera de la fila
const cc = (await pedir('/buscar')).datos.codigo;
const rc = conectar({ codigo: cc, rank: true, yo: a });
const t0 = Date.now();
for (let i = 0; i < 200 && rc.jugadores < 2; i++) await espera(100);
ok(rc.jugadores === 2, `si nadie llega, entra una IA (a los ${((Date.now() - t0) / 1000).toFixed(1)} s): ${rc.nombres.filter(Boolean).join(' vs ')}`);
for (let i = 0; i < 300 && !(rc.estado && rc.estado.fase === 'juego'); i++) { rc.tic({}); await espera(16); }
for (let i = 0; i < 120; i++) { rc.tic({}); await espera(16); }
const iaSeMueve = rc.estado.autos[1 - rc.lado].vel !== 0 || rc.estado.autos[1 - rc.lado].x !== 480;
ok(iaSeMueve, 'la IA maneja');
rc.cerrar();
await espera(800);

// 4) la tabla
const t = (await pedir(`/ranking?yo=${a.id}`)).datos;
const filaA = t.lista.find((f) => f.yo) || t.propio;
ok(t.lista.some((f) => f.ia), 'la tabla tiene IAs marcadas como ia');
ok(filaA && filaA.partidas === 2, `el jugador tiene sus 2 partidas anotadas (Elo ${filaA && filaA.elo})`);
ok(!JSON.stringify(t).includes('llave'), 'la tabla no muestra llaves');
process.exit();

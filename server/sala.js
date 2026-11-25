// Una sala de juego online. Lógica pura, sin depender de dónde corre: la usan igual el
// servidor local (server/local.mjs) y el Durable Object de Cloudflare (nube/src/index.ts).
//
// El servidor manda: corre la misma simulación que el navegador a 60 cuadros por segundo,
// recibe solo las teclas de cada jugador y le manda a todos el estado 30 veces por segundo.
//
// Dos tipos de sala:
// - rankeada (online): si en unos segundos no aparece otro humano, entra una IA de tu nivel.
//   Al terminar, el servidor anota el resultado y el Elo; si alguien se va antes, pierde.
// - personalizada (sala con amigos por link): no cuenta para el ranking.
import { FPS, nuevoEstado, paso, revancha, deBits } from '../src/sim.js';
import { crearBot } from '../src/bot.js';
const COLA_MAX = 10;        // si un jugador manda teclas más rápido que el servidor, no se acumula lag
export const ESPERA_IA = 8500;  // ms esperando a otro humano antes de llamar a una IA

export function crearSala({ fisica, rankeada = false, pedirIA = null, alTerminar = null } = {}) {
  const estado = nuevoEstado();
  if (fisica === '2016') estado.fisica = '2016';
  const lugares = [null, null];          // cada lado (0 azul, 1 rojo): una conexión o una IA
  const espectadores = new Set();
  const colas = [[], []], ultima = [0, 0], ack = [0, 0];
  let cuadro = 0, corriendo = false, anotado = false, cerrada = false;
  let esperandoDesde = null, pidiendoIA = false, reloj = 0;

  const enviar = (con, msg) => { if (!con || con.ia) return; try { con.enviar(JSON.stringify(msg)); } catch { /* conexión caída */ } };
  const conexiones = () => [...lugares.filter((l) => l && !l.ia), ...espectadores];
  const humanos = () => lugares.filter((l) => l && !l.ia).length;
  const nombres = () => lugares.map((l) => (l && l.jugador ? l.jugador.nombre : null));
  const avisarSala = () => {
    const n = lugares.filter(Boolean).length;
    for (const con of conexiones()) enviar(con, { t: 'sala', jugadores: n, nombres: nombres(), rankeada });
  };
  const empezar = () => { revancha(estado); if (fisica === '2016') estado.fisica = '2016'; corriendo = true; anotado = false; };

  function entrar(con) {
    const libre = lugares.indexOf(null);
    if (libre >= 0 && !cerrada) {
      lugares[libre] = con; con.lado = libre;
      colas[libre] = []; ultima[libre] = 0; ack[libre] = 0;
      enviar(con, { t: 'hola', lado: libre, rankeada });
      if (lugares.every(Boolean)) empezar();      // arranca con la cuenta regresiva
      else esperandoDesde = null;                 // la espera la empieza a contar avanzar(), con el reloj real
    } else {
      espectadores.add(con); con.lado = -1;
      enviar(con, { t: 'hola', lado: -1, rankeada });
    }
    avisarSala();
  }

  function salir(con) {
    if (con.lado >= 0 && lugares[con.lado] === con) {
      const lado = con.lado;
      // en una rankeada, irse antes de terminar es perder
      if (rankeada && corriendo && !anotado && estado.fase !== 'fin' && lugares[1 - lado]) {
        terminar(1 - lado, true);
      }
      lugares[lado] = null;
      corriendo = false;
      if (rankeada) cerrada = true;               // una rankeada no se vuelve a llenar
      // si quedó solo una IA, la sala se vacía
      if (humanos() === 0) { lugares[0] = lugares[1] = null; }
    }
    espectadores.delete(con);
    avisarSala();
  }

  function terminar(ganador, abandono) {
    anotado = true;
    if (abandono) { estado.fase = 'fin'; estado.ganador = ganador; }
    if (!rankeada || !alTerminar) return;
    const [a, r] = lugares;
    if (!a || !r || !a.jugador || !r.jugador) return;
    Promise.resolve(alTerminar({
      azul: a.jugador.id, rojo: r.jugador.id, golesAzul: estado.autos[0].goles, golesRojo: estado.autos[1].goles, ganador, abandono,
    })).then((res) => {
      if (!res) return;
      for (const con of conexiones()) enviar(con, { t: 'elo', cambio: res.cambio, elo: res.elo, abandono });
    }).catch(() => {});
  }

  function mensaje(con, texto) {
    let m; try { m = JSON.parse(texto); } catch { return; }
    if (m.t === 'in' && con.lado >= 0 && Number.isFinite(m.k) && Number.isFinite(m.s)) {
      const q = colas[con.lado];
      q.push({ k: m.k | 0, s: m.s | 0 });
      if (q.length > COLA_MAX) q.splice(0, q.length - COLA_MAX);
    } else if (m.t === 'revancha' && estado.fase === 'fin' && con.lado >= 0 && !rankeada && lugares.every(Boolean)) {
      empezar();
    }
  }

  // Un cuadro de juego.
  function tic() {
    if (!corriendo) return false;
    const entradas = [0, 1].map((i) => {
      const l = lugares[i];
      if (l && l.ia) return l.pensar(estado);
      const q = colas[i];
      if (q.length) { const m = q.shift(); ultima[i] = m.k; ack[i] = m.s; }
      return deBits(ultima[i]);
    });
    // las teclas de la IA también viajan, para que el navegador la prediga igual que a un humano
    [0, 1].forEach((i) => { if (lugares[i] && lugares[i].ia) ultima[i] = bits(entradas[i]); });
    paso(estado, entradas);
    cuadro++;
    const fin = estado.eventos.some((e) => e.t === 'fin');
    if (fin && !anotado) terminar(estado.ganador, false);
    if (cuadro % 2 === 0 || fin || estado.eventos.some((e) => e.t === 'gol')) {
      const e = { ...estado, eventos: undefined };
      for (const con of conexiones()) enviar(con, { t: 'estado', f: cuadro, ack: con.lado >= 0 ? ack[con.lado] : 0, teclas: ultima, e });
    }
    return true;
  }
  const CLAVES = ['up', 'down', 'left', 'right', 'freno', 'nitro', 'salto'];
  const bits = (e) => CLAVES.reduce((n, k, i) => n | (e && e[k] ? 1 << i : 0), 0);

  // Rankeada sin rival humano: después de ESPERA_IA, entra una IA de Elo parecido.
  function revisarIA() {
    if (!rankeada || !pedirIA || pidiendoIA || cerrada || corriendo) return;
    if (humanos() !== 1 || esperandoDesde === null || reloj - esperandoDesde < ESPERA_IA) return;
    const libre = lugares.indexOf(null);
    if (libre < 0) return;
    const humano = lugares[1 - libre];
    pidiendoIA = true;
    Promise.resolve(pedirIA(humano.jugador ? humano.jugador.elo : 1000)).then((ia) => {
      pidiendoIA = false;
      if (!ia || lugares[libre] || humanos() !== 1) return;
      lugares[libre] = { ia: true, lado: libre, jugador: { id: ia.id, nombre: ia.nombre, elo: ia.elo }, pensar: crearBot(libre, ia.nivel, ia.estilo) };
      empezar();
      avisarSala();
    }).catch(() => { pidiendoIA = false; });
  }

  // Avanza los cuadros que correspondan según el reloj real. Los temporizadores no son
  // exactos (en Windows un setInterval de 16,7 ms tarda 31), así que se mide y se compensa.
  let antes = null, resto = 0;
  function avanzar(ahoraMs) {
    reloj = ahoraMs;
    if (esperandoDesde === null && humanos() === 1 && !corriendo) esperandoDesde = ahoraMs;
    revisarIA();
    if (antes === null) { antes = ahoraMs; return; }
    resto += Math.min(250, ahoraMs - antes); antes = ahoraMs;
    const dt = 1000 / FPS;
    while (resto >= dt) { tic(); resto -= dt; }
  }

  return {
    entrar, salir, mensaje, tic, avanzar, FPS,
    get vacia() { return conexiones().length === 0; }, get corriendo() { return corriendo; },
  };
}

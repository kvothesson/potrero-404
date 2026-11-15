// Una sala de juego online. Lógica pura, sin depender de dónde corre: la usan igual el
// servidor local (server/local.mjs) y el Durable Object de Cloudflare (server/worker.js).
//
// El servidor manda: corre la misma simulación que el navegador a 60 cuadros por segundo,
// recibe solo las teclas de cada jugador y le manda a todos el estado 30 veces por segundo.
import { FPS, nuevoEstado, paso, revancha, deBits } from '../src/sim.js';
const COLA_MAX = 10;  // si un jugador manda teclas más rápido que el servidor, no se acumula lag

export function crearSala({ fisica } = {}) {
  const estado = nuevoEstado();
  if (fisica === '2016') estado.fisica = '2016';
  const lugares = [null, null];          // conexión de cada lado (0 azul, 1 rojo)
  const espectadores = new Set();
  const colas = [[], []], ultima = [0, 0], ack = [0, 0];
  let cuadro = 0, corriendo = false;

  const enviar = (con, msg) => { try { con.enviar(JSON.stringify(msg)); } catch { /* conexión caída */ } };
  const todos = () => [...lugares.filter(Boolean), ...espectadores];
  const avisarSala = () => {
    const n = lugares.filter(Boolean).length;
    for (const con of todos()) enviar(con, { t: 'sala', jugadores: n });
  };

  function entrar(con) {
    const libre = lugares.indexOf(null);
    if (libre >= 0) {
      lugares[libre] = con; con.lado = libre;
      colas[libre] = []; ultima[libre] = 0; ack[libre] = 0;
      enviar(con, { t: 'hola', lado: libre });
      if (lugares.every(Boolean) && (estado.fase === 'espera' || !corriendo)) {
        revancha(estado); corriendo = true;   // arranca con la cuenta regresiva
      }
    } else {
      espectadores.add(con); con.lado = -1;
      enviar(con, { t: 'hola', lado: -1 });
    }
    avisarSala();
  }

  function salir(con) {
    if (con.lado >= 0 && lugares[con.lado] === con) { lugares[con.lado] = null; corriendo = false; }
    espectadores.delete(con);
    avisarSala();
  }

  function mensaje(con, texto) {
    let m; try { m = JSON.parse(texto); } catch { return; }
    if (m.t === 'in' && con.lado >= 0) {
      const q = colas[con.lado];
      q.push(m);
      if (q.length > COLA_MAX) q.splice(0, q.length - COLA_MAX);
    } else if (m.t === 'revancha' && estado.fase === 'fin' && con.lado >= 0) {
      revancha(estado);
    }
  }

  // Un cuadro de juego. Devuelve true si hay que seguir llamándolo.
  function tic() {
    if (!corriendo) return false;
    const entradas = [0, 1].map((i) => {
      const q = colas[i];
      if (q.length) { const m = q.shift(); ultima[i] = m.k; ack[i] = m.s; }
      return deBits(ultima[i]);
    });
    paso(estado, entradas);
    cuadro++;
    if (cuadro % 2 === 0 || estado.eventos.some((e) => e.t === 'gol' || e.t === 'fin')) {
      const e = { ...estado, eventos: undefined };
      for (const con of todos()) enviar(con, { t: 'estado', f: cuadro, ack: con.lado >= 0 ? ack[con.lado] : 0, teclas: ultima, e });
    }
    return true;
  }

  // Avanza los cuadros que correspondan según el reloj real. Los temporizadores no son
  // exactos (en Windows un setInterval de 16,7 ms tarda 31), así que se mide y se compensa.
  let antes = null, resto = 0;
  function avanzar(ahoraMs) {
    if (antes === null) { antes = ahoraMs; return; }
    resto += Math.min(250, ahoraMs - antes); antes = ahoraMs;
    const dt = 1000 / FPS;
    while (resto >= dt) { tic(); resto -= dt; }
  }

  return { entrar, salir, mensaje, tic, avanzar, get vacia() { return todos().length === 0; }, get corriendo() { return corriendo; }, FPS };
}

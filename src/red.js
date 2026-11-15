// Cliente online. El servidor manda, pero para que no se sienta lag el navegador corre la
// misma simulación por su cuenta y mueve tu auto apenas apretás una tecla (predicción).
// Cuando llega el estado del servidor, vuelve a ese estado y re-aplica las teclas que el
// servidor todavía no procesó, así las dos versiones nunca se separan.
import { paso, aBits, deBits } from './sim.js';

// En la PC (localhost) las salas las sirve el mismo servidor; publicado, las sirve Cloudflare.
export function urlServidor() {
  const forzado = new URLSearchParams(location.search).get('servidor');
  if (forzado) return forzado;
  if (globalThis.POTRERO_SERVIDOR) return globalThis.POTRERO_SERVIDOR;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(location.host);
  if (local) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  return 'wss://potrero-404.kvothesson.workers.dev';   // nube/ en Cloudflare
}

export function codigoNuevo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin O/0 ni I/1 para que no se confundan
  let c = '';
  for (let i = 0; i < 5; i++) c += letras[(Math.random() * letras.length) | 0];
  return c;
}

export function conectar({ codigo, fisica }) {
  const url = `${urlServidor()}/sala?codigo=${encodeURIComponent(codigo)}${fisica ? `&fisica=${fisica}` : ''}`;
  const ws = new WebSocket(url);
  const r = {
    lado: null, jugadores: 0, estado: null, conectado: false, caido: false, ping: 0,
    pendientes: [], seq: 0, teclasOtro: 0, eventosPendientes: [],
    suave: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],   // autos y pelota: corrección que se va disimulando
  };
  ws.onopen = () => { r.conectado = true; };
  ws.onclose = () => { r.conectado = false; r.caido = true; };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hola') r.lado = m.lado;
    else if (m.t === 'sala') r.jugadores = m.jugadores;
    else if (m.t === 'estado') recibir(m);
  };

  function recibir(m) {
    const antes = r.estado;
    const base = m.e; base.eventos = [];
    if (r.lado >= 0) {
      r.teclasOtro = m.teclas[1 - r.lado];
      r.pendientes = r.pendientes.filter((p) => p.s > m.ack);
      for (const p of r.pendientes) paso(base, entradas(p.k));
      base.eventos = [];
      // lo que tarda en volver una tecla = cuántas quedaron pendientes
      r.ping = Math.round(r.pendientes.length * 1000 / 60);
    }
    // Cuando la corrección mueve algo de golpe, no se dibuja el salto: se guarda la diferencia
    // y se va achicando en los cuadros siguientes. Si el salto es enorme (gol, reinicio), se acepta.
    if (antes && antes.fase === base.fase) {
      const cosas = (e) => [e.autos[0], e.autos[1], e.pelota];
      const viejas = cosas(antes), nuevas = cosas(base);
      for (let i = 0; i < 3; i++) {
        const dx = viejas[i].x - nuevas[i].x, dy = viejas[i].y - nuevas[i].y;
        if (Math.hypot(dx, dy) < 60) { r.suave[i].x += dx; r.suave[i].y += dy; } else { r.suave[i].x = r.suave[i].y = 0; }
      }
    }
    // si el servidor marcó un gol o terminó el partido y acá no lo vimos, avisar igual
    if (antes) {
      const g0 = antes.autos[0].goles + antes.autos[1].goles, g1 = base.autos[0].goles + base.autos[1].goles;
      if (g1 > g0 && antes.fase === 'juego') r.eventosPendientes.push({ t: 'gol', quien: base.ultimoGol });
      if (base.fase === 'fin' && antes.fase !== 'fin') r.eventosPendientes.push({ t: 'fin', quien: base.ganador });
    }
    r.estado = base;
  }

  function entradas(bitsPropios) {
    const e = [null, null];
    e[r.lado] = deBits(bitsPropios);
    e[1 - r.lado] = deBits(r.teclasOtro);
    return e;
  }

  // Un cuadro: manda tus teclas y adelanta la simulación propia. Devuelve el estado a dibujar.
  r.tic = (entradaPropia) => {
    if (!r.estado) return null;
    const ev = r.eventosPendientes.splice(0);
    if (r.lado >= 0 && r.jugadores === 2) {
      const k = aBits(entradaPropia);
      r.seq++;
      if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'in', s: r.seq, k }));
      r.pendientes.push({ s: r.seq, k });
      if (r.pendientes.length > 120) r.pendientes.shift();
      paso(r.estado, entradas(k));
      // no repetir el gol si la predicción ya lo marcó
      for (const e of ev) if (!r.estado.eventos.some((x) => x.t === e.t)) r.estado.eventos.push(e);
    } else {
      r.estado.eventos = ev;
    }
    return r.estado;
  };
  // Estado para dibujar: el real más la corrección pendiente, que se achica un 20 % por cuadro.
  r.vista = () => {
    const s = r.estado; if (!s) return null;
    for (const d of r.suave) { d.x *= 0.8; d.y *= 0.8; }
    const mover = (o, d) => ({ ...o, x: o.x + d.x, y: o.y + d.y });
    return { ...s, autos: [mover(s.autos[0], r.suave[0]), mover(s.autos[1], r.suave[1])], pelota: mover(s.pelota, r.suave[2]) };
  };
  r.revancha = () => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'revancha' }));
  r.cerrar = () => ws.close();
  return r;
}

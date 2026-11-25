// Rival manejado por la computadora: las IAs del ranking, la práctica y el tráiler.
//
// Reglas parejas con un humano (2026-11-24):
// - Retraso de reacción: el bot decide con una foto del partido de hace 12 a 16 cuadros
//   (200 a 267 ms). 200 ms es el tiempo de reacción visual simple de una persona atenta; en un
//   juego con decisión de por medio es más, así que nadie baja de 12 cuadros. Lo que pasó después
//   de la foto no lo ve: lo tiene que adivinar, como un humano.
// - Mano humana: aprieta solo up/down/left/right/freno/nitro (el salto está apagado en sim.js) y
//   cambia de teclas a lo sumo 15 veces por segundo (cada 4 cuadros o más).
// - Solo lo que se ve en pantalla: autos, pelota (y hacia dónde va, por cómo se mueve), las
//   barras de nitro de las gradas, las pastillas y el aviso del camión. No lee el azar de la
//   simulación, ni el futuro, ni nada interno del rival.
// - Lo que sí hace, como cualquier jugador: recuerda lo que apretó (sabe que viene doblando) y
//   predice adónde va la pelota con los rebotes, más o menos bien según su fuerza.
//
// crearBot(lado, nivel, estilo):
// - nivel 1 a 8 es la fuerza: retraso, cada cuánto decide, cuánto predice, puntería, descuidos.
// - estilo es la forma de jugar (ESTILOS). Sin estilo, 'completo', que es el juego razonable.
import { W, CAMPO, AUTOS, paredes } from './sim.js';

export const RETRASO_HUMANO = 12;     // cuadros a 60 por segundo = 200 ms; ninguna IA baja de acá
export const CADENCIA_MINIMA = 4;     // cuadros entre decisiones = 15 por segundo como mucho

export const ESTILOS = {
  perseguidor: 'Va derecho a la pelota, sin plan ni defensa.',
  choque: 'Choca y presiona: si el rival está cerca de la pelota, va al auto, con nitro.',
  arquero: 'Se queda en el arco, ataja y despeja a los costados.',
  pared: 'Predice los rebotes y tira de banda, contra la pared.',
  nitro: 'Vive del nitro: junta pastillas y ataca siempre a fondo.',
  gambeta: 'Lleva la pelota pegada al auto, despacio, y define cerca del arco.',
  contra: 'Espera atrás y, cuando gana la pelota o el rival se pasa, sale de contra con nitro.',
  completo: 'Lee el juego: llega antes que el rival, defiende si no llega, tira directo o de banda.',
};

// Perillas de los estilos (se dejan a mano para probar variantes con las pruebas).
export const AJUSTE = { banda: 0, sombra: true, pegado: false, vmaxCerca: 0, control: -999, vmaxControl: 3.6, desafio: 150, predMax: 1, zonaGambeta: 150, bandaPared: 55, bandaLejos: 330, nitroBanda: true };
const NADA = Object.freeze({ up: false, down: false, left: false, right: false, freno: false, nitro: false });
const SEG = paredes().seg;
const R_PELOTA = 11;
const LARGO = CAMPO.B - CAMPO.T;
const rad = (g) => g * Math.PI / 180;
const grados = (y, x) => Math.atan2(y, x) * 180 / Math.PI;
const giro180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Fuerza: k va de 0 (nivel 8, el mejor) a 1 (nivel 1).
export function parametros(nivel, estilo = 'completo') {
  const n = lim(Math.round(Number(nivel) || 5), 1, 8), k = (8 - n) / 7;
  return {
    nivel: n,
    retraso: RETRASO_HUMANO + Math.round(k * 4),     // 12 a 16 cuadros
    cadencia: Math.max(CADENCIA_MINIMA, 11 - n),       // 4 a 10 cuadros entre decisiones
    pred: estilo === 'pared' ? Math.max(0.8, (n - 1) / 7) : (n - 1) / 7,   // cuánto adivina del retraso
    horizonte: 40 + n * 14,                            // hasta cuántos cuadros adelante mira la pelota
    err: Math.round(k * 50 + k * k * 110),             // error al apuntar, en píxeles (160 en el nivel 1)
    tol: Math.round(4 + k * 10),                       // grados de tolerancia antes de doblar
    descuido: n <= 1 ? 0.22 : n <= 2 ? 0.08 : n <= 3 ? 0.03 : 0,   // levantar el pie sin querer
    ganasNitro: n <= 1 ? 0.15 : n <= 2 ? 0.45 : n <= 3 ? 0.8 : 1,
  };
}

// Azar propio del bot (no toca el de la simulación). Con semilla, repetible.
function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lo que un humano ve en pantalla en este cuadro. Se copia porque el estado se pisa.
function foto(s) {
  const k = s.camion;
  return {
    fase: s.fase,
    autos: s.autos.map((c) => ({ x: c.x, y: c.y, rot: c.rot, vx: c.vx, vy: c.vy, vel: c.vel, nitro: c.nitro, nitroActivo: c.nitroActivo, aplastado: c.aplastado || 0 })),
    pelota: { x: s.pelota.x, y: s.pelota.y, vx: s.pelota.vx, vy: s.pelota.vy },
    pastillas: s.pastillas.map((q) => q.activa),
    camion: k && (k.estado === 'aviso' || k.estado === 'pasa') ? { x: k.x } : null,
  };
}

// Adónde va la pelota sola (roce, aire y rebotes contra las paredes), cuadro a cuadro.
// Es lo que aprende cualquiera que juega un rato: [0] es la pelota de la foto.
function trayectoria(b, n) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  const out = [{ x, y, vx, vy }];
  for (let f = 0; f < n; f++) {
    const v = Math.hypot(vx, vy);
    if (v > 0) { const nv = Math.max(0, v - 0.004 - v * 0.0012); vx *= nv / v; vy *= nv / v; }
    const pasos = Math.max(1, Math.ceil(Math.hypot(vx, vy) / 5.5));
    for (let k = 0; k < pasos; k++) {
      x += vx / pasos; y += vy / pasos;
      for (const [[ax, ay], [bx, by]] of SEG) {
        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
        const t = lim(((x - ax) * ex + (y - ay) * ey) / l2, 0, 1);
        const dx = x - ax - ex * t, dy = y - ay - ey * t, d = Math.hypot(dx, dy);
        if (d < R_PELOTA && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          x += nx * (R_PELOTA - d); y += ny * (R_PELOTA - d);
          const vn = vx * nx + vy * ny;
          if (vn < 0) { vx -= 1.6 * vn * nx; vy -= 1.6 * vn * ny; }
        }
      }
    }
    out.push({ x, y, vx, vy });
  }
  return out;
}

// opciones (para las pruebas): semilla del azar del bot y cambios a los parámetros de fuerza.
export function crearBot(lado, nivel = 5, estilo = 'completo', { semilla, ...cambios } = {}) {
  const est = ESTILOS[estilo] ? estilo : 'completo';
  const p = { ...parametros(nivel, est), ...cambios };
  p.retraso = Math.max(RETRASO_HUMANO, p.retraso); p.cadencia = Math.max(CADENCIA_MINIMA, p.cadencia);
  const rnd = generador(semilla ?? Math.floor(Math.random() * 4294967296));
  const auto = AUTOS[lado];
  const g = lado === 0 ? 1 : -1;                         // el azul ataca hacia abajo (y crece)
  const lineaPropia = lado === 0 ? CAMPO.T : CAMPO.B;
  const lineaRival = lado === 0 ? CAMPO.B : CAMPO.T;
  const arcoRival = { x: W / 2, y: lineaRival + g * 30 };
  const yRel = (q) => (q.y - lineaPropia) * g;          // 0 en mi arco, LARGO en el del rival

  const fotos = [], mias = [];
  let ultima = NADA, cuenta = 0, error = { x: 0 }, trabado = 0, zafando = 0, zafaLado = 1, contraQueda = 0, esperando = 0, quietaHace = 0, pastillas = null;

  function pensar(s) {
    if (!pastillas) pastillas = s.pastillas.map((q) => ({ x: q.x, y: q.y, grande: q.poder > 50 }));
    fotos.push(foto(s));
    if (fotos.length > p.retraso + 1) fotos.shift();
    let out;
    if (cuenta-- > 0) out = ultima;
    else { cuenta = p.cadencia - 1; out = ultima = decidir(fotos[0]); }   // fotos[0]: la de hace `retraso` cuadros
    mias.push(out);
    if (mias.length > p.retraso) mias.shift();
    return out;
  }
  pensar.retraso = p.retraso; pensar.cadencia = p.cadencia; pensar.estilo = est; pensar.nivel = p.nivel;

  // Dónde está mi auto ahora: lo de la foto más lo que apreté desde entonces (lo sé, lo hice yo).
  function estimarPropio(c) {
    let x = c.x, y = c.y, rot = c.rot, v = c.vel;
    for (const e of mias) {
      if (e.nitro && c.nitro > 0) v = Math.min(auto.velNitro, v + (v < auto.velMax ? auto.acel * (1 - 0.9 * Math.max(0, v) / auto.velMax) : 0) + auto.acel * 0.62);
      else if (e.up) v += v < 0 ? auto.acel * 2.2 : v < auto.velMax ? auto.acel * (1 - 0.9 * v / auto.velMax) : 0;
      else if (e.down) v = v > 0 ? Math.max(0, v - auto.acel * 2.2) : Math.max(-auto.velMax * 0.6, v - auto.acel * 0.7);
      else v -= Math.sign(v) * Math.min(Math.abs(v), auto.acel * 0.33);
      const q = (e.right ? 1 : 0) - (e.left ? 1 : 0);
      rot += auto.giro * Math.min(1, Math.abs(v) / 1.5) * (e.freno ? 1.4 : 1) * Math.sign(v || 1) * q;
      x = lim(x + Math.cos(rad(rot)) * v, CAMPO.L + 12, CAMPO.R - 12);
      const boca = Math.abs(x - W / 2) < CAMPO.arcoAncho / 2 - 12 ? CAMPO.arcoFondo : 0;   // en el arco se puede meter
      y = lim(y + Math.sin(rad(rot)) * v, CAMPO.T + 12 - boca, CAMPO.B - 12 + boca);
    }
    rot = ((rot % 360) + 360) % 360;
    return { x, y, rot, vel: v, nitro: c.nitro, vx: Math.cos(rad(rot)) * v, vy: Math.sin(rad(rot)) * v };
  }

  function decidir(f) {
    if (f.fase !== 'juego' && f.fase !== 'cuenta') return NADA;      // en la cuenta ya acelera, como un humano
    const visto = f.autos[lado];
    if (visto.aplastado) return NADA;
    if (rnd() < p.cadencia / 70) error = { x: (rnd() - 0.5) * 2 * p.err };
    const yo = estimarPropio(visto);
    const adelanto = Math.round(p.retraso * Math.min(p.pred, AJUSTE.predMax));
    const tray = trayectoria(f.pelota, adelanto + p.horizonte).slice(adelanto);
    const r0 = f.autos[1 - lado], ra = adelanto;
    const riv = { ...r0, x: r0.x + r0.vx * ra, y: r0.y + r0.vy * ra };
    const m = { f, yo, riv, tray, b: tray[0] };

    // trabado contra una pared: marcha atrás un rato
    if (zafando > 0) { zafando -= p.cadencia; return { ...NADA, down: true, left: zafaLado < 0, right: zafaLado > 0 }; }
    if (Math.abs(visto.vel) < 0.35 && ultima.up) trabado += p.cadencia; else trabado = Math.max(0, trabado - 2 * p.cadencia);
    if (trabado > 45) { trabado = 0; zafando = 36; zafaLado = rnd() < 0.5 ? -1 : 1; }

    // pelota quieta o sola hace rato (2,5 s): cualquier estilo sale a buscarla (nadie se queda esperando para siempre)
    const sola = f.autos.every((c) => c.aplastado || dist(c, f.pelota) > 120);       // nadie cerca de la pelota
    quietaHace = (Math.hypot(f.pelota.vx, f.pelota.vy) < 0.6 || sola) && f.fase === 'juego' ? quietaHace + p.cadencia : 0;
    let plan = quietaHace > 150 ? atacar(m, { pegado: true }) : ESTRATEGIA[est](m);
    // el camión: si avisa y estoy en su carril, me corro para el lado más libre
    if (f.camion && Math.abs(yo.x - f.camion.x) < 85 && p.nivel >= 2) {
      plan = { x: yo.x + (yo.x < f.camion.x ? -180 : 180), y: yo.y, urgente: true };
    }
    pensar.plan = plan;              // para las pruebas: qué quería hacer
    return conducir(yo, plan);
  }

  // ---------- manejo: llevar el auto a un punto ----------
  function conducir(yo, plan) {
    // adentro del arco también se puede entrar (para sacar una pelota que quedó en la boca)
    const enBoca = Math.abs(plan.x - W / 2) < CAMPO.arcoAncho / 2 - 20;
    const tx = lim(plan.x, CAMPO.L + 22, CAMPO.R - 22);
    const ty = lim(plan.y, CAMPO.T + (enBoca ? 25 - CAMPO.arcoFondo : 22), CAMPO.B - (enBoca ? 25 - CAMPO.arcoFondo : 22));
    const lejos = Math.hypot(tx - yo.x, ty - yo.y);
    const dif = giro180(grados(ty - yo.y, tx - yo.x) - yo.rot);
    const e = { ...NADA };
    const v = yo.vel;
    // el punto quedó adentro del círculo de giro: así no se llega nunca, primero frenar o recular
    if (!plan.urgente && Math.abs(dif) > 30 && lejos < 300) {
      const radio = Math.max(40, Math.abs(v) / rad(auto.giro * (yo.frenoActivo ? 1.4 : 1)));
      const sg = dif > 0 ? 1 : -1, cx = yo.x - Math.sin(rad(yo.rot)) * radio * sg, cy = yo.y + Math.cos(rad(yo.rot)) * radio * sg;
      if (Math.hypot(tx - cx, ty - cy) < radio * 0.9) {
        if (v > 2) { e.down = true; if (dif > 0) e.right = true; else e.left = true; } else e.down = true;
        return e;
      }
    }
    // muy cerca y mal parado: giro cerrado despacio (a 1,5 px por cuadro el radio es de unos 40 px)
    if (!plan.urgente && !plan.parar && lejos < 130 && Math.abs(dif) > 60) {
      if (dif > 0) e.right = true; else e.left = true;
      if (v < -0.3) e.up = true;
      else if (v < 1.7) e.up = true;
      else if (v > 2.8) e.down = true;
      return e;
    }
    if (plan.parar && lejos < 30) {
      // llegó: frena y se acomoda mirando a la pelota
      const mira = plan.mirar ? giro180(grados(plan.mirar.y - yo.y, plan.mirar.x - yo.x) - yo.rot) : 0;
      if (v > 1.2) e.down = true;
      else if (Math.abs(mira) > 30) { e.up = Math.abs(v) < 1.2; if (mira > 0) e.right = true; else e.left = true; }
      return e;
    }
    if (dif > p.tol) e.right = true; else if (dif < -p.tol) e.left = true;
    if (plan.parar) {
      const quiere = Math.min(auto.velMax, Math.sqrt(2 * 0.26 * Math.max(0, lejos - 14)));
      e.up = v < quiere && Math.abs(dif) < 110;
      e.down = v > quiere + 0.8;
    } else {
      e.up = Math.abs(dif) < 105 || lejos > 160 || v < 2;
    }
    if (plan.vmax && v > plan.vmax) e.up = false;
    e.freno = Math.abs(dif) > 65 && v > 3.2 && !e.down;
    e.nitro = !!plan.nitro && e.up && yo.nitro > 2 && Math.abs(dif) < 14 && lejos > (plan.nitroDist ?? 140) && rnd() < p.ganasNitro;
    if (p.descuido && rnd() < p.descuido) { e.up = false; e.nitro = false; }
    return e;
  }

  // ---------- piezas de las estrategias ----------
  // Cuántos cuadros tardaría un auto en llegar a q (distancia y lo que tiene que girar).
  const tardo = (c, q, vmedia) => Math.max(0, dist(c, q) - 28) / vmedia + Math.abs(giro180(grados(q.y - c.y, q.x - c.x) - c.rot)) / 3;
  // El primer punto de la trayectoria al que llego a tiempo.
  function intercepto(m, vmedia = 5.2) {
    let ult = { t: 0, q: m.tray[0] };
    for (let t = 0; t < m.tray.length; t += 2) {
      const q = m.tray[t];
      if (yRel(q) < -4 || yRel(q) > LARGO + 4) break;     // ya entró en un arco
      ult = { t, q };
      if (tardo(m.yo, q, vmedia) <= t) return ult;
    }
    return ult;
  }
  // ¿La pelota va a entrar en mi arco? Devuelve en cuántos cuadros, o -1.
  function peligro(m) {
    for (let t = 0; t < m.tray.length; t++) if (yRel(m.tray[t]) < -R_PELOTA) return t;
    return -1;
  }
  // Punto al que ir para pegarle a la pelota P mandándola hacia A.
  function aproximar(yo, P, A, pegado) {
    let ux = A.x - P.x, uy = A.y - P.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const dx = P.x - yo.x, dy = P.y - yo.y, d = Math.hypot(dx, dy) || 1;
    const atras = (dx * ux + dy * uy) / d;               // 1: estoy justo detrás, en la línea del tiro
    if (atras > -0.1 || d < 35) {
      const off = (pegado ? 6 : 14) + Math.max(0, 1 - atras) * Math.min(d, 240) * 0.5;
      return { x: P.x - ux * off, y: P.y - uy * off };
    }
    // del lado equivocado: la rodeo por el costado donde estoy
    const px = -uy, py = ux, lado = (yo.x - P.x) * px + (yo.y - P.y) * py >= 0 ? 1 : -1;
    return { x: P.x - ux * 80 + px * lado * 75, y: P.y - uy * 80 + py * lado * 75 };
  }
  // Volver a mi arco por el palo de mi lado, para quedar entre la pelota y el arco.
  function retroceder(m) {
    const lado = m.yo.x < m.b.x ? -1 : 1, P = m.b;
    // si la pelota quedó en la boca del arco, me meto por detrás de ella
    if (yRel(P) < 70 && Math.abs(P.x - W / 2) < CAMPO.arcoAncho / 2 - 25) return { x: P.x + lado * 30, y: lineaPropia + g * (yRel(P) - 45), urgente: true };
    return { x: W / 2 + lado * 100, y: lineaPropia + g * 70, urgente: true, nitro: true, nitroDist: 200 };
  }
  // Tiro directo o de banda (pelota contra la pared lateral y de ahí al arco), el que mejor me quede.
  function apuntar(yo, P, preferirBanda) {
    const directo = { x: W / 2 + error.x, y: arcoRival.y };
    const opciones = [{ A: directo, extra: 0 }];
    if (preferirBanda !== null && Math.abs(lineaRival - P.y) > AJUSTE.bandaLejos) {
      for (const pared of [CAMPO.L + R_PELOTA, CAMPO.R - R_PELOTA]) {
        if (Math.abs(P.x - pared) < 45) continue;
        const A = { x: 2 * pared - W / 2 + error.x, y: arcoRival.y };
        const t = (pared - P.x) / (A.x - P.x), yGolpe = P.y + t * (A.y - P.y);
        if (t <= 0 || t >= 1 || yGolpe < CAMPO.T + CAMPO.ochava + 30 || yGolpe > CAMPO.B - CAMPO.ochava - 30) continue;
        if ((yGolpe - P.y) * g < 60) continue;
        opciones.push({ A, extra: preferirBanda });
      }
    }
    let mejor = null, nota = Infinity;
    for (const o of opciones) {
      const llegada = Math.abs(giro180(grados(P.y - yo.y, P.x - yo.x) - grados(o.A.y - P.y, o.A.x - P.x)));
      const v = llegada - o.extra;
      if (v < nota) { nota = v; mejor = o; }
    }
    return mejor.A;
  }
  function atacar(m, o = {}) {
    const it = o.it || intercepto(m, o.vmedia);
    const P = it.q, pel = peligro(m);
    if (yRel(m.yo) > yRel(P) + 20 && (pel >= 0 || yRel(P) < (o.zona ?? 420))) return retroceder(m);
    const A = apuntar(m.yo, P, o.banda ?? null), deBanda = A.x < CAMPO.L || A.x > CAMPO.R;
    const obj = aproximar(m.yo, P, A, o.pegado);
    const cerca = dist(m.yo, P) < 160;
    const nitro = o.nitroBanda && deBanda ? true : o.nitro;   // el de la pared le pega fuerte para que llegue a la banda
    return { ...obj, nitro, nitroDist: deBanda && o.nitroBanda ? 50 : o.nitroDist ?? 140, vmax: cerca ? o.vmaxCerca : undefined };
  }
  function pastillaCerca(m, maxD, soloGrandes = false) {
    let mejor = null, costo = Infinity;
    pastillas.forEach((q, i) => {
      if (!m.f.pastillas[i] || (soloGrandes && !q.grande)) return;
      const d = dist(m.yo, q);
      if (d > maxD) return;
      const c = d - (q.grande ? 220 : 0);
      if (c < costo) { costo = c; mejor = q; }
    });
    return mejor;
  }
  const quieta = (m) => Math.hypot(m.b.vx, m.b.vy) < 0.8 && dist(m.riv, m.b) > 250;
  function enCasa(m, fondo, sigue) {
    const casa = { x: lim(W / 2 + (m.b.x - W / 2) * sigue, W / 2 - 115, W / 2 + 115), y: lineaPropia + g * fondo };
    return { ...casa, parar: true, mirar: m.b };
  }

  // ---------- los estilos ----------
  const ESTRATEGIA = {
    // Va a donde ve la pelota (sin adivinar), y si le quedó atrás vuelve por el medio.
    perseguidor(m) {
      const P = m.b;
      if (yRel(m.yo) > yRel(P) + 40) return { x: (P.x + W / 2) / 2, y: (P.y + lineaPropia) / 2 };
      return { ...aproximar(m.yo, P, { x: W / 2 + error.x, y: arcoRival.y }, true), nitro: true, nitroDist: 250 };
    },
    // Si el rival está por tocarla o lo tiene cerca, le va al auto con nitro.
    choque(m) {
      const { yo, riv, b } = m, pel = peligro(m);
      const dRB = dist(riv, b), dYB = dist(yo, b), dYR = dist(yo, riv);
      if (!riv.aplastado && pel < 0 && ((dRB < 230 && dRB < dYB + 90) || dYR < 150)) {
        const t = Math.min(35, dYR / 7);
        return { x: riv.x + riv.vx * t, y: riv.y + riv.vy * t, nitro: true, nitroDist: 30, urgente: true };
      }
      if (yo.nitro < 30 && pel < 0) { const q = pastillaCerca(m, 320, true); if (q) return { ...q }; }
      return atacar(m, { nitro: true, nitroDist: 110 });
    },
    // Vive en el arco. Sale solo si la pelota entra en su zona (o queda sola y quieta).
    arquero(m) {
      const it = intercepto(m, 5), P = it.q, pel = peligro(m);
      const zona = yRel(P) < 430 || (pel >= 0 && pel < 140);   // su zona: el primer tercio
      if ((zona && (it.t <= tardo(m.riv, P, 5.5) + 25 || pel >= 0)) || quieta(m)) {
        if (yRel(m.yo) > yRel(P) + 20) return retroceder(m);
        const despeje = quieta(m) && yRel(P) > 430 ? { x: W / 2, y: arcoRival.y }
          : { x: P.x < W / 2 ? CAMPO.L + 60 : CAMPO.R - 60, y: P.y + g * 520 };   // a la punta, lejos de mi arco
        return { ...aproximar(m.yo, P, despeje, false), nitro: pel >= 0, nitroDist: 80 };
      }
      return enCasa(m, 95, 0.3);
    },
    // Busca la pared: predice los rebotes y prefiere el tiro de banda.
    pared(m) {
      return atacar(m, { banda: AJUSTE.bandaPared, nitroBanda: AJUSTE.nitroBanda, nitro: tardo(m.riv, m.b, 5.5) < tardo(m.yo, m.b, 5.2) + 25, nitroDist: 120 });
    },
    // Junta pastillas cuando le falta y ataca siempre con nitro.
    nitro(m) {
      const it = intercepto(m, 6.2), pel = peligro(m);
      if (m.yo.nitro < 45 && pel < 0 && it.t > 40 && yRel(it.q) > 280) {
        const q = pastillaCerca(m, 420);
        if (q) return { x: q.x, y: q.y, nitro: m.yo.nitro > 15, nitroDist: 150 };
      }
      if (m.yo.nitro < 85 && pel < 0 && it.t > 25) {          // de pasada, si queda cerca
        const q = pastillaCerca(m, 130);
        if (q) return { x: q.x, y: q.y, nitro: true, nitroDist: 150 };
      }
      return atacar(m, { it, nitro: true, nitroDist: 90 });
    },
    // Llega despacio y la empuja pegada al auto; cerca del arco rival, define con nitro.
    gambeta(m) {
      const define = yRel(m.b) > LARGO - 420;
      // no vuelve a defender salvo que la pelota vaya a entrar: el gambeteador no marca
      return atacar(m, { pegado: true, vmaxCerca: define ? undefined : 3.4, nitro: define, nitroDist: 40, zona: AJUSTE.zonaGambeta });
    },
    // Espera atrás; cuando gana la pelota o el rival quedó pasado, contraataca a fondo.
    contra(m) {
      const { yo, riv, b } = m;
      const it = intercepto(m, 5.4), P = it.q, pel = peligro(m);
      if (contraQueda > 0) {
        contraQueda -= p.cadencia;
        if (pel < 0) return atacar(m, { it, nitro: true, nitroDist: 50, zona: 300 });
        contraQueda = 0;
      }
      const rivalPasado = yRel(riv) < yRel(P) - 40;
      const gane = dist(yo, b) < 110 && b.vy * g > 2.5;
      if ((rivalPasado && it.t < tardo(riv, P, 5.5) + 30 && yRel(yo) < yRel(P)) || gane) {
        contraQueda = 150;
        return atacar(m, { it, nitro: true, nitroDist: 50 });
      }
      // la pelota lejos, en campo rival: la espero atrás
      if (yRel(P) > LARGO * 0.45 && pel < 0 && !quieta(m)) return enCasa(m, 200, 0.5);
      return ESTRATEGIA.completo(m);
    },
    // Lee el juego: si el rival llega antes, se para entre la pelota y su arco; si llega él,
    // elige directo o de banda y usa el nitro para ganar las carreras.
    completo(m) {
      const it = intercepto(m, 5.6), P = it.q, pel = peligro(m), tRiv = tardo(m.riv, P, 5.6);
      const yo = m.yo, ladoBueno = yRel(yo) < yRel(P) - 15;
      if (!ladoBueno && (pel >= 0 || (tRiv < it.t - 10 && yRel(P) < LARGO * 0.6))) return retroceder(m);
      if (ladoBueno && pel < 0 && tRiv + 30 < it.t && yRel(P) < LARGO * 0.75 && !m.riv.aplastado && AJUSTE.sombra && (esperando += p.cadencia) < 100) {
        // el rival llega primero: lo espero entre la pelota y mi arco, a 200 píxeles
        const ax = W / 2 - P.x, ay = lineaPropia - P.y, al = Math.hypot(ax, ay) || 1, d = Math.min(200, al - 60);
        return { x: P.x + ax / al * d, y: P.y + ay / al * d, parar: true, mirar: P };
      }
      esperando = Math.max(0, esperando - 3 * p.cadencia);   // no se queda esperando para siempre
      if (yo.nitro < 25 && it.t > 80 && pel < 0) {
        const q = pastillaCerca(m, 160);
        if (q) return { x: q.x, y: q.y };
      }
      const carrera = Math.abs(tRiv - it.t) < 35 || pel >= 0;
      if (AJUSTE.desafio && dist(m.riv, P) < AJUSTE.desafio && ladoBueno) return atacar(m, { it, pegado: true, nitro: true, nitroDist: 40 });
      const tranquilo = AJUSTE.control && tRiv > it.t + AJUSTE.control && pel < 0;   // nadie me apura: la llevo controlada
      if (tranquilo) return atacar(m, { it, banda: AJUSTE.banda, pegado: true, vmaxCerca: yRel(P) > LARGO - 420 ? undefined : AJUSTE.vmaxControl, nitro: yRel(P) > LARGO - 420, nitroDist: 40 });
      return atacar(m, { it, banda: AJUSTE.banda, nitro: carrera || it.t > 60, nitroDist: 70, pegado: AJUSTE.pegado || yRel(P) > LARGO - 300, vmaxCerca: AJUSTE.vmaxCerca && yRel(P) < LARGO - 400 ? AJUSTE.vmaxCerca : undefined });
    },
  };

  return pensar;
}

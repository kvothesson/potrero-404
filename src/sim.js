// Simulación pura del juego: sin DOM, para poder correrla igual en el
// navegador y, más adelante, en el servidor de partidas online.
// Unidades: píxeles y cuadros a 60 por segundo, como el original de 2016.
//
// Física "a lo Rocket League" (2026-11-15): autos y pelota tienen velocidad como vector y
// los choques se resuelven con impulsos. La pelota sale según dónde y qué tan fuerte la
// pegás, no copiando la dirección del auto como en el original.

// Cancha grande (desde 2026-11-15): la cámara sigue a tu auto, así que no entra entera en pantalla.
export const W = 960, H = 1440, FPS = 60;
export const CAMPO = { L: 40, R: 920, T: 90, B: 1350, ochava: 80, arcoAncho: 260, arcoFondo: 60 };
export const GOLES_PARA_GANAR = 3;

// Se mantiene la diferencia del original: el azul dobla mejor y el rojo corre más.
export const AUTOS = [
  { nombre: 'Azul', color: '#2f7cf6', acel: 0.24, frenada: 0.4, roce: 0.05, velMax: 5.4, velNitro: 9, giro: 4.3, potenciaFreno: 1.5,
    spawn: { x: 480, y: 470, rot: 90 } },
  { nombre: 'Rojo', color: '#e5383b', acel: 0.26, frenada: 0.4, roce: 0.05, velMax: 5.9, velNitro: 9.8, giro: 3.9, potenciaFreno: 1.5,
    spawn: { x: 480, y: 970, rot: 270 } },
];

const LARGO = 44, ANCHO = 22;          // tamaño del auto
const R_RUEDA = 11;                    // círculos de choque del auto (frente y cola)
const R_PELOTA = 11;
const MASA_AUTO = 3, MASA_PELOTA = 1;
const REBOTE_PELOTA_AUTO = 0.5;        // cuánto rebota la pelota contra el auto
const GOLPE_EXTRA = 0.45;              // empujón extra al pegarle, como el de Rocket League
const REBOTE_PELOTA_PARED = 0.78;
const REBOTE_AUTO_PARED = 0.15;        // el auto casi no rebota: se desliza por la pared
const REBOTE_AUTOS = 0.45;
const ROCE_PELOTA = 0.008, AIRE_PELOTA = 0.003;
const VEL_MAX_PELOTA = 14;
const NITRO_MAX = 100, NITRO_INICIAL = 40, NITRO_GASTO = 0.7;  // la barra llena dura unos 2,4 s
const AGARRE = 0.55;                   // cuánto de la velocidad de costado sobrevive por cuadro
// Salto (el "dodge" de Rocket League): un envión corto para adelante, al costado o para atrás
// según lo que apretás. En el aire no hay agarre y el golpe a la pelota es mucho más fuerte.
const SALTO_DURA = 22, SALTO_RECARGA = 70, SALTO_ENVION = 4.6, SALTO_GOLPE = 2.6;
const CUENTA = 3 * FPS;                // timeRespawn de Main.as
const FESTEJO = 1.2 * FPS;
const NITRO_RESPAWN = 5 * FPS;         // timeRespawn de Nitro.as
// El camión de la Ruta 404: pasa a lo sumo una vez por partido, avisa con luces y bocina,
// cruza la cancha de punta a punta y aplasta lo que encuentra.
const CAMION = { prob: 0.6, desde: 20 * FPS, hasta: 70 * FPS, aviso: 2.2 * FPS, vel: 10, largo: 150, ancho: 56 };
const APLASTADO = 2.5 * FPS;

export function paredes() {
  const { L, R, T, B, ochava: c, arcoAncho, arcoFondo: D } = CAMPO;
  const g0 = W / 2 - arcoAncho / 2, g1 = W / 2 + arcoAncho / 2;
  const p = [
    [L + c, T], [g0, T], [g0, T - D], [g1, T - D], [g1, T], [R - c, T], [R, T + c],
    [R, B - c], [R - c, B], [g1, B], [g1, B + D], [g0, B + D], [g0, B], [L + c, B], [L, B - c], [L, T + c],
  ];
  const seg = [];
  for (let i = 0; i < p.length; i++) seg.push([p[i], p[(i + 1) % p.length]]);
  return { puntos: p, seg };
}
const PARED = paredes();

// Pastillas de nitro: el mismo dibujo que addStageNitro() de Main.as, en la cancha grande.
function pastillas() {
  const { L, R, T, B } = CAMPO;
  const grandes = [[L + 90, T + 110], [L + 90, B - 110], [R - 90, T + 110], [R - 90, B - 110]];
  const chicas = [[W / 2 - 140, T + 330], [W / 2 + 140, T + 330], [L + 130, H / 2], [R - 130, H / 2],
    [W / 2 - 140, B - 330], [W / 2 + 140, B - 330]];
  return [
    ...grandes.map(([x, y]) => ({ x, y, r: 14, poder: 100, activa: true, espera: 0 })),
    ...chicas.map(([x, y]) => ({ x, y, r: 7, poder: 12, activa: true, espera: 0 })),
  ];
}

export function nuevoEstado() {
  const s = {
    autos: AUTOS.map((a, i) => ({
      i, x: 0, y: 0, rot: 0, vx: 0, vy: 0, vel: 0, lat: 0, nitro: NITRO_INICIAL, frenoActivo: false, nitroActivo: false, goles: 0,
    })),
    pelota: { x: W / 2, y: H / 2, vx: 0, vy: 0, giro: 0 },
    pastillas: pastillas(),
    fase: 'cuenta', reloj: CUENTA, ganador: -1, ultimoGol: -1, cuadro: 0, tiempoJuego: 0,
    camion: Math.random() < CAMION.prob ? {
      estado: 'espera', cuando: Math.round(CAMION.desde + Math.random() * (CAMION.hasta - CAMION.desde)),
      x: Math.round(CAMPO.L + 110 + Math.random() * (CAMPO.R - CAMPO.L - 220)), dir: Math.random() < 0.5 ? 1 : -1, y: 0, t: 0,
    } : null,
    eventos: [],
  };
  reubicar(s);
  return s;
}

function reubicar(s) {
  s.autos.forEach((c, i) => {
    const sp = AUTOS[i].spawn;
    Object.assign(c, { x: sp.x, y: sp.y, rot: sp.rot, vx: 0, vy: 0, vel: 0, lat: 0, frenoActivo: false, nitroActivo: false,
      salto: 0, recarga: 0, saltoAntes: true, aplastado: 0 });
  });
  Object.assign(s.pelota, { x: W / 2, y: H / 2, vx: 0, vy: 0 });
}

export function revancha(s) {
  const n = nuevoEstado();
  Object.assign(s, n);
}

const rad = (g) => g * Math.PI / 180;
// Azar que da lo mismo en el navegador y en el servidor: sale del estado, no de Math.random,
// así la predicción online no se separa.
function azar(s, sal = 0) {
  let h = (s.cuadro * 374761393 + Math.round(s.pelota.x * 8) * 668265263 + Math.round(s.pelota.y * 8) * 2246822519 + sal * 3266489917) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const DESVIO = 0.12;          // cada golpe se tuerce hasta ±7 grados
const MORDIDA = 4;            // envión de costado al reaparecer
const SALTO_CUANTICO = 48;    // cuánto se corre la Luz Mala al desaparecer y reaparecer
const NADA = { up: false, down: false, left: false, right: false, freno: false, nitro: false, salto: false };
// Las teclas de un jugador en un número (un bit por tecla), para mandarlas por la red.
const CLAVES = Object.keys(NADA);
export const aBits = (e) => CLAVES.reduce((n, k, i) => n | (e && e[k] ? 1 << i : 0), 0);
export const deBits = (n) => Object.fromEntries(CLAVES.map((k, i) => [k, !!(n & (1 << i))]));

// Avanza un cuadro. entradas: [jugador0, jugador1] con {up, down, left, right, freno, nitro}.
export function paso(s, entradas) {
  s.eventos.length = 0;
  s.cuadro++;
  if (s.fase === 'fin') return s;
  if (s.fase === 'gol') {
    if (--s.reloj <= 0) {
      if (s.ganador >= 0) { s.fase = 'fin'; s.eventos.push({ t: 'fin', quien: s.ganador }); }
      else { reubicar(s); s.fase = 'cuenta'; s.reloj = CUENTA; }
    }
    s.pelota.vx *= 0.9; s.pelota.vy *= 0.9;   // que quede en la red y no vuelva a salir
    moverPelota(s);
    return s;
  }
  if (s.fase === 'cuenta') {
    if (s.reloj % FPS === 0) s.eventos.push({ t: 'tic', n: s.reloj / FPS });
    if (--s.reloj <= 0) { s.fase = 'juego'; s.eventos.push({ t: 'arranque' }); }
    return s;
  }

  s.tiempoJuego++;
  const vivos = s.autos.filter((c) => !c.aplastado);
  s.autos.forEach((c, i) => { if (c.aplastado) revivir(s, c, i); });
  vivos.forEach((c) => manejar(s, c, AUTOS[c.i], entradas[c.i] || NADA));
  if (vivos.length === 2) chocarAutos(s);
  vivos.forEach((c) => chocarPared(s, c));
  vivos.forEach((c) => juntarNitro(s, c));
  const viejo = s.fisica === '2016';
  vivos.forEach((c) => (viejo ? pegarPelota2016 : pegarPelota)(s, c));
  if (!viejo) mordida(s);
  (viejo ? moverPelota2016 : moverPelota)(s);
  camion(s);
  s.autos.forEach(medir);
  revisarGol(s);
  s.pastillas.forEach((p) => { if (!p.activa && --p.espera <= 0) { p.activa = true; s.eventos.push({ t: 'nitroVuelve' }); } });
  return s;
}

// Salto cuántico de la Luz Mala: si los dos autos la aprietan a la vez y queda quieta en el
// medio, desaparece y aparece un poco más al costado (para un lado al azar), con algo de envión.
function mordida(s) {
  const b = s.pelota, t = b.tocadaPor;
  if (!t || s.cuadro - t[0] > 5 || s.cuadro - t[1] > 5) return;
  if (Math.hypot(b.vx, b.vy) > 3) return;
  const [a, z] = s.autos;
  let nx = z.x - a.x, ny = z.y - a.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
  const lado = azar(s, 9) < 0.5 ? -1 : 1;
  const desde = { x: b.x, y: b.y };
  b.x += -ny * lado * SALTO_CUANTICO; b.y += nx * lado * SALTO_CUANTICO;
  b.vx = -ny * lado * MORDIDA; b.vy = nx * lado * MORDIDA;
  b.tocadaPor = [-99, -99];
  s.eventos.push({ t: 'cuantico', desde, hasta: { x: b.x, y: b.y } });
}

// ---------- El camión ----------
function camion(s) {
  const k = s.camion;
  if (!k || k.estado === 'paso') return;
  if (k.estado === 'espera') {
    if (s.tiempoJuego >= k.cuando) { k.estado = 'aviso'; k.t = CAMION.aviso; s.eventos.push({ t: 'bocina', dir: k.dir }); }
    return;
  }
  if (k.estado === 'aviso') {
    if (--k.t <= 0) { k.estado = 'pasa'; k.y = k.dir > 0 ? CAMPO.T - 260 : CAMPO.B + 260; s.eventos.push({ t: 'camion', dir: k.dir }); }
    else if (k.t % 40 === 0) s.eventos.push({ t: 'bocina', dir: k.dir });
    return;
  }
  k.y += k.dir * CAMION.vel;
  const x0 = k.x - CAMION.ancho / 2, x1 = k.x + CAMION.ancho / 2, y0 = k.y - CAMION.largo / 2, y1 = k.y + CAMION.largo / 2;
  // autos: si los toca, los aplasta
  for (const c of s.autos) {
    if (c.aplastado) continue;
    // se mira cada círculo del auto (frente y cola), así cuenta el largo aunque esté cruzado
    if (circulosAuto(c).some((q) => q.x > x0 - R_RUEDA && q.x < x1 + R_RUEDA && q.y > y0 - R_RUEDA && q.y < y1 + R_RUEDA)) {
      c.aplastado = APLASTADO; c.vx = c.vy = 0; c.nitroActivo = false;
      s.eventos.push({ t: 'aplastado', quien: c.i });
    }
  }
  // la Luz Mala sale volando para el costado y hacia donde va el camión
  const b = s.pelota;
  if (b.x > x0 - R_PELOTA - 3 && b.x < x1 + R_PELOTA + 3 && b.y > y0 - R_PELOTA - 3 && b.y < y1 + R_PELOTA + 3) {
    const lado = b.x < k.x ? -1 : 1;
    b.x = lado < 0 ? x0 - R_PELOTA - 4 : x1 + R_PELOTA + 4;
    b.vx = lado * 9; b.vy = k.dir * CAMION.vel * 1.2;
    s.eventos.push({ t: 'toque', quien: -1, fuerza: 15, fuerte: true });
  }
  if ((k.dir > 0 && y0 > CAMPO.B + 120) || (k.dir < 0 && y1 < CAMPO.T - 120)) k.estado = 'paso';
}

function revivir(s, c, i) {
  if (--c.aplastado > 0) return;
  const sp = AUTOS[i].spawn;
  Object.assign(c, { x: sp.x, y: sp.y, rot: sp.rot, vx: 0, vy: 0, vel: 0, lat: 0, salto: 0, recarga: 0 });
  s.eventos.push({ t: 'revive', quien: i });
}

// vel y lat: velocidad hacia adelante y de costado, para el dibujo, el sonido y los bots.
function medir(c) {
  const co = Math.cos(rad(c.rot)), si = Math.sin(rad(c.rot));
  c.vel = c.vx * co + c.vy * si;
  c.lat = -c.vx * si + c.vy * co;
}

function manejar(s, c, a, e) {
  if (e.nitro && c.nitro > 0) c.nitro = Math.max(0, c.nitro - NITRO_GASTO);
  c.nitroActivo = e.nitro && c.nitro > 0;
  if (e.freno && !c.frenoActivo) s.eventos.push({ t: 'derrape', quien: c.i });
  c.frenoActivo = e.freno;

  let co = Math.cos(rad(c.rot)), si = Math.sin(rad(c.rot));

  // Salto: se dispara al apretar (no al mantener) y tiene recarga.
  if (c.recarga > 0) c.recarga--;
  if (e.salto && !c.saltoAntes && c.recarga === 0 && c.salto === 0) {
    const lado = (e.right ? 1 : 0) - (e.left ? 1 : 0), atras = e.down && !e.up;
    let dx = atras ? -1 : (lado ? 0 : 1), dy = lado;     // en coordenadas del auto
    const n = Math.hypot(dx, dy); dx /= n; dy /= n;
    c.vx += (co * dx - si * dy) * SALTO_ENVION; c.vy += (si * dx + co * dy) * SALTO_ENVION;
    c.salto = SALTO_DURA; c.recarga = SALTO_RECARGA;
    c.saltoTipo = atras ? 'atras' : lado ? (lado > 0 ? 'derecha' : 'izquierda') : 'adelante';
    s.eventos.push({ t: 'salto', quien: c.i });
  }
  c.saltoAntes = !!e.salto;
  if (c.salto > 0) {
    // en el aire: sin motor ni agarre, sigue de largo y se puede girar un poco
    c.salto--;
    const quiere = (e.right ? 1 : 0) - (e.left ? 1 : 0);
    if (c.saltoTipo === 'adelante' || c.saltoTipo === 'atras') c.rot = (((c.rot + quiere * 1.5) % 360) + 360) % 360;
    c.vx *= 0.995; c.vy *= 0.995;
    c.x += c.vx; c.y += c.vy;
    if (c.salto === 0) s.eventos.push({ t: 'aterriza', quien: c.i });
    return;
  }

  let f = c.vx * co + c.vy * si;       // hacia adelante
  let l = -c.vx * si + c.vy * co;      // de costado

  // Motor y freno, sobre la velocidad hacia adelante.
  const tope = c.nitroActivo ? a.velNitro : a.velMax;
  const reversa = a.velMax * 0.6;
  if (c.nitroActivo) {
    f = Math.min(tope, f + a.acel * 2.2);                           // el nitro empuja aunque no aceleres
  } else if (e.up) {
    if (f < 0) f = Math.min(0, f + a.frenada);
    else if (f < tope) f = Math.min(tope, f + a.acel * (1 - 0.5 * f / tope)); // tira más fuerte desde parado
    else f = Math.max(tope, f - a.roce * 3);
  } else if (e.down) {
    if (f > 0) f = Math.max(0, f - a.frenada);
    else f = Math.max(-reversa, f - a.acel * 0.7);
  } else {
    f -= Math.sign(f) * Math.min(Math.abs(f), a.roce);
  }

  // Giro: radio chico a poca velocidad y más abierto a fondo, como en Rocket League.
  // Dobla aunque no aceleres y en marcha atrás dobla al revés, como un auto.
  const quiere = (e.right ? 1 : 0) - (e.left ? 1 : 0);
  const agarre = Math.min(1, Math.abs(f) / 0.9);
  const abre = 1 - 0.3 * Math.min(1, Math.abs(f) / a.velNitro);
  const giro = a.giro * agarre * abre * (c.frenoActivo ? a.potenciaFreno : 1) * Math.sign(f || 1) * quiere;
  c.rot = (((c.rot + giro) % 360) + 360) % 360;

  if (c.frenoActivo) {
    // Derrape: el auto gira pero la velocidad sigue para donde iba; casi no pierde nada.
    const vx = co * f - si * l, vy = si * f + co * l;
    c.vx = vx * 0.992; c.vy = vy * 0.992;
  } else {
    // Agarre: la velocidad acompaña al auto y lo de costado se pierde rápido.
    co = Math.cos(rad(c.rot)); si = Math.sin(rad(c.rot));
    const nl = l * AGARRE;
    c.vx = co * f - si * nl; c.vy = si * f + co * nl;
  }
  c.x += c.vx; c.y += c.vy;
}

function circulosAuto(c) {
  const dx = Math.cos(rad(c.rot)) * (LARGO / 2 - R_RUEDA), dy = Math.sin(rad(c.rot)) * (LARGO / 2 - R_RUEDA);
  return [{ x: c.x + dx, y: c.y + dy, frente: true }, { x: c.x - dx, y: c.y - dy, frente: false }];
}

// Empuja un círculo fuera de las paredes. Devuelve la normal del choque más fuerte o null.
function empujarFuera(o, r) {
  let peor = null;
  for (const [[ax, ay], [bx, by]] of PARED.seg) {
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    let t = ((o.x - ax) * ex + (o.y - ay) * ey) / l2; t = Math.max(0, Math.min(1, t));
    const px = ax + ex * t, py = ay + ey * t, dx = o.x - px, dy = o.y - py, d = Math.hypot(dx, dy);
    if (d < r && d > 1e-6) {
      const nx = dx / d, ny = dy / d, pen = r - d;
      o.x += nx * pen; o.y += ny * pen;
      if (!peor || pen > peor.pen) peor = { nx, ny, pen };
    }
  }
  return peor;
}

// Contra la pared el auto pierde lo que iba hacia la pared y se desliza por ella.
function chocarPared(s, c) {
  for (const k of circulosAuto(c)) {
    const q = { x: k.x, y: k.y };
    const n = empujarFuera(q, R_RUEDA);
    if (!n) continue;
    c.x += q.x - k.x; c.y += q.y - k.y;
    const vn = c.vx * n.nx + c.vy * n.ny;
    if (vn < 0) {
      c.vx -= (1 + REBOTE_AUTO_PARED) * vn * n.nx; c.vy -= (1 + REBOTE_AUTO_PARED) * vn * n.ny;
      if (-vn > 3) s.eventos.push({ t: 'choque', quien: c.i, fuerza: -vn });
    }
  }
}

function chocarAutos(s) {
  const [a, b] = s.autos;
  for (const ka of circulosAuto(a)) for (const kb of circulosAuto(b)) {
    const dx = kb.x - ka.x, dy = kb.y - ka.y, d = Math.hypot(dx, dy), min = R_RUEDA * 2;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d, ny = dy / d, pen = (min - d) / 2;
    a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
    const vr = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vr < 0) {
      const j = -(1 + REBOTE_AUTOS) * vr / 2;
      a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
      if (-vr > 3) s.eventos.push({ t: 'choqueAutos', fuerza: -vr });
    }
  }
}

function juntarNitro(s, c) {
  for (const p of s.pastillas) {
    if (!p.activa) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + 14) {
      p.activa = false; p.espera = NITRO_RESPAWN;
      c.nitro = Math.min(NITRO_MAX, c.nitro + p.poder);
      s.eventos.push({ t: 'nitro', quien: c.i, grande: p.poder > 50 });
    }
  }
}

// Pelota contra auto (rectángulo rotado): choque con impulso según la velocidad relativa,
// más un empujón extra en la dirección del golpe. Pegarle con la punta, de costado o
// de refilón la manda para lugares distintos.
function pegarPelota(s, c) {
  const b = s.pelota, co = Math.cos(rad(c.rot)), si = Math.sin(rad(c.rot));
  const rx = b.x - c.x, ry = b.y - c.y;
  const lx = rx * co + ry * si, ly = -rx * si + ry * co;           // pelota en coordenadas del auto
  const hx = LARGO / 2, hy = ANCHO / 2;
  const qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly));
  let dx = lx - qx, dy = ly - qy, d = Math.hypot(dx, dy);
  if (d >= R_PELOTA) return;
  let nlx, nly;
  if (d < 1e-6) {
    const fx = hx - Math.abs(lx), fy = hy - Math.abs(ly);
    if (fx < fy) { nlx = Math.sign(lx) || 1; nly = 0; d = -fx; } else { nlx = 0; nly = Math.sign(ly) || 1; d = -fy; }
  } else { nlx = dx / d; nly = dy / d; }
  const nx = nlx * co - nly * si, ny = nlx * si + nly * co;
  // separar según las masas
  const pen = R_PELOTA - d, tot = MASA_AUTO + MASA_PELOTA;
  b.x += nx * pen * MASA_AUTO / tot; b.y += ny * pen * MASA_AUTO / tot;
  c.x -= nx * pen * MASA_PELOTA / tot; c.y -= ny * pen * MASA_PELOTA / tot;

  const vr = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
  if (vr >= 0) return;
  const j = -(1 + REBOTE_PELOTA_AUTO) * vr / (1 / MASA_PELOTA + 1 / MASA_AUTO);
  const enElAire = c.salto > 0;
  const extra = Math.min(-vr, 10) * GOLPE_EXTRA * (enElAire ? SALTO_GOLPE : 1) + (enElAire ? 2 : 0);
  b.vx += (j / MASA_PELOTA + extra) * nx; b.vy += (j / MASA_PELOTA + extra) * ny;
  c.vx -= (j / MASA_AUTO) * nx; c.vy -= (j / MASA_AUTO) * ny;
  // un poco de azar en cada golpe, para que dos golpes iguales no se anulen siempre
  const a = (azar(s, c.i + 1) - 0.5) * 2 * DESVIO, ca = Math.cos(a), sa = Math.sin(a);
  [b.vx, b.vy] = [b.vx * ca - b.vy * sa, b.vx * sa + b.vy * ca];
  limitarPelota(b, enElAire ? VEL_MAX_PELOTA * 1.3 : VEL_MAX_PELOTA);
  b.tocadaPor = b.tocadaPor || [-99, -99];
  b.tocadaPor[c.i] = s.cuadro;
  if (s.cuadro - (c.ultimoToque || -99) > 6) s.eventos.push({ t: 'toque', quien: c.i, fuerza: Math.hypot(b.vx, b.vy), fuerte: enElAire });
  c.ultimoToque = s.cuadro;
}

// ---------- Física 2016 de la pelota (Ball.as), para comparar con s.fisica = '2016' ----------
// La pelota se guarda como ángulo + velocidad. El rebote es la reflexión sobre una recta:
// ángulo nuevo = 360 − ángulo + 2 × ángulo de la pared (o del costado del auto).
const ang = (vx, vy) => ((Math.atan2(vy, vx) * 180 / Math.PI) + 360) % 360;
function pegarPelota2016(s, c) {
  const b = s.pelota, co = Math.cos(rad(c.rot)), si = Math.sin(rad(c.rot));
  const rx = b.x - c.x, ry = b.y - c.y, lx = rx * co + ry * si, ly = -rx * si + ry * co;
  const hx = LARGO / 2, hy = ANCHO / 2;
  const qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly));
  const d = Math.hypot(lx - qx, ly - qy);
  const toca = d < R_PELOTA;
  if (!toca) { c.changePower = false; c.changeDirection = false; return; }
  // sacarla de adentro del auto (el original no lo hacía y a veces quedaba trabada)
  if (d > 1e-6) { const nlx = (lx - qx) / d, nly = (ly - qy) / d, pen = R_PELOTA - d; b.x += (nlx * co - nly * si) * pen; b.y += (nlx * si + nly * co) * pen; }
  b.angulo = b.angulo ?? ang(b.vx, b.vy); b.rapidez = b.rapidez ?? Math.hypot(b.vx, b.vy);
  const cara = Math.abs(lx - qx) > Math.abs(ly - qy) ? (lx > 0 ? 'frente' : 'cola') : 'costado';
  const fuerza = Math.abs(c.vel);
  if (cara === 'frente' && !c.changePower) { b.angulo = c.rot; if (b.rapidez < fuerza) b.rapidez = fuerza; c.changePower = true; }
  else if (cara === 'cola' && !c.changePower) { b.angulo = c.rot + 180; if (b.rapidez < fuerza) b.rapidez = fuerza; c.changePower = true; }
  else if (cara === 'costado' && !c.changeDirection && !c.changePower) { b.angulo = 360 - b.angulo + 2 * c.rot; c.changeDirection = true; }
  b.angulo = ((b.angulo % 360) + 360) % 360;
  b.vx = Math.cos(rad(b.angulo)) * b.rapidez; b.vy = Math.sin(rad(b.angulo)) * b.rapidez;
  if (s.cuadro - (c.ultimoToque || -99) > 6) s.eventos.push({ t: 'toque', quien: c.i, fuerza: b.rapidez });
  c.ultimoToque = s.cuadro;
}
function moverPelota2016(s) {
  const b = s.pelota;
  b.angulo = b.angulo ?? ang(b.vx, b.vy); b.rapidez = b.rapidez ?? Math.hypot(b.vx, b.vy);
  if (b.rapidez > 0) b.rapidez = Math.max(0, b.rapidez - 0.01);       // speedReduction
  b.vx = Math.cos(rad(b.angulo)) * b.rapidez; b.vy = Math.sin(rad(b.angulo)) * b.rapidez;
  b.x += b.vx; b.y += b.vy; b.giro += b.rapidez * 0.06;
  const n = empujarFuera(b, R_PELOTA);
  if (n && !b.changeSpeed) {
    const anguloPared = ang(n.nx, n.ny) + 90;                        // la pared es perpendicular a su normal
    b.angulo = (((360 - b.angulo + 2 * anguloPared) % 360) + 360) % 360;
    b.changeSpeed = true;
    s.eventos.push({ t: 'pared', fuerza: b.rapidez });
  } else if (!n) b.changeSpeed = false;
  b.vx = Math.cos(rad(b.angulo)) * b.rapidez; b.vy = Math.sin(rad(b.angulo)) * b.rapidez;
}

function limitarPelota(b, max = VEL_MAX_PELOTA) {
  const v = Math.hypot(b.vx, b.vy);
  if (v > max) { b.vx *= max / v; b.vy *= max / v; }
}

function moverPelota(s) {
  const b = s.pelota;
  const v = Math.hypot(b.vx, b.vy);
  if (v > 0) {
    const nv = Math.max(0, v - ROCE_PELOTA - v * AIRE_PELOTA);
    b.vx *= nv / v; b.vy *= nv / v;
  }
  b.x += b.vx; b.y += b.vy;
  b.giro += v * 0.06;
  const n = empujarFuera(b, R_PELOTA);
  if (n) {
    const vn = b.vx * n.nx + b.vy * n.ny;
    if (vn < 0) {
      b.vx -= (1 + REBOTE_PELOTA_PARED) * vn * n.nx; b.vy -= (1 + REBOTE_PELOTA_PARED) * vn * n.ny;
      if (-vn > 1.5) s.eventos.push({ t: 'pared', fuerza: -vn });
    }
  }
  if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) Object.assign(b, { x: W / 2, y: H / 2, vx: 0, vy: 0 });
}

function revisarGol(s) {
  const b = s.pelota, { T, B } = CAMPO;
  let anota = -1;
  if (b.y < T - R_PELOTA) anota = 1;      // entró en el arco de arriba, que defiende el azul
  else if (b.y > B + R_PELOTA) anota = 0; // entró en el de abajo, que defiende el rojo
  if (anota < 0) return;
  const c = s.autos[anota];
  c.goles++;
  s.ultimoGol = anota;
  s.fase = 'gol'; s.reloj = FESTEJO;
  if (c.goles >= GOLES_PARA_GANAR) s.ganador = anota;
  s.eventos.push({ t: 'gol', quien: anota });
  b.vx *= 0.3; b.vy *= 0.3;
}

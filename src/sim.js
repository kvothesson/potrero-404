// Simulación pura del juego: sin DOM, para poder correrla igual en el
// navegador y, más adelante, en el servidor de partidas online.
// Unidades: píxeles y cuadros a 60 por segundo, como el original de 2016.

export const W = 480, H = 720, FPS = 60;
export const CAMPO = { L: 20, R: 460, T: 50, B: 670, ochava: 40, arcoAncho: 150, arcoFondo: 34 };
export const GOLES_PARA_GANAR = 3;

// Valores del código original (Cars/CarFerrariBlue.as y Cars/CarAcuraRed.as).
export const AUTOS = [
  { nombre: 'Azul', color: '#2f7cf6', acel: 1.5, desacel: 0.3, velMax: 5, velNitro: 13, giro: 7, potenciaFreno: 1.6,
    spawn: { x: 240, y: 200, rot: 90 } },
  { nombre: 'Rojo', color: '#e5383b', acel: 1.5, desacel: 0.3, velMax: 6, velNitro: 14, giro: 6, potenciaFreno: 1.5,
    spawn: { x: 240, y: 520, rot: 270 } },
];

const LARGO = 44, ANCHO = 22;          // tamaño del auto
const R_RUEDA = 11;                    // círculos de choque del auto (frente y cola)
const R_PELOTA = 10;
const ROCE_PELOTA = 0.01;              // speedReduction de Ball.as
const EMPUJE_EXTRA = 3;                // forceAdd de Ball.as
const NITRO_MAX = 100, NITRO_INICIAL = 30, NITRO_GASTO = 2;
const FRENO_FRENADA = 0.8;             // speedReduction de Car.as
const CUENTA = 3 * FPS;                // timeRespawn de Main.as
const FESTEJO = 1.2 * FPS;
const NITRO_RESPAWN = 5 * FPS;         // timeRespawn de Nitro.as

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

// Pastillas de nitro, mismas posiciones que addStageNitro() de Main.as.
function pastillas() {
  const k = 70;
  const grandes = [[k, k + 20], [k, H - k - 20], [W - k, k + 20], [W - k, H - k - 20]];
  const chicas = [[W / 2 - k, k * 3], [W / 2 + k, k * 3], [k * 1.5, H / 2], [W - k * 1.5, H / 2],
    [W / 2 - k, H - k * 3], [W / 2 + k, H - k * 3]];
  return [
    ...grandes.map(([x, y]) => ({ x, y, r: 14, poder: 100, activa: true, espera: 0 })),
    ...chicas.map(([x, y]) => ({ x, y, r: 7, poder: 10, activa: true, espera: 0 })),
  ];
}

export function nuevoEstado() {
  const s = {
    autos: AUTOS.map((a, i) => ({
      i, x: 0, y: 0, rot: 0, vel: 0, nitro: NITRO_INICIAL, giro: a.giro, frenoActivo: false, nitroActivo: false, goles: 0,
    })),
    pelota: { x: W / 2, y: H / 2, vx: 0, vy: 0, giro: 0 },
    pastillas: pastillas(),
    fase: 'cuenta', reloj: CUENTA, ganador: -1, ultimoGol: -1, cuadro: 0,
    eventos: [],
  };
  reubicar(s);
  return s;
}

function reubicar(s) {
  s.autos.forEach((c, i) => {
    const sp = AUTOS[i].spawn;
    c.x = sp.x; c.y = sp.y; c.rot = sp.rot; c.vel = 0; c.giro = AUTOS[i].giro; c.frenoActivo = false; c.nitroActivo = false;
  });
  Object.assign(s.pelota, { x: W / 2, y: H / 2, vx: 0, vy: 0 });
}

export function revancha(s) {
  const n = nuevoEstado();
  Object.assign(s, n);
}

const rad = (g) => g * Math.PI / 180;
const NADA = { up: false, down: false, left: false, right: false, freno: false, nitro: false };

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
    moverPelota(s);
    return s;
  }
  if (s.fase === 'cuenta') {
    if (s.reloj % FPS === 0) s.eventos.push({ t: 'tic', n: s.reloj / FPS });
    if (--s.reloj <= 0) { s.fase = 'juego'; s.eventos.push({ t: 'arranque' }); }
    return s;
  }

  s.autos.forEach((c, i) => manejar(s, c, AUTOS[i], entradas[i] || NADA));
  chocarAutos(s);
  s.autos.forEach((c) => chocarPared(s, c));
  s.autos.forEach((c) => juntarNitro(s, c));
  s.autos.forEach((c) => pegarPelota(s, c));
  moverPelota(s);
  revisarGol(s);
  s.pastillas.forEach((p) => { if (!p.activa && --p.espera <= 0) { p.activa = true; s.eventos.push({ t: 'nitroVuelve' }); } });
  return s;
}

// Port de Car.as: move(), handlingSpeed() y nitroSpeed().
function manejar(s, c, a, e) {
  // Nitro: se gasta 2 por cuadro mientras se aprieta.
  if (e.nitro && c.nitro > 0) c.nitro = Math.max(0, c.nitro - NITRO_GASTO);
  c.nitroActivo = e.nitro && c.nitro > 0;

  // Freno de mano: gira más y pierde velocidad al apretarlo.
  if (e.freno && !c.frenoActivo) {
    c.giro = a.giro * a.potenciaFreno; c.frenoActivo = true;
    if (!e.nitro) c.vel *= FRENO_FRENADA;
    s.eventos.push({ t: 'derrape', quien: c.i });
  } else if (!e.freno) { c.giro = a.giro; c.frenoActivo = false; }

  const tope = c.nitroActivo ? a.velNitro : a.velMax;
  if (e.up) {
    if (c.vel < tope) c.vel = Math.min(tope, c.vel + a.acel);
    else c.vel = Math.max(tope, c.vel - a.desacel);
  } else if (e.down) {
    if (c.vel > -tope) c.vel = Math.max(-tope, c.vel - a.acel);
  } else if (c.vel !== 0) {
    if (Math.abs(c.vel) < 1) c.vel = 0;
    else c.vel -= Math.sign(c.vel) * a.desacel;
  }
  // Como en el original, solo dobla si está acelerando o yendo marcha atrás.
  if (e.up || e.down) {
    if (e.right) c.rot += c.giro;
    if (e.left) c.rot -= c.giro;
    c.rot = ((c.rot % 360) + 360) % 360;
  }
  c.x += Math.cos(rad(c.rot)) * c.vel;
  c.y += Math.sin(rad(c.rot)) * c.vel;
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

function chocarPared(s, c) {
  for (const k of circulosAuto(c)) {
    const q = { x: k.x, y: k.y };
    const n = empujarFuera(q, R_RUEDA);
    if (!n) continue;
    c.x += q.x - k.x; c.y += q.y - k.y;
    // Como el original: si el frente toca la pared, el auto se frena.
    const haciaPared = (k.frente && c.vel > 0) || (!k.frente && c.vel < 0);
    if (haciaPared) {
      if (Math.abs(c.vel) > 3) s.eventos.push({ t: 'choque', quien: c.i, fuerza: Math.abs(c.vel) });
      c.vel = 0;
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
    const fuerza = Math.abs(a.vel) + Math.abs(b.vel);
    if (ka.frente && a.vel > 0) a.vel *= 0.3;
    if (kb.frente && b.vel > 0) b.vel *= 0.3;
    if (fuerza > 4 && s.cuadro % 8 === 0) s.eventos.push({ t: 'choqueAutos', fuerza });
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

// Port de Ball.collisionCar(): el frente del auto le da la dirección del auto y su velocidad,
// la cola la tira para atrás y los costados la hacen rebotar.
function pegarPelota(s, c) {
  const b = s.pelota, co = Math.cos(rad(c.rot)), si = Math.sin(rad(c.rot));
  const rx = b.x - c.x, ry = b.y - c.y;
  const lx = rx * co + ry * si, ly = -rx * si + ry * co;           // pelota en coordenadas del auto
  const hx = LARGO / 2, hy = ANCHO / 2;
  const qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly));
  let dx = lx - qx, dy = ly - qy, d = Math.hypot(dx, dy);
  if (d >= R_PELOTA) return;
  let nlx, nly;
  if (d < 1e-6) { // el centro quedó adentro del auto: sacarla por la cara más cercana
    const fx = hx - Math.abs(lx), fy = hy - Math.abs(ly);
    if (fx < fy) { nlx = Math.sign(lx) || 1; nly = 0; d = -fx; } else { nlx = 0; nly = Math.sign(ly) || 1; d = -fy; }
  } else { nlx = dx / d; nly = dy / d; }
  const pen = R_PELOTA - d;
  const nx = nlx * co - nly * si, ny = nlx * si + nly * co;
  b.x += nx * pen; b.y += ny * pen;

  const velPelota = Math.hypot(b.vx, b.vy);
  const cara = Math.abs(nlx) > Math.abs(nly) ? (nlx > 0 ? 'frente' : 'cola') : 'costado';
  if (cara === 'frente' && c.vel > 0.5) {
    const v = Math.max(velPelota, c.vel + EMPUJE_EXTRA);
    b.vx = co * v; b.vy = si * v;
  } else if (cara === 'cola' && c.vel < -0.5) {
    const v = Math.max(velPelota, -c.vel + EMPUJE_EXTRA);
    b.vx = -co * v; b.vy = -si * v;
  } else {
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
    // si el auto viene empujando de costado, que la pelota salga al menos a esa velocidad
    const autoN = (co * nx + si * ny) * c.vel;
    const ahora = b.vx * nx + b.vy * ny;
    if (ahora < autoN + 1) { b.vx += (autoN + 1 - ahora) * nx; b.vy += (autoN + 1 - ahora) * ny; }
  }
  if (s.cuadro - (c.ultimoToque || -99) > 6) s.eventos.push({ t: 'toque', quien: c.i, fuerza: Math.hypot(b.vx, b.vy) });
  c.ultimoToque = s.cuadro;
}

function moverPelota(s) {
  const b = s.pelota;
  const v = Math.hypot(b.vx, b.vy);
  if (v > 0) {
    const nv = Math.max(0, v - ROCE_PELOTA);
    b.vx *= nv / v; b.vy *= nv / v;
  }
  b.x += b.vx; b.y += b.vy;
  b.giro += v * 0.06;
  const n = empujarFuera(b, R_PELOTA);
  if (n) {
    const vn = b.vx * n.nx + b.vy * n.ny;
    if (vn < 0) {
      b.vx -= 2 * vn * n.nx; b.vy -= 2 * vn * n.ny;
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
  // la pelota frena adentro de la red
  b.vx *= 0.3; b.vy *= 0.3;
}

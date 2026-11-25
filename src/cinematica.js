// Cinemática de la intro: el lore de la Ruta 404 contado en 21 segundos, después del logo.
// Dibuja en el lienzo del juego (cualquier medida, parado o acostado) con los mismos autos y la
// misma fuente. Las escenas de la ruta salen del opening (cortos/opening.js), acá con medidas libres.
//   0     la ruta de noche y los píxeles muertos del campo
//   4.6   los Hombres-Tanque en la banquina y el mojón del km 404
//   9.2   luces que se acercan: los corredores, todavía en sombra
//   11.6  los 8 en fila, se prenden de a uno
//   14.6  la placa de Silencio con Dientes
//   17    partido real entre dos corredores (lo simula main.js) con el título encima
import { disenoDe, dibujarAuto } from './autos.js';
import { texto } from './fuente.js';
import { t as tr } from './idioma.js';

export const CINE = { juego: 17, fin: 21.5 };
export const RIVALES_INTRO = ['Silencio con Dientes', 'Gaucho de Ferrita'];

const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const AZUL = { cuerpo: '#3074f0', lado: '#1e44a4', techo: '#64a8ff', oscuro: '#182048' };
const NOMBRES = ['Chatarra', 'Ternero Diesel', 'Luz de Chacra', 'Pombero 2.0', 'Lobizon V8', 'Gaucho de Ferrita', 'Tanque Nandu', 'Silencio con Dientes'];
const CORTES = [4.6, 9.2, 11.6, 14.6, CINE.juego];

// ---------- sprites con caché (dibujar un auto grande cada cuadro es caro) ----------
const cache = new Map();
function sprite(nombre, ang, escala, silueta = false) {
  const k = `${nombre}|${ang.toFixed(3)}|${escala}|${silueta}`;
  if (cache.has(k)) return cache.get(k);
  const a = dibujarAuto(disenoDe(nombre), AZUL, ang, escala);
  if (silueta) {
    // solo se ven las luces: todo lo demás negro, con un borde frío arriba
    const c = a.getContext('2d'), img = c.getImageData(0, 0, a.width, a.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      if (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] < 200) { d[i] = 10; d[i + 1] = 8; d[i + 2] = 20; }
    }
    for (let y = 1; y < a.height - 1; y++) for (let x = 1; x < a.width - 1; x++) {
      const i = (y * a.width + x) * 4;
      if (d[i + 3] && !d[i - a.width * 4 + 3]) { d[i] = 60; d[i + 1] = 200; d[i + 2] = 230; }
    }
    c.putImageData(img, 0, 0);
  }
  cache.set(k, a);
  return a;
}

// ---------- la ruta en pseudo 3D ----------
// D: medidas de la escena. HZ horizonte, F cuánto se estira la profundidad, AB media ruta a z = 1.
const medidas = (W, H) => { const HZ = Math.round(H * 0.42); return { W, H, HZ, F: (H - HZ) / 158, AB: W * 0.54 }; };
const yDe = (D, z) => D.HZ + 60 * D.F / z;

function cielo(g, D, t) {
  const { W, HZ } = D;
  for (let y = 0; y < HZ; y++) {
    const k = y / HZ;
    g.fillStyle = `rgb(${Math.round(10 + 40 * k ** 3)},${Math.round(6 + 10 * k ** 2)},${Math.round(24 + 40 * k ** 2)})`;
    g.fillRect(0, y, W, 1);
  }
  // estrellas y píxeles muertos
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(hash(i, 1) * W), y = Math.floor(hash(i, 2) * (HZ - 20));
    if (hash(i, Math.floor(t * 3), 3) < 0.1) continue;
    g.fillStyle = i % 9 === 0 ? '#000' : `rgba(220,210,255,${0.25 + hash(i, 4) * 0.5})`;
    g.fillRect(x, y, i % 9 === 0 ? 3 : 1, i % 9 === 0 ? 3 : 1);
  }
  // la ciudad a lo lejos, con ventanitas
  for (let x = 0; x < W; x++) {
    const col = Math.floor(x / 7);
    const alto = 6 + Math.floor(hash(col, 7) * 22) + (Math.abs(x - W * 0.62) < 30 ? 14 : 0);
    g.fillStyle = '#0c0818'; g.fillRect(x, HZ - alto, 1, alto);
    if (x % 3 === 0 && hash(x, 8) < 0.25) { g.fillStyle = hash(x, 9) < 0.5 ? '#3ee8ff' : '#ff3c8c'; g.fillRect(x, HZ - alto + 2 + Math.floor(hash(x, 10) * (alto - 3)), 1, 1); }
  }
  const gr = g.createLinearGradient(0, HZ - 30, 0, HZ);
  gr.addColorStop(0, 'rgba(255,40,120,0)'); gr.addColorStop(1, 'rgba(255,40,120,.35)');
  g.fillStyle = gr; g.fillRect(0, HZ - 30, W, 30);
}
function ruta(g, D, t, velocidad = 1) {
  const { W, H, HZ, F, AB } = D;
  cielo(g, D, t);
  const viaje = t * 14 * velocidad;
  for (let y = HZ; y < H; y++) {
    const z = 60 * F / (y - HZ + 0.5), ancho = AB / z, centro = W / 2;
    const franja = Math.floor(z * 2 + viaje) % 2;            // las franjas que pasan dan la velocidad
    const niebla = Math.min(1, z / 40);
    const mezcla = (c) => c.map((v, i) => Math.round(v * (1 - niebla) + [40, 18, 60][i] * niebla));
    g.fillStyle = `rgb(${mezcla(franja ? [16, 30, 26] : [12, 24, 22])})`; g.fillRect(0, y, W, 1);
    g.fillStyle = `rgb(${mezcla(franja ? [220, 216, 200] : [150, 30, 40])})`; g.fillRect(Math.round(centro - ancho * 1.08), y, Math.round(ancho * 2.16), 1);
    g.fillStyle = `rgb(${mezcla(franja ? [40, 38, 52] : [34, 32, 46])})`; g.fillRect(Math.round(centro - ancho), y, Math.round(ancho * 2), 1);
    if (franja) { g.fillStyle = `rgb(${mezcla([210, 170, 60])})`; g.fillRect(Math.round(centro - Math.max(1, ancho * 0.02)), y, Math.max(1, Math.round(ancho * 0.04)), 1); }
  }
  // píxeles muertos al costado de la ruta, con el color corrido
  for (let i = 0; i < 18; i++) {
    const zz = ((hash(i, 11) * 40 - viaje) % 40 + 40) % 40 + 1;
    const y = yDe(D, zz), lado = hash(i, 12) < 0.5 ? -1 : 1;
    const x = Math.round(W / 2 + lado * (AB / zz) * (1.2 + hash(i, 13) * 2)), s = Math.max(1, Math.round(8 * F / zz));
    if (y > H) continue;
    g.fillStyle = 'rgba(255,40,90,.7)'; g.fillRect(x - 1, y, s, s); g.fillStyle = 'rgba(40,220,255,.7)'; g.fillRect(x + 1, y, s, s);
    g.fillStyle = '#000'; g.fillRect(x, y, s, s);
  }
}
// un auto en la ruta, de espaldas, a cierta profundidad (z: 1 cerca) y carril (-1 izquierda, 1 derecha)
function autoEnZ(g, D, nombre, z, carril, t, silueta = false) {
  const y = yDe(D, z), x = D.W / 2 + carril * (D.AB / z) * 0.5;
  const escala = Math.max(1, Math.min(4, Math.round(6.4 * D.F / z)));
  autoDeEspaldas(g, nombre, x, y, escala, silueta, Math.sin(t * 20 + carril) * 0.6);
}
function autoDeEspaldas(g, nombre, x, y, escala, silueta, vibra = 0) {
  const a = sprite(nombre, -Math.PI / 2, escala, silueta), alto = Math.round(a.height * 0.55);   // aplastado: se lee "de atrás y un poco de arriba"
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(Math.round(x - a.width * 0.28), Math.round(y + alto * 0.42), Math.round(a.width * 0.56), Math.max(1, escala));
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - alto / 2 + vibra), a.width, alto);
}

// ---------- los Hombres-Tanque: la misma silueta de la tribuna (sombrero, poncho), de cerca ----------
function hombre(g, x, pie, s, t, i) {
  x = Math.round(x); const y = Math.round(pie) - 11 * s;
  const r = (dx, dy, w, h) => g.fillRect(x + dx * s, y + dy * s, w * s, h * s);
  g.fillStyle = 'rgba(0,0,0,.45)'; r(-5, 11, 11, 1);
  g.fillStyle = '#0a0a10';
  r(-4, 0, 9, 1); r(-2, -2, 5, 2);            // sombrero
  r(-2, 1, 5, 3);                             // cabeza
  r(-3, 4, 7, 5); r(-4, 6, 9, 2);             // poncho
  r(-2, 9, 2, 2); r(1, 9, 2, 2);              // piernas
  g.fillStyle = '#23232e'; r(-4, 0, 1, 1); r(-3, 4, 1, 3);
  // aceite negro que gotea
  const gota = (t * 1.3 + i * 0.37) % 1;
  g.fillStyle = '#05040a'; r(2, 9 + gota * 3, 1, 1); if (s > 1) g.fillRect(x + 2 * s, y + 12 * s, s * 2, Math.max(1, s >> 1));
  // los ojos: de cerca, errores de renderizado (el color corrido y bloques negros)
  const e = Math.max(1, s);
  if (s >= 3 && hash(i, Math.floor(t * 9), 51) < 0.55) {
    const dx = Math.round((hash(i, Math.floor(t * 9), 52) - 0.5) * 3 * s);
    g.fillStyle = 'rgba(255,40,90,.85)'; g.fillRect(x - s - 1 + dx, y + 2 * s, e, e); g.fillRect(x + s - 1 + dx, y + 2 * s, e, e);
    g.fillStyle = 'rgba(40,220,255,.85)'; g.fillRect(x - s + 1 - dx, y + 2 * s, e, e); g.fillRect(x + s + 1 - dx, y + 2 * s, e, e);
    g.fillStyle = '#000'; g.fillRect(x + dx * 2, y + s + Math.round(hash(i, Math.floor(t * 9), 53) * 2 * s), s * 3, Math.max(1, s >> 1));
  }
  g.fillStyle = '#c8f4ff'; g.fillRect(x - s, y + 2 * s, e, e); g.fillRect(x + s, y + 2 * s, e, e);
}
function mojon(g, x, pie, s) {
  x = Math.round(x); pie = Math.round(pie);
  g.fillStyle = '#d8d4c4'; g.fillRect(x - 2 * s, pie - 7 * s, 4 * s, 7 * s);
  g.fillStyle = '#b02030'; g.fillRect(x - 2 * s, pie - 7 * s, 4 * s, 2 * s);
  g.fillStyle = '#8c8878'; g.fillRect(x + s, pie - 5 * s, s, 5 * s);
  if (s >= 3) texto(g, 'KM 404', x, pie - 7 * s - 10, { alinear: 'centro', color: '#fff4b0', sombra: '#000' });
}

// ---------- escenas ----------
function campo(g, D, t) {
  ruta(g, D, t, 0.35);
  // los píxeles muertos del campo: bloques negros que titilan, cada vez más
  const n = Math.round(6 + t * 5);
  for (let i = 0; i < n; i++) {
    if (hash(i, Math.floor(t * 6), 61) < 0.35) continue;
    const x = Math.floor(hash(i, 62) * D.W), y = Math.floor(D.HZ * 0.5 + hash(i, 63) * (D.H - D.HZ * 0.5 - 50)), s = 3 + Math.floor(hash(i, 64) * 6);
    g.fillStyle = 'rgba(255,40,90,.6)'; g.fillRect(x - 1, y, s, s); g.fillStyle = 'rgba(40,220,255,.6)'; g.fillRect(x + 1, y, s, s);
    g.fillStyle = '#000'; g.fillRect(x, y, s, s);
  }
  if (t < 1.5) { g.fillStyle = `rgba(0,0,0,${1 - t / 1.5})`; g.fillRect(0, 0, D.W, D.H); }
}
function banquina(g, D, t) {
  ruta(g, D, t, 0.357);                                  // misma velocidad que las figuras (2,5 de profundidad por segundo)
  const cosas = [[4, -1], [6.5, 1], [9, -1], [12, 1], [15, -1], [18, 1]].map(([z0, lado], i) => ({ z: z0 - t * 2.5, lado, i }));
  cosas.push({ z: 10.5 - t * 2.5, lado: 1, i: -1 });         // el mojón
  cosas.filter((c) => c.z > 0.85 && c.z < 30).sort((a, b) => b.z - a.z).forEach((c) => {
    const pie = yDe(D, c.z), s = Math.max(1, Math.min(7, Math.round(20 * D.F / c.z)));
    if (c.i < 0) mojon(g, D.W / 2 + (D.AB / c.z) * 1.2, pie, Math.max(1, Math.min(5, Math.round(12 * D.F / c.z))));
    else hombre(g, D.W / 2 + c.lado * (D.AB / c.z) * 1.45, pie, s, t, c.i);
  });
}
function luces(g, D, t) {
  ruta(g, D, t);
  const z = Math.max(1.5, 8 - t * 2.6);
  autoEnZ(g, D, 'Tanque Nandu', z + 3, 0.6, t, true);
  autoEnZ(g, D, 'Lobizon V8', z + 1.4, -0.7, t, true);
  autoEnZ(g, D, 'Silencio con Dientes', z, 0.1, t, true);
}
function fila(g, D, t) {
  ruta(g, D, t, 0.3);
  // dos filas, de espaldas: atrás los niveles 5 a 8, adelante del 1 al 4. Se prenden del 1 al 8.
  const prendidos = Math.min(8, Math.floor(t / 0.3) + 1), ancho = D.W >= 360;
  const yAtras = yDe(D, 4.1), yAdelante = yDe(D, 1.6);
  NOMBRES.forEach((n, i) => { if (i >= 4) autoDeEspaldas(g, n, D.W / 2 + (i - 5.5) * D.W * 0.13, yAtras, ancho ? 2 : 1, i >= prendidos); });
  NOMBRES.forEach((n, i) => { if (i < 4) autoDeEspaldas(g, n, D.W / 2 + (i - 1.5) * D.W * 0.225, yAdelante, ancho ? 3 : 2, i >= prendidos); });
}
function placa(g, D, t) {
  const { W, H } = D, nombre = 'Silencio con Dientes', color = '#ff3050', parado = W < 360;
  g.fillStyle = '#0e0a1c'; g.fillRect(0, 0, W, H);
  g.fillStyle = color;
  g.beginPath();
  if (parado) { g.moveTo(0, H * 0.46); g.lineTo(W, H * 0.36); g.lineTo(W, H); g.lineTo(0, H); } else { g.moveTo(W * 0.42, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.30, H); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(14,10,28,.55)';
  for (let i = 0; i < 40; i++) {
    const y = Math.floor(hash(i, 21) * H), largo = 30 + hash(i, 22) * 140;
    const x = ((hash(i, 23) * (W + 200) - t * 600 * (0.6 + hash(i, 24))) % (W + 200) + W + 200) % (W + 200) - 100;
    g.fillRect(Math.round(x), y, Math.round(largo), 1 + (i % 4 === 0 ? 1 : 0));
  }
  // el auto grande, entrando en diagonal
  const a = sprite(nombre, -Math.PI / 2 + 0.55, parado ? 4 : 5);
  const entra = Math.min(1, t / 0.35), x = (parado ? W * 0.5 : W * 0.72) + (1 - entra) * 120, y = parado ? H * 0.66 : H / 2;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 8, y + 14, a.width * 0.36, a.width * 0.18, -0.9, 0, Math.PI * 2); g.fill();
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - a.height / 2));
  // el número, gigante y tenue
  texto(g, '08', W - 10, H - 52, { esc: 6, alinear: 'der', color: 'rgba(14,10,28,.35)', sombra: null });
  // el nombre y el lema
  const esc = W >= 460 ? 4 : 3, x0 = parado ? 12 : 20;
  let yy = Math.round(H * (parado ? 0.1 : 0.22));
  for (const l of ['SILENCIO', 'CON DIENTES']) {
    texto(g, l, x0 + 3, yy + 3, { esc, color: '#000', sombra: null });
    texto(g, l, x0, yy, { esc, color: '#fff4b0', sombra: null });
    yy += 9 * esc;
  }
  g.fillStyle = color; g.fillRect(x0, yy + 2, 120, 3);
  texto(g, tr('cine6'), x0, yy + 12, { color: '#e8e4ff', sombra: '#000' });
}
// el final: abajo se ve un partido real (lo dibuja el juego); acá van las franjas de cine y el título
function cierre(g, D, t) {
  const { W, H } = D, f = Math.round(H * 0.11);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, f); g.fillRect(0, H - f, W, f);
  if (t < 1.3) return;
  g.fillStyle = 'rgba(12,10,20,.6)'; g.fillRect(0, f, W, H - 2 * f);
  const te = W >= 272 ? 4 : 3, y = Math.round(H / 2) - 22;
  texto(g, 'POTRERO 404', W / 2 + 2, y + 2, { esc: te, alinear: 'centro', color: '#ffb030', sombra: '#7a2a10' });
  texto(g, 'POTRERO 404', W / 2, y, { esc: te, alinear: 'centro', color: '#fff4b0', sombra: null });
  if (t > 1.9) {
    const frase = tr('cine7');
    texto(g, frase, W / 2, y + 9 * te + 6, { esc: frase.length * 12 <= W - 12 ? 2 : 1, alinear: 'centro', color: '#c8f4ff', sombra: '#000' });
  }
}

// ---------- carteles y cortes ----------
// frase en una o dos líneas ("a|b"), sobre una banda oscura, con el tamaño más grande que entre
function cartel(g, D, clave, t, desde, hasta) {
  if (t < desde || t >= hasta) return;
  const lineas = tr(clave).split('|'), largo = Math.max(...lineas.map((l) => l.length));
  const esc = largo * 12 <= D.W - 12 ? 2 : 1, paso = 9 * esc + 1, alto = lineas.length * paso + 5;
  const y = D.H - alto - Math.round(D.H * 0.07);
  g.globalAlpha = Math.max(0, Math.min(1, (t - desde) / 0.3, (hasta - t) / 0.3));
  g.fillStyle = 'rgba(6,4,16,.72)'; g.fillRect(0, y - 5, D.W, alto + 4);
  lineas.forEach((l, i) => texto(g, l, D.W / 2, y + i * paso, { esc, alinear: 'centro', color: '#fff4b0', sombra: '#000' }));
  g.globalAlpha = 1;
}
function glitch(g, D, k) {
  const { W, H } = D, img = g.getImageData(0, 0, W, H), d = img.data, o = new Uint8ClampedArray(d), dx = 3 + k * 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    d[i] = o[(y * W + Math.min(W - 1, x + dx)) * 4]; d[i + 2] = o[(y * W + Math.max(0, x - dx)) * 4 + 2];
  }
  g.putImageData(img, 0, 0);
  for (let n = 0; n < 18; n++) { g.fillStyle = n % 3 ? '#000' : 'rgba(40,220,255,.7)'; g.fillRect(Math.floor(hash(n, k, 11) * W), Math.floor(hash(n, k, 12) * H), 8 + Math.floor(hash(n, k, 13) * 50), 2 + Math.floor(hash(n, k, 14) * 6)); }
}

// Dibuja el cuadro del segundo t (contado desde que termina el logo) en un lienzo de W×H.
export function dibujarCinematica(g, W, H, t) {
  const D = medidas(W, H);
  if (t < 4.6) campo(g, D, t);
  else if (t < 9.2) banquina(g, D, t - 4.6);
  else if (t < 11.6) luces(g, D, t - 9.2);
  else if (t < 14.6) fila(g, D, t - 11.6);
  else if (t < CINE.juego) placa(g, D, t - 14.6);
  else cierre(g, D, t - CINE.juego);
  cartel(g, D, 'cine1', t, 0.7, 2.7);
  cartel(g, D, 'cine2', t, 2.8, 4.5);
  cartel(g, D, 'cine3', t, 5.0, 9.1);
  cartel(g, D, 'cine4', t, 9.4, 12.2);
  cartel(g, D, 'cine5', t, 12.4, 14.5);
  // corte con el color corrido al entrar a cada escena
  for (const c of CORTES) if (t >= c && t < c + 0.07) glitch(g, D, t < c + 0.035 ? 1 : 0);
}

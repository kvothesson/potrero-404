// Opening de Potrero 404 (videoclip horizontal con la canción "Ruta Cuatro Cero Cuatro").
// Lienzo de pixel art de 480x270 que se exporta ampliado 4 veces (1920x1080). Mismos autos y fuente
// que el juego. Escenas:
//   titulo  · la Ruta 404 en pseudo 3D hacia el horizonte (ruta arcade), cielo con píxeles muertos y el título
//   placa   · presentación de un corredor, estilo opening de anime: auto grande, nombre, estilo y nivel
//   tabla   · la tabla real del día (datos.json) con el puesto 1 marcado: ¿sos el primero?
// Se abre en el servidor local: /cortos/opening.html. Desde la consola: await opening.cuadro('titulo', t),
// opening.guardar('nombre') manda el PNG grande a /captura (queda en server/datos/).
import { disenoDe, dibujarAuto } from '../src/autos.js';
import { nuevoEstado, paso } from '../src/sim.js';
import { crearBot } from '../src/bot.js';
import { crearPintor } from '../src/render-pixel.js';
import { texto } from '../src/fuente.js';

const W = 480, H = 270, ESC = 4;
const lienzo = document.getElementById('lienzo');
const g = lienzo.getContext('2d');
g.imageSmoothingEnabled = false;
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const AZUL = { cuerpo: '#3074f0', lado: '#1e44a4', techo: '#64a8ff', oscuro: '#182048' };

export const CORREDORES = {
  'Chatarra': { nivel: 1, estilo: 'perseguidor', lema: 'arma con lo que hay', color: '#c8683a' },
  'Ternero Diesel': { nivel: 2, estilo: 'choque', lema: 'va de frente y no frena', color: '#e8dcc0' },
  'Luz de Chacra': { nivel: 3, estilo: 'arquero', lema: 'cierra el arco con su lámpara', color: '#ffd860' },
  'Pombero 2.0': { nivel: 4, estilo: 'pared', lema: 'aparece por la banda y se escapa', color: '#b8a050' },
  'Lobizon V8': { nivel: 5, estilo: 'nitro', lema: 'vive del aceite negro', color: '#ffb020' },
  'Gaucho de Ferrita': { nivel: 6, estilo: 'gambeta', lema: 'la lleva pegada', color: '#80d8ff' },
  'Tanque Nandu': { nivel: 7, estilo: 'contra', lema: 'espera atrás y sale', color: '#a8c070' },
  'Silencio con Dientes': { nivel: 8, estilo: 'completo', lema: 'el que nadie oye venir', color: '#ff3050' },
};

// ---------- la ruta en pseudo 3D ----------
const HORIZONTE = 112;
function cielo(t) {
  for (let y = 0; y < HORIZONTE; y++) {
    const k = y / HORIZONTE;
    g.fillStyle = `rgb(${Math.round(10 + 40 * k ** 3)},${Math.round(6 + 10 * k ** 2)},${Math.round(24 + 40 * k ** 2)})`;
    g.fillRect(0, y, W, 1);
  }
  // estrellas y píxeles muertos en el cielo
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(hash(i, 1) * W), y = Math.floor(hash(i, 2) * (HORIZONTE - 20));
    if (hash(i, Math.floor(t * 3), 3) < 0.1) continue;
    g.fillStyle = i % 9 === 0 ? '#000' : `rgba(220,210,255,${0.25 + hash(i, 4) * 0.5})`;
    g.fillRect(x, y, i % 9 === 0 ? 3 : 1, i % 9 === 0 ? 3 : 1);
  }
  // la ciudad a lo lejos: siluetas con ventanitas cian
  for (let x = 0; x < W; x += 1) {
    const col = Math.floor(x / 7);
    const alto = 6 + Math.floor(hash(col, 7) * 22) + (Math.abs(x - 300) < 30 ? 14 : 0);
    g.fillStyle = '#0c0818'; g.fillRect(x, HORIZONTE - alto, 1, alto);
    if (x % 3 === 0 && hash(x, 8) < 0.25) { g.fillStyle = hash(x, 9) < 0.5 ? '#3ee8ff' : '#ff3c8c'; g.fillRect(x, HORIZONTE - alto + 2 + Math.floor(hash(x, 10) * (alto - 3)), 1, 1); }
  }
  // resplandor sobre el horizonte
  const gr = g.createLinearGradient(0, HORIZONTE - 30, 0, HORIZONTE);
  gr.addColorStop(0, 'rgba(255,40,120,0)'); gr.addColorStop(1, 'rgba(255,40,120,.35)');
  g.fillStyle = gr; g.fillRect(0, HORIZONTE - 30, W, 30);
}
function rutaArcade(t, { curva = 0, velocidad = 1 } = {}) {
  cielo(t);
  const viaje = t * 14 * velocidad;
  for (let y = HORIZONTE; y < H; y++) {
    const z = 60 / (y - HORIZONTE + 0.5);                  // distancia de esta línea
    const ancho = 260 / z;                                  // media ruta en pantalla
    const centro = W / 2 + curva * (z * z) * 0.6;
    const franja = Math.floor(z * 2 + viaje) % 2;           // las franjas que pasan dan la velocidad
    const niebla = Math.min(1, z / 40);
    const mezcla = (c) => c.map((v, i) => Math.round(v * (1 - niebla) + [40, 18, 60][i] * niebla));
    const pasto = mezcla(franja ? [16, 30, 26] : [12, 24, 22]);
    const asfalto = mezcla(franja ? [40, 38, 52] : [34, 32, 46]);
    const banq = mezcla(franja ? [220, 216, 200] : [150, 30, 40]);
    g.fillStyle = `rgb(${pasto})`; g.fillRect(0, y, W, 1);
    g.fillStyle = `rgb(${banq})`; g.fillRect(Math.round(centro - ancho * 1.08), y, Math.round(ancho * 2.16), 1);
    g.fillStyle = `rgb(${asfalto})`; g.fillRect(Math.round(centro - ancho), y, Math.round(ancho * 2), 1);
    if (franja) { g.fillStyle = `rgb(${mezcla([210, 170, 60])})`; g.fillRect(Math.round(centro - Math.max(1, ancho * 0.02)), y, Math.max(1, Math.round(ancho * 0.04)), 1); }
  }
  // píxeles muertos sobre la ruta, con el color corrido
  for (let i = 0; i < 18; i++) {
    const zz = ((hash(i, 11) * 40 - t * 14) % 40 + 40) % 40 + 1;
    const y = HORIZONTE + 60 / zz, lado = hash(i, 12) < 0.5 ? -1 : 1;
    const x = W / 2 + lado * (260 / zz) * (1.2 + hash(i, 13) * 2);
    const s = Math.max(1, Math.round(8 / zz));
    if (y > H) continue;
    g.fillStyle = 'rgba(255,40,90,.7)'; g.fillRect(x - 1, y, s, s); g.fillStyle = 'rgba(40,220,255,.7)'; g.fillRect(x + 1, y, s, s);
    g.fillStyle = '#000'; g.fillRect(x, y, s, s);
  }
}
// auto visto de atrás en la ruta arcade: el mismo diseño, girado mirando al horizonte
function autoEnRuta(nombre, x, y, escala, t) {
  const a = dibujarAuto(disenoDe(nombre), AZUL, -Math.PI / 2, escala);
  // aplastado en vertical para que se lea "de atrás y un poco de arriba"
  const alto = Math.round(a.height * 0.55);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(Math.round(x - a.width * 0.28), Math.round(y + alto * 0.42), Math.round(a.width * 0.56), 3);
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - alto / 2 + Math.sin(t * 20) * 0.6), a.width, alto);
}
function tituloLogo(t, y = 40) {
  const sacude = (hash(Math.floor(t * 12), 5) - 0.5) * 2;
  const esc = 5, txt = 'RUTA 404', ancho = txt.length * 6 * esc - esc, x0 = W / 2 - ancho / 2;
  texto(g, txt, W / 2 + 3, y + 3, { esc, alinear: 'centro', color: '#7a2a10', sombra: null });
  texto(g, txt, W / 2 - 2 + sacude, y, { esc, alinear: 'centro', color: 'rgba(255,40,90,.85)', sombra: null });
  texto(g, txt, W / 2 + 2 - sacude, y + 1, { esc, alinear: 'centro', color: 'rgba(40,220,255,.85)', sombra: null });
  texto(g, txt, W / 2, y, { esc, alinear: 'centro', color: '#fff4b0', sombra: null });
  texto(g, 'potrero 404 · fútbol con autos', W / 2, y + 44, { esc: 1, alinear: 'centro', color: '#c8c2ea', sombra: '#000' });
  return x0;
}
function titulo(t) {
  rutaArcade(t);
  autoAtras('Lobizon V8', W / 2 + 56, 196, 2, t + 1);
  autoAtras('Silencio con Dientes', W / 2 - 40, 236, 3, t);
  tituloLogo(t);
}

// ---------- placa de presentación de un corredor ----------
function placa(nombre, t) {
  const c = CORREDORES[nombre];
  // fondo partido en diagonal: oscuro y el color del corredor, con líneas de velocidad
  g.fillStyle = '#0e0a1c'; g.fillRect(0, 0, W, H);
  g.fillStyle = c.color;
  g.beginPath(); g.moveTo(W * 0.42, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.30, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(14,10,28,.55)';
  for (let i = 0; i < 40; i++) {
    const y = Math.floor(hash(i, 21) * H), largo = 30 + hash(i, 22) * 140;
    const x = ((hash(i, 23) * (W + 200) - t * 600 * (0.6 + hash(i, 24))) % (W + 200) + W + 200) % (W + 200) - 100;
    g.fillRect(Math.round(x), y, Math.round(largo), 1 + (i % 4 === 0 ? 1 : 0));
  }
  // el auto grande, entrando en diagonal
  const a = dibujarAuto(disenoDe(nombre), AZUL, -Math.PI / 2 + 0.55, 5);
  const entra = Math.min(1, t / 0.35), x = W * 0.66 + (1 - entra) * 120;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 8, H / 2 + 14, 62, 30, -0.9, 0, Math.PI * 2); g.fill();
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(H / 2 - a.height / 2));
  // el nombre y los datos, a la izquierda
  const partes = nombre.split(' ');
  const lineas = partes.length > 2 ? [partes[0], partes.slice(1).join(' ')] : partes.length === 2 && nombre.length > 10 ? partes : [nombre];
  let y = 70;
  lineas.forEach((l) => {
    texto(g, l, 22 + 3, y + 3, { esc: 4, color: '#000', sombra: null });
    texto(g, l, 22, y, { esc: 4, color: '#fff4b0', sombra: null });
    y += 36;
  });
  g.fillStyle = c.color; g.fillRect(22, y + 2, 120, 3);
  texto(g, c.lema, 22, y + 14, { esc: 1, color: '#e8e4ff', sombra: '#000' });
  texto(g, `nivel ${c.nivel} · ${c.estilo}`, 22, y + 30, { esc: 1, color: c.color, sombra: '#000' });
  // número de corredor, gigante y tenue (como en los openings)
  texto(g, `0${c.nivel}`, W - 14, H - 46, { esc: 6, alinear: 'der', color: 'rgba(14,10,28,.35)', sombra: null });
}

// ---------- la tabla real con el puesto 1 marcado ----------
let datos = null;
async function tabla(t, { pregunta = true, titulo = 'la tabla, hoy', cierre = false } = {}) {
  datos = datos || await fetch('./datos.json', { cache: 'no-store' }).then((r) => r.json());
  g.fillStyle = '#0a0716'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { if (hash(i, Math.floor(t * 5), 31) < 0.3) continue; g.fillStyle = '#000'; g.fillRect(Math.floor(hash(i, 32) * W), Math.floor(hash(i, 33) * H), 3, 3); }
  texto(g, titulo, W / 2, 14, { esc: 2, alinear: 'centro', color: '#c8c2ea', sombra: '#000' });
  const x0 = 120, x1 = W - 120;
  let y = 40;
  for (const f of datos.tabla.slice(0, 9)) {
    const uno = f.puesto === 1;
    if (uno) {
      const titila = Math.floor(t * 4) % 2 === 0;
      g.fillStyle = titila ? 'rgba(255,48,80,.28)' : 'rgba(255,48,80,.14)'; g.fillRect(x0 - 10, y - 4, x1 - x0 + 20, 16);
      g.strokeStyle = '#ff3050'; g.strokeRect(x0 - 10.5, y - 4.5, x1 - x0 + 21, 17);
    }
    texto(g, f.puesto, x0 + 12, y, { alinear: 'der', color: uno ? '#ffd040' : '#8f88c0', sombra: null });
    texto(g, f.nombre + (f.ia ? '' : '  ·  humano'), x0 + 24, y, { color: f.ia ? '#e8e4ff' : '#7cf09a', sombra: null });
    texto(g, f.elo, x1, y, { alinear: 'der', color: '#fff4b0', sombra: null });
    y += 18;
  }
  if (cierre) texto(g, 'kvothesson.com/potrero-404', W / 2, H - 44, { esc: 2, alinear: 'centro', color: '#ffb030', sombra: '#3a1a04' });
  else if (pregunta) texto(g, '¿sos el primero?', W / 2, H - 46, { esc: 3, alinear: 'centro', color: '#fff', sombra: '#3a0a18' });
  texto(g, `${datos.humanos} humano${datos.humanos === 1 ? '' : 's'} en la tabla · datos del ${datos.fecha}`, W / 2, H - 16, { alinear: 'centro', color: '#6f68a0', sombra: null });
}


// ---------- sprites con caché (dibujar un auto grande cada cuadro es caro) ----------
const cacheAutos = new Map();
function sprite(nombre, ang, escala, silueta = false) {
  const k = `${nombre}|${ang.toFixed(3)}|${escala}|${silueta}`;
  if (cacheAutos.has(k)) return cacheAutos.get(k);
  const a = dibujarAuto(disenoDe(nombre), AZUL, ang, escala);
  if (silueta) {
    // solo se ven las luces: todo lo demás negro con un borde frío
    const c = a.getContext('2d'), img = c.getImageData(0, 0, a.width, a.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      if (lum < 200) { d[i] = 10; d[i + 1] = 8; d[i + 2] = 20; }
    }
    for (let y = 1; y < a.height - 1; y++) for (let x = 1; x < a.width - 1; x++) {
      const i = (y * a.width + x) * 4;
      if (d[i + 3] && !d[i - a.width * 4 + 3]) { d[i] = 60; d[i + 1] = 200; d[i + 2] = 230; }   // luz de la ciudad desde arriba
    }
    c.putImageData(img, 0, 0);
  }
  cacheAutos.set(k, a);
  return a;
}

// Vista de atrás para la ruta: se arma desde el diseño visto de arriba. Arriba el techo muy aplastado
// (apenas asoma), abajo la cola del auto con sus luces rojas, el paragolpes y las ruedas. Así el auto
// apoya en la ruta y no parece que va haciendo willy.
function trasera(nombre, escala, silueta = false) {
  const k = `tras|${nombre}|${escala}|${silueta}`;
  if (cacheAutos.has(k)) return cacheAutos.get(k);
  const d = disenoDe(nombre);
  const arriba = dibujarAuto(d, AZUL, -Math.PI / 2, escala);
  const T = arriba.width, px = arriba.getContext('2d').getImageData(0, 0, T, T).data;
  let x0 = T, x1 = -1, y0 = T, y1 = -1;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (px[(y * T + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, costado = d.alto * escala, filasTecho = (y1 - y0 + 1) - costado;
  const altoTecho = Math.max(2, Math.round(filasTecho * 0.2)), altoCola = escala * 5, rueda = escala * 2;
  const pad = escala * 2, W2 = w + pad * 2, H2 = altoTecho + altoCola + rueda + 2;
  const o = document.createElement('canvas'); o.width = W2; o.height = H2;
  const c = o.getContext('2d'); c.imageSmoothingEnabled = false;
  // ruedas, abajo en las puntas
  c.fillStyle = '#1a1a1e';
  c.fillRect(pad - escala, altoTecho + altoCola - rueda, escala * 4, rueda * 2);
  c.fillRect(pad + w - escala * 3, altoTecho + altoCola - rueda, escala * 4, rueda * 2);
  // la cola: el color del costado del diseño, más oscuro abajo
  const muestra = (x, y) => { const i = (y * T + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  for (let x = 0; x < w; x++) {
    const m = muestra(x0 + x, y1 - Math.floor(costado / 2));
    if (!m[3]) continue;
    for (let y = 0; y < altoCola; y++) {
      const f = y > altoCola - escala ? 0.55 : 1 - y / altoCola * 0.25;
      c.fillStyle = `rgb(${Math.round(m[0] * f)},${Math.round(m[1] * f)},${Math.round(m[2] * f)})`;
      c.fillRect(pad + x, altoTecho + y, 1, 1);
    }
  }
  // luces traseras y una luz más clara adentro
  const ly = altoTecho + Math.round(escala * 1.2), lh = Math.max(1, Math.round(escala * 1.4)), lw = Math.max(2, Math.round(w * 0.2));
  c.fillStyle = '#ff3c3c'; c.fillRect(pad + Math.round(w * 0.06), ly, lw, lh); c.fillRect(pad + w - Math.round(w * 0.06) - lw, ly, lw, lh);
  c.fillStyle = '#ffb0a0'; c.fillRect(pad + Math.round(w * 0.06) + 1, ly, Math.max(1, lw - 2), Math.max(1, lh - 1)); c.fillRect(pad + w - Math.round(w * 0.06) - lw + 1, ly, Math.max(1, lw - 2), Math.max(1, lh - 1));
  // el techo, aplastado arriba de la cola
  c.drawImage(arriba, x0, y0, w, filasTecho, pad, 0, w, altoTecho);
  // contorno de 1 píxel
  const img = c.getImageData(0, 0, W2, H2), q = img.data, borde = [];
  const hay = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && q[(y * W2 + x) * 4 + 3] > 0;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (!hay(x, y) && (hay(x + 1, y) || hay(x - 1, y) || hay(x, y + 1) || hay(x, y - 1))) borde.push((y * W2 + x) * 4);
  for (const i of borde) { q[i] = 20; q[i + 1] = 15; q[i + 2] = 34; q[i + 3] = 255; }
  if (silueta) {
    for (let i = 0; i < q.length; i += 4) {
      if (!q[i + 3]) continue;
      const lum = 0.3 * q[i] + 0.59 * q[i + 1] + 0.11 * q[i + 2];
      if (lum < 200 && q[i] < 220) { q[i] = 10; q[i + 1] = 8; q[i + 2] = 20; }
    }
    for (let y = 1; y < H2; y++) for (let x = 0; x < W2; x++) { const i = (y * W2 + x) * 4; if (q[i + 3] && !q[i - W2 * 4 + 3]) { q[i] = 60; q[i + 1] = 200; q[i + 2] = 230; } }
  }
  c.putImageData(img, 0, 0);
  cacheAutos.set(k, o);
  return o;
}
function autoAtras(nombre, x, yPiso, escala, t, silueta = false) {
  const a = trasera(nombre, escala, silueta);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(Math.round(x - a.width * 0.45), Math.round(yPiso - 1), Math.round(a.width * 0.9), Math.max(1, escala));
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(yPiso - a.height + Math.sin(t * 20 + x) * 0.5));
}
const NOMBRES = Object.keys(CORREDORES);
// un auto en la ruta arcade a cierta profundidad (z: 1 cerca, 6 lejos) y carril (-1 izquierda, 1 derecha)
function autoEnZ(nombre, z, carril, t, silueta = false) {
  const y = HORIZONTE + 60 / z, ancho = 260 / z;
  const x = W / 2 + carril * ancho * 0.5;
  const escala = Math.max(1, Math.min(4, Math.round(4 / z * 1.6)));
  autoAtras(nombre, x, y, escala, t, silueta);
}
function fundido(nivel) { if (nivel > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, nivel)})`; g.fillRect(0, 0, W, H); } }
function glitch(k) {
  const img = g.getImageData(0, 0, W, H), d = img.data, o = new Uint8ClampedArray(d);
  const dx = 3 + k * 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    d[i] = o[(y * W + Math.min(W - 1, x + dx)) * 4]; d[i + 2] = o[(y * W + Math.max(0, x - dx)) * 4 + 2];
  }
  g.putImageData(img, 0, 0);
  for (let n = 0; n < 18; n++) { g.fillStyle = n % 3 ? '#000' : 'rgba(40,220,255,.7)'; g.fillRect(Math.floor(hash(n, k, 11) * W), Math.floor(hash(n, k, 12) * H), 8 + Math.floor(hash(n, k, 13) * 50), 2 + Math.floor(hash(n, k, 14) * 6)); }
}

// ---------- escenas de la ruta ----------
function intro(t) {
  rutaArcade(t, { velocidad: Math.min(1, 0.25 + t / 10) });
  // dos pares de luces que se acercan desde el horizonte
  const z = Math.max(1.3, 9 - t * 0.6);
  if (t > 4) autoEnZ('Silencio con Dientes', z, -0.5, t, true);
  if (t > 7) autoEnZ('Tanque Nandu', Math.max(1.6, z + 2.5), 0.55, t, true);
  fundido(1 - t / 3);
}
function siluetas(t, i) {
  rutaArcade(t);
  // un corredor que pasa cerca, todavía sin mostrarse
  const k = t % 1.8676 / 1.8676, nombre = NOMBRES[i % 8];
  autoEnZ(NOMBRES[(i + 3) % 8], 7 - k * 2, i % 2 ? -0.5 : 0.5, t, true);
  autoEnZ(nombre, 4 - k * 2.8, i % 2 ? 0.6 : -0.6, t, true);
}
function fila(t) {
  rutaArcade(t, { velocidad: 0.3 });
  // los 8 en dos filas en la ruta, de espaldas: atrás los niveles 5 a 8, adelante del 1 al 4.
  // Se prenden de a uno con el pulso, del 1 al 8.
  const prendidos = Math.min(8, Math.floor(t / 0.4669) + 1);
  const dibujar = (n, i, x, y, escala) => autoAtras(n, x, y, escala, t, i >= prendidos);
  NOMBRES.forEach((n, i) => { if (i >= 4) dibujar(n, i, W / 2 + (i - 5.5) * 62, 150, 2); });
  NOMBRES.forEach((n, i) => { if (i < 4) dibujar(n, i, W / 2 + (i - 1.5) * 108, 212, 3); });
}
function carrera(t, semilla = 0) {
  rutaArcade(t, { curva: Math.sin(t * 0.4 + semilla) * 1.2, velocidad: 1.6 });
  const orden = NOMBRES.map((n, i) => ({ n, z: 1.4 + ((hash(i, semilla, 41) * 6 + t * (0.25 + hash(i, semilla, 42) * 0.5)) % 6), c: (hash(i, semilla, 43) - 0.5) * 1.6 }));
  orden.sort((a, b) => b.z - a.z).forEach((o) => autoEnZ(o.n, o.z, o.c, t));
}
function outro(t) {
  rutaArcade(t, { velocidad: Math.max(0, 1 - t / 7) });
  autoEnZ('Lobizon V8', 3, 0.5, t, t > 4.5);
  autoEnZ('Silencio con Dientes', 2.2, -0.4, t, t > 3);
  fundido(Math.min(0.85, t / 8));
}

// ---------- subtítulos tipo karaoke ----------
const SUBS = [
  [101.02, 103.1, '¡Ruta cuatro cero cuatro!'], [103.24, 110.2, 'Humanos y máquinas en la misma tabla.'],
  [110.24, 112.6, '¡Ruta cuatro cero cuatro!'], [112.88, 116.6, 'Nadie te espera, nadie te salva.'],
  [117.36, 120.45, 'Pisá el nitro, prendé la noche,'], [120.48, 125.5, 'que la tabla es real y no perdona.'],
  [125.54, 127.9, '¡Ruta cuatro cero cuatro!'], [128.2, 133.0, 'Vení a ganarte el nombre en la ruta.'],
  [173.28, 176.4, 'Ningún humano le jugó todavía.'], [176.6, 179.6, 'Ninguno.'],
  [179.7, 182.3, 'uno... uno... uno...'], [182.56, 184.4, '¿Sos el primero?'],
  [200.44, 202.8, '¡Ruta cuatro cero cuatro!'],
  [217.19, 219.7, '¡Ruta cuatro cero cuatro!'], [219.88, 225.6, 'Humanos y máquinas en la misma tabla.'],
  [226.26, 228.8, '¡Ruta cuatro cero cuatro!'], [228.96, 232.8, 'Nadie te espera, nadie te salva.'],
  [233.4, 236.4, 'Pisá el nitro, prendé la noche,'], [236.42, 241.6, 'que la tabla es real y no perdona.'],
  [241.68, 244.2, '¡Ruta cuatro cero cuatro!'], [244.34, 249.2, '¡Vení a ganarte el nombre en la ruta!'],
  [252.82, 258.0, 'Se apaga el motor...'], [261.22, 265.0, 'la tabla sigue.'],
];
function subtitulo(T) {
  const s = SUBS.find(([a, b]) => T >= a && T < b);
  if (!s) return;
  const [a, b, txt] = s;
  const esc = 2, ancho = txt.length * 6 * esc - esc, x0 = Math.round(W / 2 - ancho / 2), y = H - 30;
  g.fillStyle = 'rgba(6,4,16,.7)'; g.fillRect(x0 - 8, y - 6, ancho + 16, 26);
  // lo ya cantado en amarillo, lo que falta en blanco tenue (avance parejo dentro de la línea)
  const hecho = Math.floor(txt.length * Math.min(1, (T - a) / Math.max(0.5, (b - a) * 0.85)));
  texto(g, txt, x0, y, { esc, color: 'rgba(232,228,255,.55)', sombra: '#000' });
  if (hecho > 0) texto(g, txt.slice(0, hecho), x0, y, { esc, color: '#fff4b0', sombra: '#000' });
}

// ---------- jugadas reales: partidos entre IAs, con el render del juego ----------
let pintor = null, jugadaActual = null;
const rngJ = (semilla) => { let a = semilla >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function empezarJugada(a, b, semilla, { gol = false, golAl = 0.75, largo = 2 } = {}) {
  const canvas = document.getElementById('juego');
  if (!pintor) pintor = crearPintor(canvas, { cancha: 'ruta404' });
  const A = CORREDORES[a], B = CORREDORES[b];
  const crear = () => {
    const azar = Math.random; Math.random = rngJ(semilla); const s = nuevoEstado(); Math.random = azar;
    return { s, bots: [crearBot(0, A.nivel, A.estilo, { semilla }), crearBot(1, B.nivel, B.estilo, { semilla: semilla + 1 })] };
  };
  // primera pasada: el partido entero, para saber cuándo hay goles y cuándo la pelota está en juego
  const enJuego = [], goles = [];
  {
    const { s, bots } = crear();
    for (let n = 0; n < 60 * 60 * 6 && s.fase !== 'fin'; n++) {
      paso(s, [bots[0](s), bots[1](s)]);
      enJuego.push(s.fase === 'juego');
      if (n > 300 && s.eventos.some((e) => e.t === 'gol')) goles.push(n);
    }
  }
  const cuadros = Math.round(largo * 60) + 30;
  let inicio;
  if (gol) {
    if (!goles.length) return null;
    inicio = goles[0] - Math.round(largo * golAl * 60);
  } else {
    // un tramo con la pelota en juego de punta a punta, a partir de un momento que depende de la semilla
    const libre = (a) => a > 200 && a + cuadros < enJuego.length && enJuego.slice(a, a + cuadros).every(Boolean);
    inicio = -1;
    for (let a = 600 + (semilla * 137) % 2400, k = 0; k < enJuego.length; k++, a = (a + 37) % enJuego.length) if (libre(a)) { inicio = a; break; }
    if (inicio < 0) return null;
  }
  const j = crear();
  for (let n = 0; n < inicio - 90; n++) { paso(j.s, [j.bots[0](j.s), j.bots[1](j.s)]); if (j.s.fase === 'fin') return null; }
  pintor.limpiarMarcas();
  const extra = { pantalla: 'bot', seguir: 0, red: { nombres: [a, b], listo: true, jugadores: 2, lado: -1 } };
  for (let n = 0; n < 90; n++) { paso(j.s, [j.bots[0](j.s), j.bots[1](j.s)]); pintor.dibujar(j.s, extra); }
  jugadaActual = { ...j, extra, a, b, canvas };
  return jugadaActual;
}
function cuadroJugada() {
  const j = jugadaActual;
  for (let k = 0; k < 2; k++) { if (j.s.fase !== 'fin') paso(j.s, [j.bots[0](j.s), j.bots[1](j.s)]); pintor.dibujar(j.s, j.extra); }
  g.drawImage(j.canvas, 0, 0, W, H);
  g.fillStyle = 'rgba(6,4,16,.7)'; g.fillRect(0, 0, W, 14);
  texto(g, `${j.a} vs ${j.b} · partido real entre ias`, 6, 4, { color: '#c8c2ea', sombra: null });
}

// ---------- el guion: qué escena va en cada momento de la canción ----------
// Pulsos de la canción (ruta404.analisis.json): los cortes caen en el pulso más cercano.
let analisis = null;
function alPulso(t) { if (!analisis) return t; const p = analisis.pulsos; let m = p[0]; for (const x of p) if (Math.abs(x - t) < Math.abs(m - t)) m = x; return m; }
const COMPAS = 1.8676;
function armarGuion() {
  const G = [];
  const tramo = (desde, hasta, escena, op = {}) => G.push({ desde: alPulso(desde), hasta: alPulso(hasta), escena, ...op });
  tramo(0, 12.5, 'intro');
  tramo(12.5, 24.2, 'titulo', { corte: true });
  for (let t = 24.2, i = 0; t < 44.2; t += COMPAS, i++) tramo(t, Math.min(44.3, t + COMPAS), 'siluetas', { i });
  // verso 1: jugadas y la ruta, de a dos compases
  const CARTELES = ['juegan solos mientras no estás', 'ven la cancha con 200 ms, como vos', 'mismas teclas que vos', 'ocho motores que no duermen'];
  for (let t = 44.3, i = 0; t < 88.1; t += COMPAS * 2, i++) {
    if (i % 3 === 2) tramo(t, Math.min(88.2, t + COMPAS * 2), 'carrera', { semilla: i, corte: true });
    else tramo(t, Math.min(88.2, t + COMPAS * 2), 'jugada', { par: i, semilla: 100 + i, corte: true, cartel: CARTELES[i % 4] });
  }
  tramo(88.2, 101.0, 'tabla', { titulo: 'se mueve sola', pregunta: false, corte: true });
  // estribillo: un corte por compás
  for (let t = 101.0, i = 0; t < 132.9; t += COMPAS, i++) {
    if (i % 4 === 3) tramo(t, Math.min(133, t + COMPAS), 'carrera', { semilla: 20 + i, corte: true });
    else tramo(t, Math.min(133, t + COMPAS), 'jugada', { par: 20 + i, semilla: 300 + i, corte: true });
  }
  tramo(133, 140.8, 'fila', { corte: true });
  const C = [['Chatarra', 140.8], ['Ternero Diesel', 144.62], ['Luz de Chacra', 149.02], ['Pombero 2.0', 151.84],
    ['Lobizon V8', 155.12], ['Gaucho de Ferrita', 160.1], ['Tanque Nandu', 163.14], ['Silencio con Dientes', 168.64]];
  C.forEach(([n, t0], i) => G.push({ desde: i ? t0 - 0.15 : alPulso(140.8), hasta: i < 7 ? C[i + 1][1] - 0.15 : alPulso(173.3), escena: 'placa', nombre: n, corte: true }));
  tramo(173.3, 184.5, 'tabla', { titulo: 'la tabla, hoy', preguntaDesde: 182.56, corte: true });
  // el drop: goles, uno por compás
  for (let t = 184.5, i = 0; t < 200.3; t += COMPAS, i++) tramo(t, Math.min(200.4, t + COMPAS), 'jugada', { par: 40 + i, semilla: 500 + i, gol: true, corte: true });
  // estribillo final: jugadas, carrera y placas relámpago
  for (let t = 200.4, i = 0; t < 248.7; t += COMPAS, i++) {
    const r = i % 5;
    if (r === 1) tramo(t, Math.min(248.8, t + COMPAS), 'carrera', { semilla: 60 + i, corte: true });
    else if (r === 3) tramo(t, Math.min(248.8, t + COMPAS), 'placa', { nombre: NOMBRES[(i * 3) % 8], corte: true });
    else tramo(t, Math.min(248.8, t + COMPAS), 'jugada', { par: 60 + i, semilla: 700 + i, gol: i % 2 === 0, corte: true });
  }
  tramo(248.8, 261.2, 'outro', { corte: true });
  G.push({ desde: alPulso(261.2), hasta: 280, escena: 'cierre', corte: true });
  // sin huecos: cada tramo termina donde empieza el siguiente
  for (let i = 0; i < G.length - 1; i++) G[i].hasta = G[i + 1].desde;
  return G;
}
// todos contra todos, en un orden que varía
const PARES = [];
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (i !== j) PARES.push([NOMBRES[i], NOMBRES[j]]);
const parDe = (k) => PARES[(k * 17) % PARES.length];

async function cuadroEn(T, G, estado) {
  const e = G.find((x) => T >= x.desde && T < x.hasta) || G[G.length - 1];
  const tl = T - e.desde;
  if (estado.tramo !== e) {
    estado.tramo = e; estado.cuadros = 0;
    if (e.escena === 'jugada') {
      let ok = null, k = 0;
      while (!ok && k < 6) { const [a, b] = parDe(e.par + k * 7); ok = empezarJugada(a, b, e.semilla + k * 31, { gol: e.gol, largo: e.hasta - e.desde }); k++; }
      if (!ok) e.escena = 'carrera';
    }
  }
  if (e.escena === 'intro') intro(tl);
  else if (e.escena === 'titulo') titulo(T);
  else if (e.escena === 'siluetas') siluetas(T, e.i);
  else if (e.escena === 'carrera') carrera(T, e.semilla);
  else if (e.escena === 'fila') fila(tl);
  else if (e.escena === 'placa') placa(e.nombre, tl);
  else if (e.escena === 'tabla') await tabla(T, { titulo: e.titulo, pregunta: e.preguntaDesde ? T >= e.preguntaDesde : e.pregunta !== false });
  else if (e.escena === 'jugada') {
    cuadroJugada();
    if (e.cartel && tl < 1.6) { g.fillStyle = 'rgba(6,4,16,.75)'; g.fillRect(0, H / 2 - 14, W, 26); texto(g, e.cartel, W / 2, H / 2 - 6, { esc: 2, alinear: 'centro', color: '#fff4b0', sombra: '#000' }); }
  }
  else if (e.escena === 'outro') outro(tl);
  else if (e.escena === 'cierre') { await tabla(T, { titulo: 'la tabla sigue', pregunta: false, cierre: true }); fundido((T - 277) / 3); }
  subtitulo(T);
  const k = estado.cuadros++;
  if (e.corte && k < 2) glitch(1 - k);
}

// Filma la canción entera (o un tramo): manda cada cuadro chico al servidor local como op_00000.png
async function filmar({ desde = 0, hasta = 280, fps = 30, prefijo = 'op' } = {}) {
  analisis = analisis || await fetch('./ruta404.analisis.json').then((r) => r.json());
  const G = armarGuion(), estado = {};
  const t0 = performance.now();
  for (let f = Math.round(desde * fps); f < Math.round(hasta * fps); f++) {
    await cuadroEn(f / fps, G, estado);
    const r = await fetch(`/captura?n=${prefijo}_${String(f).padStart(5, '0')}`, { method: 'POST', body: lienzo.toDataURL('image/png') });
    if (!r.ok) throw new Error('no se pudo guardar el cuadro ' + f);
    window.avance = { cuadro: f, segundos: Math.round((performance.now() - t0) / 1000) };
  }
  window.avance = { listo: true, tramos: G.length, segundos: Math.round((performance.now() - t0) / 1000) };
  return window.avance;
}
// Un cuadro suelto del video (para revisar): simula lo que haga falta de su tramo
async function probar(T) {
  analisis = analisis || await fetch('./ruta404.analisis.json').then((r) => r.json());
  const G = armarGuion(), estado = {};
  const e = G.find((x) => T >= x.desde && T < x.hasta);
  for (let t = e.desde; t < T - 1e-6; t += 1 / 30) await cuadroEn(t, G, estado);
  await cuadroEn(T, G, estado);
  return { escena: e.escena, desde: e.desde, hasta: e.hasta };
}

// ---------- salida ----------
function grande() {
  const o = document.createElement('canvas'); o.width = W * ESC; o.height = H * ESC;
  const c = o.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(lienzo, 0, 0, o.width, o.height);
  return o;
}
async function guardar(nombre) {
  const r = await fetch(`/captura?n=${encodeURIComponent(nombre)}`, { method: 'POST', body: grande().toDataURL('image/png') });
  return r.ok;
}
async function cuadro(tipo, ...args) {
  if (tipo === 'titulo') return titulo(...args);
  if (tipo === 'placa') return placa(...args);
  if (tipo === 'tabla') return tabla(...args);
}
window.opening = { cuadro, guardar, filmar, probar, guion: () => armarGuion(), CORREDORES };

// Cortos de la Ruta 404: compone cuadros verticales para los Shorts de los corredores.
// Lienzo de pixel art de 270x480 que se exporta ampliado 4 veces (1080x1920), con tres capas:
//   cine  · la Ruta 404 de noche y el corredor dibujado grande (mismo diseño que en el juego)
//   juego · una jugada real: sim.js + las IAs de bot.js + el render del juego, cámara del corredor
//   ficha · el corredor con sus datos reales del día (datos.json, sacado de /liga)
// Se abre con ?medida=270x480&limpio (así el render del juego dibuja en vertical y sin marcador).
// Desde la consola o un script: await corto.cuadro('cine', t) dibuja; corto.guardar('nombre') manda
// el PNG grande al servidor local (/captura), que lo deja en server/datos/.
import { nuevoEstado, paso } from '../src/sim.js';
import { crearBot } from '../src/bot.js';
import { crearPintor } from '../src/render-pixel.js';
import { disenoDe, dibujarAuto } from '../src/autos.js';
import { texto } from '../src/fuente.js';

const W = 270, H = 480, ESC = 4;
const lienzo = document.getElementById('lienzo');
const g = lienzo.getContext('2d');
g.imageSmoothingEnabled = false;

// Los corredores (copia de IAS en server/ranking.js, que no se carga en el navegador).
export const CORREDORES = {
  'Chatarra': { nivel: 1, estilo: 'perseguidor', lema: 'arma con lo que hay' },
  'Ternero Diesel': { nivel: 2, estilo: 'choque', lema: 'va de frente a todo' },
  'Luz de Chacra': { nivel: 3, estilo: 'arquero', lema: 'no pasa nada' },
  'Pombero 2.0': { nivel: 4, estilo: 'pared', lema: 'aparece por la banda' },
  'Lobizon V8': { nivel: 5, estilo: 'nitro', lema: 'vive del aceite negro' },
  'Gaucho de Ferrita': { nivel: 6, estilo: 'gambeta', lema: 'la lleva pegada' },
  'Tanque Nandu': { nivel: 7, estilo: 'contra', lema: 'espera y sale' },
  'Silencio con Dientes': { nivel: 8, estilo: 'completo', lema: 'el que nadie oye venir' },
};
const AZUL = { cuerpo: '#3074f0', lado: '#1e44a4', techo: '#64a8ff', oscuro: '#182048' };
const ROJO = { cuerpo: '#e43a3a', lado: '#9c1c24', techo: '#ff7a68', oscuro: '#4a1018' };
const retraso = (nivel) => Math.round((12 + Math.round((8 - nivel) * 4 / 7)) * 1000 / 60);

// azar repetible (para que un cuadro salga igual cada vez)
function rng(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

// ---------- cine: la Ruta 404 de noche ----------
const RUTA = { x0: 75, x1: 195 };
function ruta(t, avance) {
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const yy = y - Math.floor(avance);           // el mundo baja mientras el auto avanza
    let c;
    if (x >= RUTA.x0 && x < RUTA.x1) {
      const n = hash(x, yy) * 10;
      c = [30 + n, 28 + n, 40 + n];               // asfalto
      if (x === RUTA.x0 + 3 || x === RUTA.x1 - 4) c = [96, 94, 108];                        // línea del borde
      if (Math.abs(x - 135) < 1.5 && ((yy % 28) + 28) % 28 < 15) c = [196, 160, 64];        // línea del medio
      if (hash(Math.floor(x / 9), Math.floor(yy / 9), 3) < 0.05) c = [c[0] - 10, c[1] - 10, c[2] - 8]; // parches
    } else {
      const borde = x < RUTA.x0 ? RUTA.x0 - x : x - RUTA.x1 + 1;
      if (borde < 6) { const n = hash(x, yy, 1) * 14; c = [44 + n, 38 + n, 34 + n]; }   // banquina de tierra
      else {
        const n = hash(x, yy, 2), m = hash(Math.floor(x / 5), Math.floor(yy / 5), 4);
        c = n < 0.18 ? [26, 44, 34] : m < 0.5 ? [16, 28, 24] : [20, 34, 28];                // pasto
      }
    }
    const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // píxeles muertos del protocolo Ruta 404: cuadrados negros, algunos con el color corrido
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(hash(k, 1, 9) * W), y = Math.floor(((hash(k, 2, 9) * H * 1.6 + avance) % (H * 1.6)) - H * 0.3);
    const s = 2 + Math.floor(hash(k, 3, 9) * 4);
    if (hash(k, Math.floor(t * 6), 5) < 0.15) continue;   // titila
    if (hash(k, 4, 9) < 0.3) { g.fillStyle = 'rgba(255,40,90,.8)'; g.fillRect(x - 1, y, s, s); g.fillStyle = 'rgba(40,220,255,.8)'; g.fillRect(x + 1, y, s, s); }
    g.fillStyle = '#000'; g.fillRect(x, y, s, s);
  }
}
// noche: todo oscuro salvo las luces
function noche(luces, fuerza = 0.78) {
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const c = o.getContext('2d');
  c.fillStyle = `rgba(6,4,16,${fuerza})`; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  for (const l of luces) {
    const gr = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    if (l.cono) { c.save(); c.beginPath(); c.moveTo(l.x, l.y + 8); c.lineTo(l.x - l.cono, l.y - l.r); c.lineTo(l.x + l.cono, l.y - l.r); c.closePath(); c.clip(); c.fillRect(0, 0, W, H); c.restore(); }
    else c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  g.drawImage(o, 0, 0);
}
function luzMala(x, y, t) {
  const r = 3 + Math.sin(t * 5) * 0.8;
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 5);
  gr.addColorStop(0, 'rgba(160,255,190,.55)'); gr.addColorStop(1, 'rgba(160,255,190,0)');
  g.fillStyle = gr; g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  g.fillStyle = '#dfffe8'; g.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
}
function cine(nombre, t, { cartel = true, gancho = null, oscuro = 0 } = {}) {
  const d = disenoDe(nombre);
  const avance = t * 70;                                   // 70 px por segundo
  const yAuto = 330 - Math.min(1, t / 2) * 40;              // entra un poco y se queda
  ruta(t, avance);
  const auto = dibujarAuto(d, AZUL, -Math.PI / 2, 3);
  const lm = { x: 42 + Math.sin(t * 0.7) * 6, y: 150 + Math.cos(t * 0.9) * 8 };
  // mojón del kilómetro 404 en la banquina, que pasa con la ruta
  const ym = ((150 + avance) % 900) - 120;
  g.fillStyle = '#2a2630'; g.fillRect(RUTA.x1 + 8, ym + 12, 3, 12);
  g.fillStyle = '#d8d4c8'; g.fillRect(RUTA.x1 + 1, ym, 21, 13);
  g.fillStyle = '#14101c'; g.fillRect(RUTA.x1 + 1, ym + 12, 21, 1);
  texto(g, '404', RUTA.x1 + 3, ym + 3, { color: '#1a1622', sombra: null });
  // la luz que tira el auto hacia adelante, y la de la Luz Mala
  noche([
    { x: 135, y: yAuto - 30, r: 150, a: 0.85, cono: 70 },
    { x: 135, y: yAuto, r: 46, a: 0.6 },
    { x: lm.x, y: lm.y, r: 38, a: 0.7 },
    { x: RUTA.x1 + 11, y: ym + 6, r: 22, a: 0.45 },   // el mojón refleja un poco
  ]);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(137, yAuto + 6, 22, 38, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(auto, Math.round(135 - auto.width / 2), Math.round(yAuto - auto.height / 2));
  luzMala(lm.x, lm.y, t);
  if (oscuro) { g.fillStyle = `rgba(4,2,10,${oscuro})`; g.fillRect(0, 0, W, H); }
  if (gancho) gancho.forEach((l, i) => texto(g, l, W / 2, 96 + i * 26, { esc: 2, alinear: 'centro', color: i ? '#ff8a8a' : '#fff', sombra: '#000' }));
  if (!cartel) return;
  // carteles
  const c = CORREDORES[nombre];
  g.fillStyle = 'rgba(6,4,16,.82)'; g.fillRect(0, 404, W, 76);
  texto(g, nombre, W / 2, 414, { esc: 2, alinear: 'centro', color: '#fff4b0', sombra: '#7a2a10' });
  texto(g, c.lema, W / 2, 438, { alinear: 'centro', color: '#c8c2ea', sombra: null });
  texto(g, 'corredor de la ruta 404', W / 2, 456, { alinear: 'centro', color: '#6f68a0', sombra: null });
}

// ---------- juego: una jugada real ----------
let pintor = null;
function jugada(nombre, rival, { semilla = 1, golDe = 0, antes = 40 } = {}) {
  const canvas = document.getElementById('juego');
  if (!pintor) pintor = crearPintor(canvas, { cancha: 'ruta404' });
  const a = CORREDORES[nombre], b = CORREDORES[rival];
  const azar = Math.random; Math.random = rng(semilla);   // el camión del estado inicial, repetible
  const s = nuevoEstado();
  Math.random = azar;
  const bots = [crearBot(0, a.nivel, a.estilo, { semilla }), crearBot(1, b.nivel, b.estilo, { semilla: semilla + 1 })];
  const extra = { pantalla: 'bot', seguir: 0, red: { nombres: [nombre, rival], listo: true, jugadores: 2, lado: -1 } };
  // se juega cuadro a cuadro guardando los últimos `antes` cuadros; al gol pedido, se queda con el de hace `antes`
  const anillo = [];
  for (let n = 0; n < 60 * 60 * 6 && s.fase !== 'fin'; n++) {
    paso(s, [bots[0](s), bots[1](s)]);
    pintor.dibujar(s, extra);
    const copia = document.createElement('canvas'); copia.width = W; copia.height = H;
    const cc = copia.getContext('2d'); cc.imageSmoothingEnabled = false; cc.drawImage(canvas, 0, 0, W, H);
    anillo.push(copia); if (anillo.length > antes) anillo.shift();
    if (s.eventos.some((e) => e.t === 'gol' && e.quien === golDe)) return { cuadro: anillo[0], n: n - antes, goles: s.autos.map((x) => x.goles) };
  }
  return null;
}
function juego(nombre, rival, op) {
  const r = jugada(nombre, rival, op);
  if (!r) { g.fillStyle = '#300'; g.fillRect(0, 0, W, H); texto(g, 'sin gol', 135, 240, { alinear: 'centro' }); return null; }
  g.drawImage(r.cuadro, 0, 0);
  g.fillStyle = 'rgba(6,4,16,.75)'; g.fillRect(0, 0, W, 30);
  texto(g, `${nombre} vs ${rival}`, W / 2, 6, { alinear: 'centro', color: '#e8e4ff', sombra: null });
  texto(g, 'partido real entre ias', W / 2, 17, { alinear: 'centro', color: '#7cf09a', sombra: null });
  return r;
}

// ---------- ficha: los datos del día ----------
let datosCache = null;
async function ficha(nombre, t, revela = 99) {
  const datos = datosCache || (datosCache = await fetch('./datos.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})));
  const yo = (datos.ias || []).find((x) => x.nombre === nombre) || {};
  const c = CORREDORES[nombre];
  g.fillStyle = '#141024'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) { if (hash(k, Math.floor(t * 4), 7) < 0.2) continue; g.fillStyle = k % 5 ? '#0a0814' : '#000'; g.fillRect(Math.floor(hash(k, 1, 8) * W), Math.floor(hash(k, 2, 8) * H), 3, 3); }
  const auto = dibujarAuto(disenoDe(nombre), AZUL, -Math.PI / 2 + Math.sin(t) * 0.15, 4);
  g.drawImage(auto, Math.round(135 - auto.width / 2), 18);
  let y = 178;
  texto(g, nombre, W / 2, y, { esc: 2, alinear: 'centro', color: '#fff4b0', sombra: '#7a2a10' }); y += 26;
  texto(g, c.lema, W / 2, y, { alinear: 'centro', color: '#c8c2ea', sombra: null }); y += 22;
  let nf = 0;
  const fila = (k, v, col = '#fff') => { if (revela < 0.4 + nf++ * 0.22) { y += 14; return; } texto(g, k, 30, y, { color: '#8f88c0', sombra: null }); texto(g, v, W - 30, y, { alinear: 'der', color: col, sombra: null }); y += 14; };
  fila('estilo', c.estilo);
  fila('reacción', `${retraso(c.nivel)} ms`);
  fila('mismas teclas que vos', 'sí', '#7cf09a');
  y += 8;
  fila('elo hoy', String(yo.elo ?? '—'), '#fff4b0');
  fila('puesto', yo.puesto ? `${yo.puesto} de ${datos.ias.length + (datos.humanos || 0)}` : '—');
  fila('liga entre ias', yo.liga ? `${yo.liga.victorias} g · ${yo.liga.partidas - yo.liga.victorias} p` : '—');
  fila('contra humanos', yo.humanos ? `${yo.humanos.partidas} partidos` : '—', yo.humanos && yo.humanos.partidas === 0 ? '#ff8a8a' : '#fff');
  if (revela < 2.6) return;
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(16, 402, W - 32, 1);
  texto(g, 'la tabla es real', W / 2, 414, { esc: 2, alinear: 'centro', color: '#fff', sombra: '#3a2a70' });
  texto(g, 'kvothesson.com/potrero-404', W / 2, 440, { alinear: 'centro', color: '#ffb030', sombra: null });
  if (datos.fecha) texto(g, `datos del ${datos.fecha}`, W / 2, 458, { alinear: 'centro', color: '#4f4880', sombra: null });
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
  if (tipo === 'cine') return cine(...args);
  if (tipo === 'juego') return juego(...args);
  if (tipo === 'ficha') return ficha(...args);
}

// ---------- filmar el Short entero, cuadro a cuadro ----------
// partes: [{parte:'gancho'|'cine'|'juego'|'ficha', desde, hasta}], en segundos del video.
// Manda cada cuadro chico (270x480) al servidor local como <prefijo>_00001.png; se amplía con ffmpeg.
const FPS_VIDEO = 30;
function glitch(k) {
  // corte: el cuadro se corre en rojo y cian y le caen bloques de píxeles muertos
  const img = g.getImageData(0, 0, W, H), d = img.data, o = new Uint8ClampedArray(d);
  const dx = 3 + k * 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, ir = (y * W + Math.min(W - 1, x + dx)) * 4, ib = (y * W + Math.max(0, x - dx)) * 4;
    d[i] = o[ir]; d[i + 2] = o[ib + 2];
  }
  g.putImageData(img, 0, 0);
  for (let n = 0; n < 14; n++) { g.fillStyle = n % 3 ? '#000' : 'rgba(40,220,255,.7)'; g.fillRect(Math.floor(hash(n, k, 11) * W), Math.floor(hash(n, k, 12) * H), 6 + Math.floor(hash(n, k, 13) * 30), 3 + Math.floor(hash(n, k, 14) * 8)); }
}
async function filmar({ corredor, rival, semilla, partes, prefijo, juegoAntes = 11, juegoDespues = 1.5, gancho }) {
  const total = Math.round(partes[partes.length - 1].hasta * FPS_VIDEO);
  // la jugada: se simula entera hasta el gol del corredor y se dibujan solo los cuadros de la ventana
  const pj = partes.find((p) => p.parte === 'juego');
  const canvas = document.getElementById('juego');
  if (!pintor) pintor = crearPintor(canvas, { cancha: 'ruta404' });
  const a = CORREDORES[corredor], b = CORREDORES[rival];
  const simular = () => {
    const azar = Math.random; Math.random = rng(semilla); const s = nuevoEstado(); Math.random = azar;
    return { s, bots: [crearBot(0, a.nivel, a.estilo, { semilla }), crearBot(1, b.nivel, b.estilo, { semilla: semilla + 1 })] };
  };
  // 1) cuándo hace el gol
  let { s, bots } = simular(), golEn = -1;
  for (let n = 0; n < 60 * 60 * 6 && s.fase !== 'fin'; n++) { paso(s, [bots[0](s), bots[1](s)]); if (s.eventos.some((e) => e.t === 'gol' && e.quien === 0)) { golEn = n; break; } }
  if (golEn < 0) throw new Error('el corredor no hizo gol con esa semilla');
  const desde = golEn - Math.round(juegoAntes * 60), largo = Math.round((pj.hasta - pj.desde) * 60);
  // 2) de nuevo, igual, dibujando desde un poco antes de la ventana (para que el render tenga sus marcas)
  ({ s, bots } = simular());
  const extra = { pantalla: 'bot', seguir: 0, red: { nombres: [corredor, rival], listo: true, jugadores: 2, lado: -1 } };
  const jugadas = [];
  for (let n = 0; n < desde + largo; n++) {
    paso(s, [bots[0](s), bots[1](s)]);
    if (n >= desde - 120) pintor.dibujar(s, extra);
    if (n >= desde && (n - desde) % 2 === 0) { const c = document.createElement('canvas'); c.width = W; c.height = H; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false; cc.drawImage(canvas, 0, 0, W, H); jugadas.push(c); }
  }
  // 3) cuadro por cuadro
  for (let f = 0; f < total; f++) {
    const t = f / FPS_VIDEO;
    const p = partes.find((x) => t >= x.desde && t < x.hasta) || partes[partes.length - 1];
    const tl = t - p.desde;
    if (p.parte === 'gancho') cine(corredor, t, { cartel: false, gancho, oscuro: 0.35 });
    else if (p.parte === 'cine') cine(corredor, t, { cartel: tl > 3.2 });
    else if (p.parte === 'juego') {
      g.drawImage(jugadas[Math.min(jugadas.length - 1, Math.floor(tl * FPS_VIDEO))], 0, 0);
      g.fillStyle = 'rgba(6,4,16,.75)'; g.fillRect(0, 0, W, 30);
      texto(g, `${corredor} vs ${rival}`, W / 2, 6, { alinear: 'centro', color: '#e8e4ff', sombra: null });
      texto(g, 'partido real entre ias', W / 2, 17, { alinear: 'centro', color: '#7cf09a', sombra: null });
    } else await ficha(corredor, tl, tl);
    // corte con glitch en los primeros cuadros de cada parte (menos entre gancho y cine, que es la misma toma)
    const k = Math.floor(tl * FPS_VIDEO);
    if (p.parte !== 'gancho' && p.parte !== 'cine' && k < 3) glitch(2 - k);
    if (p.parte === 'cine' && k < 2) glitch(1 - k);
    const r = await fetch(`/captura?n=${prefijo}_${String(f).padStart(5, '0')}`, { method: 'POST', body: lienzo.toDataURL('image/png') });
    if (!r.ok) throw new Error('no se pudo guardar el cuadro ' + f);
  }
  return { cuadros: total, golEn, desde };
}
// ---------- molde "una mecánica, un número" (aprendido de Corner Cutters, 27/11) ----------
// Arranca en plena jugada, un texto grande por idea, el número real medido en la simulación, sin lore.
// La velocidad se pasa a km/h con la escala de Rocket League que usa sim.js (1 uu = 1 cm, UU px por uu).
const UU = 9.4 / 2300, KMH = (v) => Math.round(v / UU * 0.036);
let demoCache = null;
const ZOOM_Y = 210;   // recorte de y=210 a 450: el auto seguido anda entre y=300 y 360 del lienzo
function prepararDemo({ a, b, semilla, atac, antes = 2.5 }) {
  const canvas = document.getElementById('juego');
  if (!pintor) pintor = crearPintor(canvas, { cancha: 'ruta404' });
  const ca = CORREDORES[a], cb = CORREDORES[b];
  const nuevo = () => {
    const azar = Math.random; Math.random = rng(semilla); const s = nuevoEstado(); Math.random = azar;
    return { s, bots: [crearBot(0, ca.nivel, ca.estilo, { semilla }), crearBot(1, cb.nivel, cb.estilo, { semilla: semilla + 1 })] };
  };
  const extra = { pantalla: 'bot', seguir: atac, red: { nombres: [a, b], listo: true, jugadores: 2, lado: -1 } };
  // 1) simular entero y anotar cuándo pasa todo, con la velocidad de antes de cada paso
  const vel = [];
  let { s, bots } = nuevo(), demoN = -1, golN = -1, kmhDemo = 0;
  for (let n = 0; n < 60 * 60 * 6 && s.fase !== 'fin' && golN < 0; n++) {
    const v = Math.hypot(s.autos[atac].vx, s.autos[atac].vy); vel.push(v);
    paso(s, [bots[0](s), bots[1](s)]);
    for (const e of s.eventos) {
      if (e.t === 'aplastado' && e.demolicion && e.quien !== atac && demoN < 0) { demoN = n; kmhDemo = KMH(v); }
      if (e.t === 'gol' && e.quien === atac && demoN >= 0) golN = n;
    }
  }
  if (demoN < 0 || golN < 0) throw new Error('esa semilla no tiene demolición y gol');
  // 2) de nuevo, dibujando cada 2 pasos (30 cuadros por segundo) desde `antes` segundos antes del choque
  const desde = demoN - Math.round(antes * 60), hasta = golN + 150;
  ({ s, bots } = nuevo());
  const cuadros = [];
  for (let n = 0; n <= hasta && s.fase !== 'fin'; n++) {
    const v = Math.hypot(s.autos[atac].vx, s.autos[atac].vy);
    paso(s, [bots[0](s), bots[1](s)]);
    if (n >= desde - 120) pintor.dibujar(s, extra);
    if (n >= desde && (n - desde) % 2 === 0) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false; cc.drawImage(canvas, 0, 0, W, H);
      cuadros.push({ c, n, kmh: KMH(v) });
    }
  }
  demoCache = { a, b, atac, semilla, desde, demoN, golN, kmhDemo, cuadros };
  return { demoN, golN, kmhDemo, tras: (golN - demoN) / 60, cuadros: cuadros.length };
}
// Guion del video, en segundos: jugada hasta el choque, congelado, carrera al arco vacío, gol, repetición lenta, cierre.
function guionDemo() {
  const d = demoCache, iDemo = Math.round((d.demoN - d.desde) / 2), iGol = Math.round((d.golN - d.desde) / 2);
  const P = [];
  let t = 0;
  const parte = (tipo, dura, extra = {}) => { P.push({ tipo, desde: t, hasta: t + dura, ...extra }); t += dura; };
  parte('llega', iDemo / 30);
  parte('congela', 0.6);
  parte('arco', (iGol - iDemo) / 30);
  parte('gol', 1.0);
  parte('lento', 2.4, { i0: iDemo - 18, i1: iDemo + 6 });   // 0,8 s de juego a un tercio
  parte('cierre', 1.6);
  return { P, total: t, iDemo, iGol };
}
const blanco = (txt, y, esc, color = '#fff', sombra = '#000') => texto(g, txt, W / 2, y, { esc, alinear: 'centro', color, sombra });
function franja(y, h, a = 0.62) { g.fillStyle = `rgba(4,2,12,${a})`; g.fillRect(0, y, W, h); }
function velocimetro(kmh, y = 40, rojo = false) {
  franja(y - 8, 44);
  blanco(`${kmh} km/h`, y, 4, rojo ? '#ff6a5a' : '#fff4b0', rojo ? '#5a0a10' : '#6a3a08');
}
function cuadroDemo(t) {
  const d = demoCache, { P, iDemo, iGol } = guionDemo();
  const p = P.find((x) => t >= x.desde && t < x.hasta) || P[P.length - 1];
  const tl = t - p.desde, f = Math.floor(tl * 30);
  const cl = (i) => Math.max(0, Math.min(d.cuadros.length - 1, i));
  // cámara al doble (escala entera): recorte de 135x240 alrededor del auto que sigue la cámara
  const ver = (i) => { g.imageSmoothingEnabled = false; g.drawImage(d.cuadros[cl(i)].c, W / 4, ZOOM_Y, W / 2, H / 2, 0, 0, W, H); };
  const quien = [d.a, d.b][d.atac], otro = [d.a, d.b][1 - d.atac];
  const vivo = (i) => d.cuadros[cl(i)].kmh;
  if (p.tipo === 'llega') {
    ver(f); velocimetro(vivo(f));
    franja(404, 34); blanco(`${quien} va a pegar de frente`, 414, 1, '#c8c2ea', null);
  } else if (p.tipo === 'congela') {
    ver(iDemo + 2);
    if (f < 3) { g.fillStyle = `rgba(255,255,255,${0.75 - f * 0.25})`; g.fillRect(0, 0, W, H); }
    velocimetro(d.kmhDemo, 40, true);
    franja(200, 40); blanco('demolición', 206, 3, '#fff', '#7a1010');
  } else if (p.tipo === 'arco') {
    ver(iDemo + f);
    const queda = Math.max(0, 3 - f / 30);
    franja(26, 36); blanco('el arco queda solo', 36, 2, '#fff', '#000');
    franja(404, 34); blanco(`${otro} vuelve en ${queda.toFixed(1).replace('.', ',')} s`, 414, 1, '#c8c2ea', null);
  } else if (p.tipo === 'gol') {
    ver(iGol + f);
    // debajo del cartel del marcador que muestra el propio juego
    franja(136, 50); blanco('gol', 142, 3, '#7cf09a', '#0a3a1a');
    blanco(`${((d.golN - d.demoN) / 60).toFixed(1).replace('.', ',')} s después del choque`, 170, 1, '#e8e4ff', null);
  } else if (p.tipo === 'lento') {
    const i = p.i0 + Math.floor((tl / (p.hasta - p.desde)) * (p.i1 - p.i0));
    ver(i);
    velocimetro(vivo(i), 40, i >= iDemo);
    franja(404, 34); blanco('otra vez, a un tercio de velocidad', 414, 1, '#c8c2ea', null);
  } else {
    ver(iGol + 12);   // quieto en el festejo, antes de que el juego muestre la cuenta del saque
    g.fillStyle = 'rgba(4,2,12,.72)'; g.fillRect(0, 0, W, H);
    blanco('potrero 404', 176, 3, '#fff4b0', '#7a2a10');
    blanco('picado en la ruta 404', 210, 2, '#fff', '#000');
    blanco('gratis en el navegador', 232, 1, '#c8c2ea', null);
    blanco('kvothesson.com/potrero-404', 290, 1, '#ffb030', null);
    blanco('partido real entre ias del juego', 456, 1, '#4f4880', null);
  }
}
async function filmarDemo(prefijo) {
  const { total } = guionDemo(), n = Math.round(total * 30);
  for (let f = 0; f < n; f++) {
    cuadroDemo(f / 30);
    const r = await fetch(`/captura?n=${prefijo}_${String(f).padStart(5, '0')}`, { method: 'POST', body: lienzo.toDataURL('image/png') });
    if (!r.ok) throw new Error('no se pudo guardar el cuadro ' + f);
  }
  return { cuadros: n, segundos: total };
}

window.corto = { cuadro, guardar, filmar, CORREDORES, prepararDemo, guionDemo, cuadroDemo, filmarDemo };

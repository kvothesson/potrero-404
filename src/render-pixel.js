// Pintor en pixel art con aspecto de Super Nintendo: todo se dibuja en un buffer chico
// (272x400 parado, más ancho acostado) con paleta limitada, contornos de 1 píxel y vista de tres cuartos, y después
// se agranda a escala entera sin suavizado. Solo lee el estado; nunca lo cambia.
import { t } from './idioma.js';
import { W, H, CAMPO, AUTOS, GOLES_PARA_GANAR, FPS, paredes, TIEMPO_PARTIDO } from './sim.js';
import { texto, icono, tecla } from './fuente.js';
import { CANCHAS, hash } from './canchas.js';
import { spritesAuto, disenoDe, ANGULOS, TAM } from './autos.js';
import { dibujarCinematica, placaCorredor, CORREDORES } from './cinematica.js';
// ?autos=Nombre1,Nombre2 fuerza los autos (para probar y filmar sin jugar online)
const AUTOS_FORZADOS = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('autos') || '').split(',').map((x) => x.trim()).filter(Boolean) : [];
// Sin palabras en pantalla: todo se dice con colores, números, íconos y teclas dibujadas,
// para que se entienda en cualquier idioma.

// BW×BH es lo que se ve en pantalla y depende de la ventana: parado 272×400; acostado (compu o
// celu de costado) unos 256 de alto, ajustado para llenar la pantalla, y el ancho que pida (360 a 500).
// El mundo (WW×WH) es más grande: la cancha más el escenario de los costados, y la cámara sigue a tu auto.
let BW = 272, BH = 400;
const K = 0.5;
const LIMPIO = new URLSearchParams(location.search).has('limpio');
function medidas() {
  // opción oculta para capturas (tarjeta del link, tráiler): ?medida=600x315
  const fija = /^(\d{3})x(\d{3})$/.exec(new URLSearchParams(location.search).get('medida') || '');
  if (fija) return [Number(fija[1]), Number(fija[2])];
  const a = window.innerWidth / Math.max(1, window.innerHeight);
  const dpr = window.devicePixelRatio || 1, alto = window.innerHeight * dpr, ancho = window.innerWidth * dpr;
  // parado: un ancho cercano a 272 que llene justo la pantalla con escala entera, y el alto que pida (400 a 480)
  if (a <= 1.15) {
    const k = Math.max(1, Math.round(ancho / 272));
    const bw = Math.max(240, Math.min(300, Math.floor(ancho / k)));
    return [bw, Math.max(400, Math.min(480, Math.floor(alto / k)))];
  }
  // acostado: un alto cercano a 256 que entre justo en la pantalla con escala entera, así ocupa todo el alto
  const k = Math.max(1, Math.round(alto / 256));
  const bh = Math.max(224, Math.min(300, Math.floor(alto / k)));
  const bw = Math.max(360, Math.min(500, Math.floor(ancho / k)));
  return [bw, bh];
}
// La cámara gira (como el Mode 7 de la Super Nintendo): el mundo se dibuja en un cuadrado VW×VW
// centrado en tu auto y después se pega girado en la pantalla, con tu auto siempre mirando arriba.
let VW = 780;
const anclaY = () => Math.round(BH * (BW > BH ? 0.66 : 0.64));
// margen de escenario alrededor de la cancha: lo bastante grande para que, con la cámara que gira,
// nunca se vea dónde termina el mundo aunque vayas pegado a una esquina
const OX = 350, OY = 310;
const WW = Math.round(W * K) + OX * 2, WH = Math.round(H * K) + OY * 2;
const bx = (x) => OX + x * K, by = (y) => OY + y * K;

const P = {
  contorno: '#140f22', noche: '#1c1830',
  pasto1: [64, 148, 64], pasto2: [52, 126, 54], pasto3: [40, 100, 46],
  linea: [240, 240, 228],
  paredTope: [222, 222, 232], paredCara: [150, 150, 176], paredCaraOsc: [104, 104, 136], paredSombra: [30, 70, 36],
  grada1: [86, 84, 118], grada2: [70, 68, 100], grada3: [58, 56, 86], cemento: [96, 96, 104],
  red: [36, 40, 54], redHilo: [200, 204, 214],
  publico: ['#b84050', '#c8a040', '#4060b0', '#c8c4d8', '#4c8c50', '#b86c38', '#7c4c9c', '#3c8c94'],
  piel: ['#f0c8a0', '#c89070', '#8a5a3c'],
  nitro: ['#e07818', '#ffb030', '#fff4b0'],
  pelota: ['#f8f8f8', '#b8b8cc', '#202028', '#7c7c94'],
};
const COLOR_AUTO = [
  { cuerpo: '#3074f0', lado: '#1e44a4', techo: '#64a8ff', oscuro: '#182048' },
  { cuerpo: '#e43a3a', lado: '#9c1c24', techo: '#ff7a68', oscuro: '#4a1018' },
];
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// ---------- sprites de autos: en autos.js (uno por corredor; los humanos, el común) ----------
function hexA(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

// ---------- pelota: 8 cuadros ----------
// Luz Mala: una esfera de luz que titila (Ruta 404). Si no, la pelota de fútbol que rueda.
function spritesLuzMala() {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const cv = document.createElement('canvas'); cv.width = 13; cv.height = 13;
    const g = cv.getContext('2d'), img = g.createImageData(13, 13), d = img.data;
    const pon = (x, y, col, a = 255) => { const i = (y * 13 + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a; };
    const pulso = 0.5 + 0.5 * Math.sin(k / 8 * Math.PI * 2);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
      const r = Math.hypot(x - 6, y - 6) + (hash(x, y, k) - 0.5) * 0.9;
      if (r < 1.8) pon(x, y, [255, 255, 255]);
      else if (r < 3.2) pon(x, y, [214, 255, 226]);
      else if (r < 4.6 + pulso * 0.6) pon(x, y, [130, 236, 176]);
      else if (r < 6.2 && hash(x, y, k + 3) < 0.45) pon(x, y, [70, 180, 130], 200);
    }
    g.putImageData(img, 0, 0);
    out.push(cv);
  }
  return out;
}
function spritesPelota() {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const cv = document.createElement('canvas'); cv.width = 13; cv.height = 13;
    const g = cv.getContext('2d'), img = g.createImageData(13, 13), d = img.data;
    const pon = (x, y, col) => { const i = (y * 13 + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
    const fase = k / 8 * Math.PI * 2;
    const manchas = [[0, 0], [Math.cos(fase) * 3.5, Math.sin(fase) * 2], [Math.cos(fase + 2.1) * 3.5, Math.sin(fase + 2.1) * 2], [Math.cos(fase + 4.2) * 3.5, Math.sin(fase + 4.2) * 2]];
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
      const dx = x - 6, dy = y - 6, r = Math.hypot(dx, dy);
      if (r > 6.2) continue;
      if (r > 5.3) { pon(x, y, hexA(P.contorno)); continue; }
      let col = hexA('#f8f8f8');
      if (dx + dy > 3.5) col = hexA('#b8b8cc');
      for (const [mx, my] of manchas) if (Math.hypot(dx - mx, dy - my) < 1.6) col = hexA('#262630');
      if (dx < -1 && dy < -1 && dx + dy < -4.5 && dx + dy > -6) col = hexA('#ffffff');
      pon(x, y, col);
    }
    g.putImageData(img, 0, 0);
    out.push(cv);
  }
  return out;
}

// ---------- cancha fija: el piso, las líneas, las paredes en tres cuartos y lo de afuera ----------
// Se decide la categoría de cada píxel y la cancha elige su color (ver canchas.js).
function fondoFijo(cancha) {
  const cv = document.createElement('canvas'); cv.width = WW; cv.height = WH;
  const g = cv.getContext('2d'), img = g.createImageData(WW, WH), d = img.data;
  const poly = paredes().puntos.map(([x, y]) => [bx(x), by(y)]);
  const adentro = (x, y) => {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };
  const M = new Uint8Array(WW * WH);
  // solo se prueba dentro del rectángulo de la cancha (el mundo ahora es mucho más grande)
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1, y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) M[y * WW + x] = adentro(x + 0.5, y + 0.5) ? 1 : 0;
  const m = (x, y) => (x < 0 || y < 0 || x >= WW || y >= WH ? 0 : M[y * WW + x]);
  const pon = (x, y, c) => { const i = (y * WW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };

  const T = by(CAMPO.T), B = by(CAMPO.B), cx = bx(W / 2), cy = by(H / 2);
  const g0 = bx(W / 2 - CAMPO.arcoAncho / 2), g1 = bx(W / 2 + CAMPO.arcoAncho / 2);
  const caja = { x0: bx(W / 2 - 110), x1: bx(W / 2 + 110), h: 78 * K };
  // líneas de 1 píxel, comparando en enteros para que no se pierdan entre medio píxel
  const X0 = Math.round(caja.x0), X1 = Math.round(caja.x1), CY = Math.round(cy), HT = Math.round(T + caja.h), HB = Math.round(B - caja.h);
  const linea = (px, py) => {
    const x = Math.floor(px), y = Math.floor(py);
    if (py < T || py > B) return false;
    if (y === CY) return true;
    const r = Math.hypot(px - cx, py - cy);
    if (Math.abs(r - 29) < 0.6 || r < 1.6) return true;
    if ((x === X0 || x === X1) && ((py <= HT) || (py >= HB))) return true;
    if (x >= X0 && x <= X1 && (y === HT || y === HB)) return true;
    return false;
  };
  const info = { BW: WW, BH: WH, OY, OX, cx: Math.round(cx), ruta0: Math.round(bx(CAMPO.L)), ruta1: Math.round(bx(CAMPO.R)) };

  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const px = x + 0.5, py = y + 0.5;
    let cat;
    if (m(x, y)) {
      let tope = false;
      for (let a = -2; a <= 2 && !tope; a++) for (let c = -2; c <= 2; c++) if (Math.abs(a) + Math.abs(c) <= 2 && !m(x + a, y + c)) { tope = true; break; }
      if (tope) cat = 'tope';
      else {
        let cara = 0;
        for (let k = 3; k <= 6; k++) if (!m(x, y - k)) { cara = k; break; }
        if (cara) cat = cara < 5 ? 'cara1' : 'cara2';
        else if (!m(x, y - 7)) cat = 'sombra';
        else if (py < T || py > B) cat = (x % 3 === 0) || (y % 3 === 0) ? 'redHilo' : 'red';
        else if (linea(px, py)) cat = 'linea';
        else cat = 'campo';
      }
    } else cat = m(x + 1, y) || m(x - 1, y) || m(x, y + 1) || m(x, y - 1) ? 'contorno' : 'afuera';
    pon(x, y, cancha.color(cat, x, y, info));
  }
  g.putImageData(img, 0, 0);
  if (cancha.decorar) cancha.decorar(g, info);
  // cada mitad, tenue, del color de quien la defiende (arriba el azul, abajo el rojo), para saber dónde estás
  g.save();
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
  const tinte = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  g.fillStyle = tinte(COLOR_AUTO[0].cuerpo, 0.14); g.fillRect(0, 0, WW, Math.round(cy));
  g.fillStyle = tinte(COLOR_AUTO[1].cuerpo, 0.14); g.fillRect(0, Math.round(cy) + 1, WW, WH);
  // las líneas del área de cada arco, en el color de su equipo
  [[T, HT, COLOR_AUTO[0].cuerpo], [HB, B, COLOR_AUTO[1].cuerpo]].forEach(([y0, y1, col]) => {
    g.fillStyle = col;
    g.fillRect(X0, Math.round(y0), 1, Math.round(y1 - y0)); g.fillRect(X1, Math.round(y0), 1, Math.round(y1 - y0));
    g.fillRect(X0, y0 === T ? HT : HB, X1 - X0 + 1, 1);
  });
  g.restore();
  // palos con el color de quien defiende
  [[T, COLOR_AUTO[0]], [B, COLOR_AUTO[1]]].forEach(([y, col]) => {
    [g0, g1].forEach((x) => { g.fillStyle = P.contorno; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); g.fillStyle = col.cuerpo; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); });
  });
  return { cv, M };
}

// Hombres-Tanque: gauchos de silicio quietos en la banquina, del otro lado del alambrado.
function armarHombres(M) {
  const lugares = [];
  const libre = (x, y) => { for (let a = -6; a <= 6; a++) for (let c = -8; c <= 12; c++) { const xx = x + a, yy = y + c; if (xx < 0 || yy < 0 || xx >= WW || yy >= WH || M[yy * WW + xx]) return false; } return true; };
  const cerca = (x, y) => { for (let a = -14; a <= 14; a += 2) for (let c = -12; c <= 16; c += 2) { const xx = x + a, yy = y + c; if (xx >= 0 && yy >= 0 && xx < WW && yy < WH && M[yy * WW + xx]) return true; } return false; };
  for (let k = 0; k < 3000 && lugares.length < 26; k++) {
    const x = 4 + Math.floor(hash(k, 7, 21) * (WW - 8)), y = 6 + Math.floor(hash(k, 8, 21) * (WH - 20));
    if (!libre(x, y) || !cerca(x, y)) continue;
    if (lugares.some((o) => Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 18)) continue;
    lugares.push({ x, y, fase: hash(k, 9, 21) * 6.28, gota: 0 });
  }
  return lugares;
}

// Público: un puntito con cabeza en cada lugar libre de las gradas.
function armarPublico(M) {
  const gente = [];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let y = 2; y < WH - 4; y += 4) for (let x = 1; x < WW - 2; x += 3) {
    let libre = true;
    for (let a = -2; a <= 3 && libre; a++) for (let b = -2; b <= 4; b++) {
      const xx = x + a, yy = y + b;
      if (xx >= 0 && yy >= 0 && xx < WW && yy < WH && M[yy * WW + xx]) { libre = false; break; }
    }
    if (!libre || azar() < 0.35) continue;
    gente.push({ x: x + (azar() < 0.5 ? 0 : 1), y, ropa: P.publico[(azar() * P.publico.length) | 0], piel: P.piel[(azar() * 3) | 0], fase: azar() * 6.28,
      lado: (y + 2) * K < (H / 2) * K ? 0 : 1 });
  }
  return gente;
}

export function crearPintor(canvas, opciones = {}) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
  const vista = buf.getContext('2d');
  let b = vista;                                           // se apunta al mundo mientras se dibuja el mundo
  const gran = document.createElement('canvas'); gran.width = VW; gran.height = VW;
  const g = gran.getContext('2d');
  const cancha = CANCHAS[opciones.cancha] || CANCHAS.ruta404;
  const { cv: fondo, M } = fondoFijo(cancha);
  const gente = cancha.publico === 'tribuna' ? armarPublico(M) : [];
  const hombres = cancha.publico === 'hombresTanque' ? armarHombres(M) : [];
  // los sprites de cada auto se arman una vez por diseño y equipo, según quién juega
  const cacheAutos = new Map();
  let nombresAhora = [null, null];
  function spritesDe(i) {
    const d = disenoDe(AUTOS_FORZADOS[i] || nombresAhora[i]);
    const clave = d.nombre + '|' + i;
    if (!cacheAutos.has(clave)) cacheAutos.set(clave, spritesAuto(d, COLOR_AUTO[i]));
    return cacheAutos.get(clave);
  }
  const pelotas = cancha.pelota === 'luzMala' ? spritesLuzMala() : spritesPelota();
  const oscuro = document.createElement('canvas'); oscuro.width = VW; oscuro.height = VW;
  const octx = oscuro.getContext('2d');
  const marcas = document.createElement('canvas'); marcas.width = WW; marcas.height = WH;
  const mctx = marcas.getContext('2d');
  const chispas = [], fantasmas = [];
  let festejo = 0, quienFesteja = -1, temblor = 0;

  function ajustar() {
    [BW, BH] = medidas();
    if (buf.width !== BW || buf.height !== BH) { buf.width = BW; buf.height = BH; }
    const dpr = window.devicePixelRatio || 1;
    const cabe = Math.min(window.innerWidth * dpr / BW, window.innerHeight * dpr / BH);
    const k = Math.max(1, Math.floor(cabe));
    canvas.width = BW * k; canvas.height = BH * k;
    // escala entera para que los píxeles queden nítidos; si la ventana es más chica que el juego, se achica igual
    const css = cabe < 1 ? cabe : k;
    canvas.style.width = `${BW * css / dpr}px`; canvas.style.height = `${BH * css / dpr}px`;
    ctx.imageSmoothingEnabled = false;
  }
  ajustar();
  addEventListener('resize', ajustar);

  function publico(s) {
    const t = s.cuadro / FPS;
    for (const p of gente) {
      const salta = festejo > 0 && (quienFesteja < 0 || p.lado === quienFesteja) ? Math.abs(Math.sin(t * 14 + p.fase)) * 2 : Math.sin(t * 2 + p.fase) > 0.96 ? 1 : 0;
      const y = p.y - Math.round(salta);
      b.fillStyle = p.ropa; b.fillRect(p.x, y + 1, 2, 2);
      b.fillStyle = p.piel; b.fillRect(p.x, y, 2, 1);
    }
  }

  function pastillas(s) {
    const t = s.cuadro;
    if (cancha.nitro === 'aceite') return aceite(s);
    for (const p of s.pastillas) {
      const x = Math.round(bx(p.x)), y = Math.round(by(p.y)), r = p.poder > 50 ? 4 : 2;
      if (!p.activa) { b.fillStyle = 'rgba(20,10,0,.35)'; b.fillRect(x - r, y - 1, r * 2 + 1, 3); continue; }
      const sube = Math.round(Math.sin(t / 10 + p.x) * 1);
      b.fillStyle = 'rgba(0,0,0,.35)'; b.fillRect(x - r, y + r - 1, r * 2 + 1, 2);
      b.fillStyle = P.contorno; b.fillRect(x - r - 1, y - r - 1 + sube - 2, r * 2 + 3, r * 2 + 3);
      b.fillStyle = P.nitro[0]; b.fillRect(x - r, y - r + sube - 2, r * 2 + 1, r * 2 + 1);
      b.fillStyle = P.nitro[1]; b.fillRect(x - r, y - r + sube - 2, r * 2, r * 2);
      b.fillStyle = P.nitro[2]; b.fillRect(x - r + 1, y - r + 1 + sube - 2, Math.max(1, r - 1), Math.max(1, r - 1));
      if ((t >> 3) % 6 === 0) { b.fillStyle = '#fff'; b.fillRect(x + r - 1, y - r + sube - 3, 1, 1); }
    }
  }

  // Nitro como aceite negro: tambores en las esquinas, charcos en el medio, con brillo tornasol.
  function aceite(s) {
    const t = s.cuadro;
    for (const p of s.pastillas) {
      const x = Math.round(bx(p.x)), y = Math.round(by(p.y)), grande = p.poder > 50;
      if (!p.activa) { b.fillStyle = 'rgba(8,6,12,.45)'; b.fillRect(x - 3, y, 7, 2); continue; }
      if (grande) {
        // tambor visto de arriba en tres cuartos: costado, tapa y brillo
        b.fillStyle = '#0c0a12'; b.fillRect(x - 6, y - 7, 13, 14);
        b.fillStyle = '#3a2c48'; b.fillRect(x - 5, y - 2, 11, 8);
        b.fillStyle = '#56446a'; b.fillRect(x - 5, y + 1, 11, 1);
        b.fillStyle = '#20202a'; b.fillRect(x - 5, y - 6, 11, 5);
        b.fillStyle = '#5c5c6a'; b.fillRect(x - 5, y - 6, 11, 1); b.fillRect(x - 5, y - 2, 11, 1);
        const brillo = ['#7a4cc0', '#3fb8a0', '#c060a0'][(t >> 4) % 3];
        b.fillStyle = brillo; b.fillRect(x - 2 + ((t >> 3) % 4), y - 4, 2, 1);
        // gota que cae del borde
        const g = (t + x * 7) % 90;
        if (g < 30) { b.fillStyle = '#0c0a12'; b.fillRect(x + 4, y + 6 + (g >> 3), 1, 2); }
      } else {
        b.fillStyle = '#0c0a12';
        b.fillRect(x - 3, y - 1, 7, 3); b.fillRect(x - 2, y - 2, 5, 5);
        const brillo = ['#7a4cc0', '#3fb8a0', '#c060a0', '#4a7ad0'][((t >> 3) + Math.round(p.x)) % 4];
        b.fillStyle = brillo; b.fillRect(x - 1 + ((t >> 4) % 2), y - 1, 2, 1);
      }
    }
  }

  // El aceite brilla en la noche (se dibuja después de la oscuridad, como la Luz Mala):
  // los tambores con la tapa encendida en naranja y un halo que late; los charcos con un aro
  // tornasol. Así se ven de lejos.
  function aceiteBrillo(s) {
    const t = s.cuadro;
    b.globalCompositeOperation = 'lighter';
    for (const p of s.pastillas) {
      if (!p.activa) continue;
      const x = Math.round(bx(p.x)), y = Math.round(by(p.y)), grande = p.poder > 50;
      const late = 0.5 + 0.5 * Math.sin(t / 9 + p.x);
      if (grande) {
        b.fillStyle = `rgba(255,140,30,${0.18 + 0.14 * late})`; b.beginPath(); b.arc(x, y - 2, 13 + late * 2, 0, Math.PI * 2); b.fill();
        b.fillStyle = `rgba(255,170,60,${0.3 + 0.2 * late})`; b.beginPath(); b.arc(x, y - 3, 7, 0, Math.PI * 2); b.fill();
      } else {
        b.fillStyle = `rgba(120,80,220,${0.16 + 0.14 * late})`; b.beginPath(); b.arc(x, y, 7 + late, 0, Math.PI * 2); b.fill();
      }
    }
    b.globalCompositeOperation = 'source-over';
    for (const p of s.pastillas) {
      if (!p.activa) continue;
      const x = Math.round(bx(p.x)), y = Math.round(by(p.y)), grande = p.poder > 50;
      if (grande) {
        // tapa encendida y chispas que suben
        b.fillStyle = '#ffb030'; b.fillRect(x - 4, y - 5, 9, 2);
        b.fillStyle = '#fff4b0'; b.fillRect(x - 2, y - 5, 5, 1);
        for (let k = 0; k < 3; k++) {
          const f = (t + k * 17 + x) % 40;
          b.fillStyle = f < 20 ? '#ffd040' : '#e07818';
          b.fillRect(x - 3 + ((k * 3 + (t >> 4)) % 7), y - 7 - (f >> 2), 1, 1);
        }
      } else {
        // aro tornasol alrededor del charco
        const col = ['#b06cff', '#3fe0c0', '#ff70c0', '#6aa8ff'][((t >> 3) + Math.round(p.x)) % 4];
        b.fillStyle = col;
        b.fillRect(x - 4, y - 1, 1, 3); b.fillRect(x + 4, y - 1, 1, 3); b.fillRect(x - 1, y - 4, 3, 1); b.fillRect(x - 1, y + 3, 3, 1);
        b.fillRect(x - 3, y - 3, 1, 1); b.fillRect(x + 3, y - 3, 1, 1); b.fillRect(x - 3, y + 2, 1, 1); b.fillRect(x + 3, y + 2, 1, 1);
      }
    }
  }

  // Píxeles muertos de la Ruta 404: cuadrados negros que titilan y a veces se corren de color.
  const muertos = [];
  for (let k = 0; muertos.length < 34 && k < 900; k++) {
    const x = Math.floor(hash(k, 1, 77) * WW), y = Math.floor(hash(k, 2, 77) * WH);
    if (!M[y * WW + x] || (Math.abs(y - by(H / 2)) < 30 && Math.abs(x - bx(W / 2)) < 30)) continue;
    muertos.push({ x, y, t: 2 + Math.floor(hash(k, 3, 77) * 4), fase: Math.floor(hash(k, 4, 77) * 200) });
  }
  function pixelesMuertos(s) {
    const t = s.cuadro;
    for (const m of muertos) {
      const ciclo = (t + m.fase) % 240;
      if (ciclo > 200 && ciclo % 4 < 2) continue;            // a veces desaparece
      b.fillStyle = 'rgba(120,200,255,.16)'; b.fillRect(m.x - 1, m.y - 1, m.t + 2, m.t + 2);
      b.fillStyle = '#000'; b.fillRect(m.x, m.y, m.t, m.t);
      if (ciclo < 6) {                                          // glitch: se corre en rojo y celeste
        b.fillStyle = 'rgba(255,40,90,.8)'; b.fillRect(m.x - 3, m.y, m.t, 1);
        b.fillStyle = 'rgba(40,220,255,.8)'; b.fillRect(m.x + 3, m.y + m.t - 1, m.t + 4, 1);
      }
    }
    // cada tanto, una franja de glitch cruza la ruta
    if ((t % 420) < 4) {
      const y = Math.round(cam.y) + Math.floor(hash(t >> 4, 5, 5) * VW);
      b.fillStyle = 'rgba(40,220,255,.25)'; b.fillRect(cam.x, y, VW, 1);
      b.fillStyle = 'rgba(255,40,90,.25)'; b.fillRect(cam.x, y + 2, VW, 1);
    }
  }

  // Los Hombres-Tanque: silueta con sombrero, poncho y ojos que siguen a la Luz Mala.
  function hombresTanque(s, soloOjos) {
    const pb = s.pelota, ex = bx(pb.x), ey = by(pb.y);
    for (const h of hombres) {
      const x = h.x, y = h.y;
      if (!soloOjos) {
        b.fillStyle = 'rgba(0,0,0,.4)'; b.fillRect(x - 4, y + 10, 9, 2);
        b.fillStyle = '#0e0e14';
        b.fillRect(x - 4, y, 9, 1); b.fillRect(x - 2, y - 2, 5, 2);      // sombrero
        b.fillRect(x - 2, y + 1, 5, 3);                                    // cabeza
        b.fillRect(x - 3, y + 4, 7, 5); b.fillRect(x - 4, y + 6, 9, 2);   // poncho
        b.fillRect(x - 2, y + 9, 2, 2); b.fillRect(x + 1, y + 9, 2, 2);   // piernas
        b.fillStyle = '#2a2a36'; b.fillRect(x - 4, y, 1, 1); b.fillRect(x - 3, y + 4, 1, 3);
        // aceite negro que gotea
        h.gota = (h.gota + 1) % (60 + ((h.fase * 10) | 0));
        if (h.gota < 20) { b.fillStyle = '#05040a'; b.fillRect(x + 2, y + 9 + (h.gota >> 2), 1, 2); }
      } else {
        const mx = Math.sign(Math.round((ex - x) / 20)), my = ey > y + 20 ? 1 : 0;
        const rojo = festejo > 0 && (s.cuadro >> 2) % 2;
        b.fillStyle = rojo ? '#ff3050' : '#c8f4ff';
        b.fillRect(x - 1 + mx, y + 2 + my, 1, 1); b.fillRect(x + 1 + mx, y + 2 + my, 1, 1);
      }
    }
  }

  // El camión de la Ruta 404, visto de arriba: cabina adelante, acoplado largo y oxidado.
  function camion(s) {
    const k = s.camion;
    if (!k || k.estado !== 'pasa') return;
    const x = Math.round(bx(k.x)), y = Math.round(by(k.y)), d = k.dir;
    const L2 = 38, A2 = 14;                                 // medio largo y medio ancho, en píxeles del buffer
    b.fillStyle = 'rgba(0,0,0,.45)'; b.fillRect(x - A2 + 3, y - L2 + 4, A2 * 2, L2 * 2);
    b.fillStyle = '#0c0a12'; b.fillRect(x - A2 - 1, y - L2 - 1, A2 * 2 + 2, L2 * 2 + 2);
    // acoplado
    const ay = d > 0 ? y - L2 : y - L2 + 22;
    b.fillStyle = '#6a6460'; b.fillRect(x - A2, ay, A2 * 2, L2 * 2 - 22);
    b.fillStyle = '#8a827a'; for (let k2 = 0; k2 < L2 * 2 - 22; k2 += 6) b.fillRect(x - A2, ay + k2, A2 * 2, 1);
    b.fillStyle = '#7a4a2a'; b.fillRect(x - A2 + 3, ay + 8, 5, 3); b.fillRect(x + 4, ay + 30, 6, 4);   // óxido
    // cabina
    const cy = d > 0 ? y + L2 - 20 : y - L2;
    b.fillStyle = '#c8a040'; b.fillRect(x - A2 + 1, cy, A2 * 2 - 2, 20);
    b.fillStyle = '#9a7a2c'; b.fillRect(x - A2 + 1, cy + (d > 0 ? 0 : 17), A2 * 2 - 2, 3);
    b.fillStyle = '#3a4a5a'; b.fillRect(x - A2 + 4, cy + (d > 0 ? 12 : 3), A2 * 2 - 8, 5);              // parabrisas
    // faros
    b.fillStyle = '#fff8c8'; const fy = d > 0 ? y + L2 - 1 : y - L2;
    b.fillRect(x - A2 + 2, fy, 4, 2); b.fillRect(x + A2 - 6, fy, 4, 2);
  }

  // Aviso del camión: titila un ícono en el borde de la pantalla del lado de donde viene.
  function avisoCamion(s) {
    const k = s.camion;
    if (!k || k.estado !== 'aviso' || (s.cuadro >> 3) % 2) return;
    const p = aPantalla(bx(k.x), by(k.dir > 0 ? CAMPO.T - 200 : CAMPO.B + 200));
    const x = Math.max(16, Math.min(BW - 48, p.x)), y = Math.max(24, Math.min(BH - 34, p.y));
    b.fillStyle = '#e43a3a'; b.fillRect(Math.round(x) - 14, y - 2, 28, 14);
    b.fillStyle = '#fff8c8'; b.fillRect(Math.round(x) - 10, y + 2, 4, 6); b.fillRect(Math.round(x) + 6, y + 2, 4, 6);
    b.fillStyle = '#140f22'; b.fillRect(Math.round(x) - 3, y + 1, 6, 8);

  }

  // Radar: la cancha entera en chiquito, arriba a la derecha.
  function radar(s, seguir) {
    const rw = 34, rh = 50, x0 = BW - rw - 4, y0 = 20;
    b.fillStyle = 'rgba(20,15,34,.75)'; b.fillRect(x0 - 1, y0 - 1, rw + 2, rh + 2);
    b.fillStyle = 'rgba(255,255,255,.15)'; b.fillRect(x0, y0 + rh / 2, rw, 1);
    const px = (x) => x0 + x / W * rw, py = (y) => y0 + y / H * rh;
    b.fillStyle = COLOR_AUTO[0].cuerpo; b.fillRect(Math.round(px(W / 2)) - 4, y0, 8, 1);
    b.fillStyle = COLOR_AUTO[1].cuerpo; b.fillRect(Math.round(px(W / 2)) - 4, y0 + rh - 1, 8, 1);
    const k = s.camion;
    if (k && (k.estado === 'pasa' || (k.estado === 'aviso' && (s.cuadro >> 3) % 2))) {
      b.fillStyle = '#c8a040'; b.fillRect(Math.round(px(k.x)) - 1, k.estado === 'pasa' ? Math.round(py(k.y)) - 3 : (k.dir > 0 ? y0 : y0 + rh - 6), 3, 6);
    }
    s.autos.forEach((c, i) => { if (c.aplastado) return; b.fillStyle = i === seguir ? '#ffffff' : COLOR_AUTO[i].techo; b.fillRect(Math.round(px(c.x)) - 1, Math.round(py(c.y)) - 1, 2, 2); });
    for (const p of s.pastillas) {
      if (!p.activa) continue;
      b.fillStyle = p.poder > 50 ? '#ffb030' : '#7a5ab0';
      b.fillRect(Math.round(px(p.x)), Math.round(py(p.y)), p.poder > 50 ? 2 : 1, p.poder > 50 ? 2 : 1);
    }
    b.fillStyle = '#b4ffd0'; b.fillRect(Math.round(px(s.pelota.x)), Math.round(py(s.pelota.y)), 1, 1);
  }

  // Noche: todo oscuro salvo la Luz Mala, los faros y un poco alrededor de cada auto.
  // Luces suaves: se arman una sola vez (degradés sin escalones) y después se estampan.
  // Un halo redondo y un cono de faro, con bordes que se desvanecen.
  function luzRedonda(r) {
    const cv = document.createElement('canvas'); cv.width = cv.height = r * 2;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    for (let i = 0; i <= 12; i++) { const t = i / 12; gr.addColorStop(t, `rgba(0,0,0,${Math.pow(1 - t, 1.4)})`); }   // cae parejo, sin escalones
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return cv;
  }
  function luzCono(largo, ancho) {
    // apunta hacia la derecha; el origen está en (0, ancho)
    const w = largo, h = ancho * 2, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h);
    const suave = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = x / w, media = 3 + (ancho - 3) * f, d = Math.abs(y + 0.5 - ancho) / media;
      const a = Math.pow(1 - f, 0.8) * suave((1 - d) / 0.5) * suave(f / 0.1);
      img.data[(y * w + x) * 4 + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  const LUZ = { mala: luzRedonda(60), auto: luzRedonda(20), nitro: luzRedonda(15), grande: luzRedonda(22), chica: luzRedonda(13),
    camion: luzRedonda(38), faro: luzCono(60, 24), faroCamion: luzCono(150, 60) };
  const brilloVerde = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 48;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(90,200,140,.55)'); gr.addColorStop(0.35, 'rgba(60,160,110,.3)'); gr.addColorStop(1, 'rgba(40,110,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    return cv;
  })();

  function noche(s) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, VW, VW);
    octx.fillStyle = 'rgba(6,8,22,.48)'; octx.fillRect(0, 0, VW, VW);
    octx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
    octx.globalCompositeOperation = 'destination-out';
    const halo = (x, y, sp, a, esc = 1) => {
      const w = sp.width * esc; octx.globalAlpha = a;
      octx.drawImage(sp, Math.round(x - w / 2), Math.round(y - w / 2), Math.round(w), Math.round(w));
    };
    const cono = (x, y, ang, sp, a) => {
      octx.save(); octx.globalAlpha = a; octx.translate(x, y); octx.rotate(ang);
      octx.drawImage(sp, 0, -sp.height / 2); octx.restore();
    };
    // Luz Mala: un halo grande que titila
    const pb = s.pelota, ex = bx(pb.x), ey = by(pb.y), tit = 1 + 0.08 * Math.sin(s.cuadro / 3) + (hash(s.cuadro, 1) < 0.05 ? -0.2 : 0);
    halo(ex, ey, LUZ.mala, 1, tit);
    // el camión trae dos faros enormes
    const k = s.camion;
    if (k && k.estado === 'pasa') {
      const x = bx(k.x), y = by(k.y), d = k.dir;
      halo(x, y, LUZ.camion, 0.45);
      cono(x, y + d * 30, d > 0 ? Math.PI / 2 : -Math.PI / 2, LUZ.faroCamion, 0.75);
    }
    for (const c of s.autos) {
      if (c.aplastado) continue;
      const x = bx(c.x), y = by(c.y), ang = c.rot * Math.PI / 180, co = Math.cos(ang), si = Math.sin(ang);
      halo(x, y, LUZ.auto, 0.5);
      cono(x + co * 8, y + si * 8, ang, LUZ.faro, 0.85);
      if (c.nitroActivo) halo(x - co * 14, y - si * 14, LUZ.nitro, 0.6);
    }
    for (const p of s.pastillas) if (p.activa) halo(bx(p.x), by(p.y), p.poder > 50 ? LUZ.grande : LUZ.chica, p.poder > 50 ? 0.45 : 0.32);
    octx.globalAlpha = 1;
    b.drawImage(oscuro, cam.x, cam.y);
    // brillo verde de la Luz Mala sobre lo que ilumina
    b.globalCompositeOperation = 'lighter';
    const bw = Math.round(48 * tit);
    b.drawImage(brilloVerde, Math.round(ex - bw / 2), Math.round(ey - bw / 2), bw, bw);
    b.globalCompositeOperation = 'source-over';
  }

  function auto(c, i) {
    const x = bx(c.x), y = by(c.y);
    if (c.aplastado) {
      // chatarra aplastada que titila hasta que vuelve a aparecer en su arco
      if (c.aplastado < 40 && (c.aplastado >> 2) % 2) return;
      b.fillStyle = '#0c0a12'; b.fillRect(Math.round(x) - 12, Math.round(y) - 5, 25, 11);
      b.fillStyle = COLOR_AUTO[i].lado; b.fillRect(Math.round(x) - 11, Math.round(y) - 4, 23, 9);
      b.fillStyle = COLOR_AUTO[i].oscuro; b.fillRect(Math.round(x) - 6, Math.round(y) - 2, 12, 5);
      b.fillStyle = '#4a4a56'; b.fillRect(Math.round(x) - 9, Math.round(y) + 3, 5, 1); b.fillRect(Math.round(x) + 3, Math.round(y) - 3, 6, 1);
      return;
    }
    const alto = c.salto > 0 ? Math.sin(Math.PI * (1 - c.salto / 22)) * 7 : 0;
    // sombra
    b.fillStyle = 'rgba(0,0,0,.38)';
    b.beginPath(); b.ellipse(Math.round(x) + 1, Math.round(y) + 3, 10 - alto * 0.4, 6 - alto * 0.3, 0, 0, Math.PI * 2); b.fill();
    const k = Math.round(((c.rot % 360) + 360) % 360 / 360 * ANGULOS) % ANGULOS;
    const sp = spritesDe(i)[k];
    // fuego del nitro, en píxeles detrás del auto
    if (c.nitroActivo) {
      const co = Math.cos(c.rot * Math.PI / 180), si = Math.sin(c.rot * Math.PI / 180);
      for (let n = 0; n < 6; n++) {
        const d = 12 + n * 1.6 + Math.random() * 2;
        b.fillStyle = cancha.nitro === 'aceite' ? (n < 2 ? '#ffb030' : n < 3 ? '#e07818' : n < 5 ? '#2a2430' : '#141018') : n < 2 ? P.nitro[2] : n < 4 ? P.nitro[1] : P.nitro[0];
        b.fillRect(Math.round(x - co * d + (Math.random() - 0.5) * 2), Math.round(y - si * d - alto + (Math.random() - 0.5) * 2), 2, 2);
      }
    }
    if (c.salto > 0 && (c.saltoTipo === 'adelante' || c.saltoTipo === 'atras')) {
      const v = Math.max(0.25, Math.abs(Math.cos(Math.PI * (1 - c.salto / 22))));
      b.drawImage(sp, Math.round(x - TAM / 2), Math.round(y - TAM / 2 - alto + TAM * (1 - v) / 2), TAM, Math.max(1, Math.round(TAM * v)));
    } else {
      b.drawImage(sp, Math.round(x - TAM / 2), Math.round(y - TAM / 2 - alto));
    }
    // marcas de derrape
    if (Math.abs(c.lat || 0) > 0.9 && !c.salto) {
      const co = Math.cos(c.rot * Math.PI / 180), si = Math.sin(c.rot * Math.PI / 180);
      mctx.fillStyle = cancha.noche ? 'rgba(8,8,12,.5)' : 'rgba(16,40,20,.35)';
      [-1, 1].forEach((l) => mctx.fillRect(Math.round(x - co * 6 - si * 5 * l), Math.round(y - si * 6 + co * 5 * l + 2), 1, 1));
      if (Math.random() < 0.4) chispazo(x - co * 9, y - si * 9, 1, '#d8d8d8');
    }
  }

  function pelota(p) {
    const x = Math.round(bx(p.x)), y = Math.round(by(p.y));
    if (cancha.pelota === 'luzMala') {
      // flota: sin sombra dura, sube y baja apenas
      const flota = Math.round(Math.sin(Date.now() / 260) * 1.5);
      b.drawImage(pelotas[(Date.now() / 90 | 0) & 7], x - 6, y - 9 + flota);
      return;
    }
    b.fillStyle = 'rgba(0,0,0,.38)'; b.fillRect(x - 4, y + 4, 9, 3); b.fillRect(x - 3, y + 3, 7, 5);
    b.drawImage(pelotas[Math.floor(p.giro * 1.3) & 7], x - 6, y - 8);
  }

  function chispazo(x, y, n, col) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = 0.4 + Math.random() * 1.4;
      chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 14 + Math.random() * 12, col });
    }
  }

  function efectos(s) {
    for (const e of s.eventos) {
      const pb = s.pelota;
      if (e.t === 'toque' && e.fuerza > 6) { chispazo(bx(pb.x), by(pb.y), e.fuerte ? 16 : 6, e.fuerte ? '#ffe060' : '#ffffff'); if (e.fuerte) temblor = 6; }
      if (e.t === 'gol') { chispazo(bx(pb.x), by(pb.y), 50, COLOR_AUTO[e.quien].techo); festejo = 150; quienFesteja = e.quien === 0 ? 1 : 0; temblor = 12; }
      if (e.t === 'nitro') { const c = s.autos[e.quien]; chispazo(bx(c.x), by(c.y), e.grande ? 12 : 4, P.nitro[1]); }
      if (e.t === 'cuantico') {
        fantasmas.push({ x: bx(e.desde.x), y: by(e.desde.y), vida: 24 });
        chispazo(bx(e.hasta.x), by(e.hasta.y), 18, '#b4ffd0'); chispazo(bx(e.desde.x), by(e.desde.y), 10, '#40dcff');
        temblor = Math.max(temblor, 4);
      }
      if (e.t === 'aterriza') { const c = s.autos[e.quien]; chispazo(bx(c.x), by(c.y) + 2, 6, '#c8c0a8'); }
      if (e.t === 'choque' || e.t === 'choqueAutos') temblor = Math.max(temblor, 3);
    }
    // la Luz Mala que se fue: queda un fantasma que se desarma en rojo y celeste
    for (let k = fantasmas.length - 1; k >= 0; k--) {
      const f = fantasmas[k]; if (--f.vida <= 0) { fantasmas.splice(k, 1); continue; }
      const sep = (24 - f.vida) >> 2;
      b.globalAlpha = f.vida / 24;
      b.fillStyle = '#ff2860'; b.fillRect(Math.round(f.x) - 4 - sep, Math.round(f.y) - 4, 8, 8);
      b.fillStyle = '#28dcff'; b.fillRect(Math.round(f.x) - 4 + sep, Math.round(f.y) - 4, 8, 8);
      b.fillStyle = '#ffffff'; b.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2 + ((f.vida & 2) ? 1 : -1), 4, 4);
      b.globalAlpha = 1;
    }
    for (let k = chispas.length - 1; k >= 0; k--) {
      const p = chispas[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93;
      if (--p.vida <= 0) { chispas.splice(k, 1); continue; }
      b.fillStyle = p.col; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }

  function hud(s) {
    // marcador arriba, sobre las gradas, y el reloj del partido debajo
    marcador(s, BW / 2, 2);
    reloj(s, BW / 2, 19);
    // quién juega: el nombre de cada uno al lado de su mitad del marcador, recortado a lo que entre
    const entran = Math.max(0, Math.floor((BW / 2 - 36 - 38) / 6));
    nombresAhora.forEach((n, i) => {
      if (!n || !entran) return;
      const corto = n.length > entran ? n.slice(0, entran - 1) + '.' : n;
      texto(b, corto, BW / 2 + (i === 0 ? -36 : 36), 5, { alinear: i === 0 ? 'der' : 'izq', color: COLOR_AUTO[i].techo, sombra: P.contorno });
    });
    // barras de nitro en las gradas de los costados, en bloques
    s.autos.forEach((c, i) => {
      const x = i === 0 ? 4 : BW - 10, y0 = i === 0 ? 70 : BH - 70 - 101;
      b.fillStyle = P.contorno; b.fillRect(x - 1, y0 - 1, 8, 103);
      for (let k = 0; k < 10; k++) {
        const lleno = c.nitro >= (k + 1) * 10 - 5;
        b.fillStyle = lleno ? (c.nitroActivo ? P.nitro[2] : P.nitro[1]) : '#3a3456';
        b.fillRect(x, y0 + 100 - (k + 1) * 10 + 1, 6, 9);
      }
      const yy = i === 0 ? y0 - 9 : y0 + 104;
      b.fillStyle = P.contorno; b.fillRect(x - 1, yy - 1, 8, 8);
      b.fillStyle = c.recarga ? '#3a3456' : COLOR_AUTO[i].techo; b.fillRect(x, yy, 6, 6);
    });
  }

  // Reloj: lo que queda del partido; rojo y latiendo en los últimos 30 s; en el alargue, GOL DE ORO.
  function reloj(s, cx, y) {
    if (s.oro) {
      const w = t('oro').length * 6 + 8;
      b.fillStyle = P.contorno; b.fillRect(cx - w / 2 - 1, y - 1, w + 2, 11);
      b.fillStyle = (s.cuadro >> 4) % 2 ? '#ffd040' : '#c89a20'; b.fillRect(cx - w / 2, y, w, 9);
      texto(b, t('oro'), cx, y + 1, { alinear: 'centro', color: '#2a1a04', sombra: null });
      return;
    }
    const resta = Math.max(0, Math.ceil((TIEMPO_PARTIDO - s.tiempoJuego) / FPS));
    const txt = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
    const ultimos = resta <= 30, late = ultimos && (s.cuadro >> 4) % 2;
    b.fillStyle = 'rgba(20,15,34,.75)'; b.fillRect(cx - 15, y - 1, 30, 11);
    texto(b, txt, cx, y + 1, { alinear: 'centro', color: ultimos ? (late ? '#ff6a6a' : '#ffb0b0') : '#e8e4ff', sombra: null });
  }

  // Marcador: un bloque de cada color con su número. esc agranda todo.
  function marcador(s, cx, y, esc = 1, resaltar = -1) {
    const w = 26 * esc, h = 14 * esc, sep = 10 * esc;
    const x0 = Math.round(cx - w - sep / 2);
    b.fillStyle = P.contorno; b.fillRect(x0 - 1, y - 1, w * 2 + sep + 2, h + 2);
    b.fillStyle = '#2a2448'; b.fillRect(x0, y, w * 2 + sep, h);
    [0, 1].forEach((i) => {
      const x = i === 0 ? x0 : x0 + w + sep;
      const brilla = resaltar === i && (Date.now() / 160 | 0) % 2;
      b.fillStyle = brilla ? COLOR_AUTO[i].techo : COLOR_AUTO[i].cuerpo; b.fillRect(x, y, w, h);
      b.fillStyle = COLOR_AUTO[i].lado; b.fillRect(x, y + h - esc, w, esc);
      texto(b, s.autos[i].goles, x + w / 2, y + 4 * esc - (esc > 1 ? esc : 0), { alinear: 'centro', esc, sombra: COLOR_AUTO[i].oscuro });
    });
    b.fillStyle = '#9890b8'; b.fillRect(Math.round(cx) - 2 * esc, y + h / 2 - esc / 2, 4 * esc, esc);
  }

  function franja(alto, col) {
    const y0 = Math.round(BH / 2 - alto / 2);
    b.fillStyle = 'rgba(20,15,34,.78)'; b.fillRect(0, y0, BW, alto);
    b.fillStyle = col; b.fillRect(0, y0 - 1, BW, 2); b.fillRect(0, y0 + alto - 1, BW, 2);
    return y0;
  }

  function autoChico(i, x, y, rotK = 0) { b.drawImage(spritesDe(i)[rotK], Math.round(x - TAM / 2), Math.round(y - TAM / 2)); }

  function cartelGol(s) {
    const i = s.ultimoGol, y0 = franja(70, COLOR_AUTO[i].techo);
    autoChico(i, 46, y0 + 35, 0);
    b.drawImage(pelotas[(s.cuadro >> 2) & 7], 70, y0 + 28);
    marcador(s, BW / 2 + 30, y0 + 21, 2, i);
  }

  // ---------- botones tocables dibujados en el buffer ----------
  const zonas = [];
  function boton(id, x, y, w, h, col, dibujo) {
    x = Math.round(x); y = Math.round(y);
    zonas.push({ id, x, y, w, h });
    b.fillStyle = P.contorno; b.fillRect(x - 1, y - 1, w + 2, h + 3);
    b.fillStyle = col.lado || '#3a3456'; b.fillRect(x, y + 2, w, h);
    b.fillStyle = col.cuerpo || '#5a5480'; b.fillRect(x, y, w, h);
    b.fillStyle = 'rgba(255,255,255,.25)'; b.fillRect(x + 1, y, w - 2, 1);
    dibujo(x, y);
  }
  const GRIS = { cuerpo: '#4a4470', lado: '#2a2448' };
  function botonEn(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const x = (cx - r.left) / r.width * BW, y = (cy - r.top) / r.height * BH;
    for (let i = zonas.length - 1; i >= 0; i--) { const z = zonas[i]; if (x >= z.x - 3 && x <= z.x + z.w + 3 && y >= z.y - 3 && y <= z.y + z.h + 5) return z.id; }
    return null;
  }

  function cartelFinal(s, extra) {
    const i = s.ganador, y0 = franja(118, COLOR_AUTO[i].techo);
    icono(b, 'trofeo', BW / 2 - 18, y0 + 8, 4);
    autoChico(i, BW / 2 - 52, y0 + 30, 0); autoChico(i, BW / 2 + 52, y0 + 30, ANGULOS / 2);
    marcador(s, BW / 2, y0 + 50, 2, i);
    // solo "otra": ya no se desafía a un amigo con un link (todos los partidos son rankeados)
    const conAmigo = true;
    const dw = 24 + t('desafiar').length * 6, ox = conAmigo ? BW / 2 - 30 : BW / 2 - (60 + 8 + dw) / 2;
    boton('otra', ox, y0 + 86, 60, 22, COLOR_AUTO[i], (x, y) => {
      if (!extra.tactil) tecla(b, '⏎', x + 8, y + 4, 21);
      icono(b, extra.rankeada ? 'globo' : 'otra', extra.tactil ? x + 21 : x + 36, y + 6, extra.tactil ? 2 : 1);
    });
    if (!conAmigo) {
      boton('desafiar', ox + 68, y0 + 86, dw, 22, { cuerpo: '#4a4a9a', lado: '#2a2a62' }, (x, y) => {
        icono(b, 'cadena', x + 5, y + 7);
        texto(b, t('desafiar'), x + 18, y + 8, { color: '#fff' });
      });
    }
    // rankeada: cuánto Elo ganaste o perdiste, al lado de tu color
    const r = extra.red;
    if (r && r.rankeada && r.elo && r.lado >= 0) {
      const d = r.elo.cambio[r.lado];
      texto(b, `${d >= 0 ? '+' : ''}${d}`, r.lado === 0 ? BW / 2 - 96 : BW / 2 + 96, y0 + 58, { esc: 2, alinear: 'centro', color: d >= 0 ? '#7cf09a' : '#ff6a6a', sombra: P.contorno });
      texto(b, r.elo.elo[r.lado], r.lado === 0 ? BW / 2 - 96 : BW / 2 + 96, y0 + 78, { alinear: 'centro', color: '#c8f4ff' });
    }
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, y) => icono(b, 'casa', x + 7, y + 5));
  }

  // Ranking: humanos e IAs mezclados por Elo. Las IAs llevan un robotito; vos estás resaltado.
  function pantallaRanking(extra) {
    b.fillStyle = 'rgba(20,15,34,.9)'; b.fillRect(0, 0, BW, BH);
    if (BW > BH) icono(b, 'trofeo', BW / 2 - 9, 8, 2); else icono(b, 'trofeo', BW / 2 - 18, 8, 4);
    const d = extra.ranking;
    if (!d) { const t = (Date.now() / 140 | 0) % 8; for (let k = 0; k < 8; k++) { b.fillStyle = k === t ? '#fff4b0' : '#3a3456'; b.fillRect(BW / 2 - 30 + k * 8, 120, 5, 5); } }
    else if (d.error) { icono(b, 'globo', BW / 2 - 18, 110, 4); icono(b, 'cruz', BW / 2 - 18, 110, 4); }
    else {
      // cuántas filas entran: parado 14, acostado menos (dejando lugar a tu fila y al botón de volver)
      const y0 = BW > BH ? 40 : 52, entran = Math.max(5, Math.floor((BH - y0 - 58) / 15));
      const filas = d.lista.slice(0, entran);
      const propio = d.propio || (d.lista.slice(entran).find((f) => f.yo));
      // columnas desde la derecha, medidas con lo más largo que se muestra (6 px por letra):
      // ganados/jugados, el trofeo y el Elo; el nombre se recorta si no entra
      const todas = propio ? [...filas, propio] : filas;
      const wRec = Math.max(...todas.map((f) => `${f.victorias}/${f.partidas}`.length)) * 6;
      const wElo = Math.max(...todas.map((f) => String(f.elo).length)) * 6;
      const xTrofeo = BW - 12 - wRec - 12, xElo = xTrofeo - 4;
      const fila = (f, y) => {
        if (f.yo) { b.fillStyle = '#3a6a5a'; b.fillRect(8, y - 3, BW - 16, 13); }
        texto(b, f.puesto, 30, y, { alinear: 'der', color: f.puesto <= 3 ? '#ffd040' : '#9890c0' });
        if (f.ia) icono(b, 'robot', 36, y - 1);
        const xNombre = f.ia ? 48 : 38, entra = Math.max(3, Math.floor((xElo - wElo - 8 - xNombre) / 6));
        const nombre = f.nombre.length > entra ? f.nombre.slice(0, entra - 1) + '.' : f.nombre;
        texto(b, nombre, xNombre, y, { color: f.yo ? '#ffffff' : '#e8e4ff' });
        texto(b, f.elo, xElo, y, { alinear: 'der', color: '#fff4b0' });
        icono(b, 'trofeo', xTrofeo, y - 1);
        texto(b, `${f.victorias}/${f.partidas}`, BW - 12, y, { alinear: 'der', color: '#9890c0' });
      };
      filas.forEach((f, k) => fila(f, y0 + k * 15));
      if (propio) { b.fillStyle = '#5a5480'; b.fillRect(20, y0 + entran * 15 + 2, BW - 40, 1); fila(propio, y0 + (entran + 1) * 15); }
    }
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, yy) => icono(b, 'casa', x + 7, yy + 5));
  }

  // Quién sos: el panel de cuenta es HTML (src/cuenta.js), encima del canvas; acá solo el fondo.
  function pantallaNombre() {
    b.fillStyle = 'rgba(20,15,34,.9)'; b.fillRect(0, 0, BW, BH);
    autoChico(0, BW / 2, 60, ANGULOS * 3 / 4);
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, y) => icono(b, 'casa', x + 7, y + 5));
  }

  // Rankeada en juego: irse es perder, así que se pregunta antes.
  function cartelSalida(extra) {
    const y0 = franja(92, '#ff6a6a');
    texto(b, t('salirPierde'), BW / 2, y0 + 12, { alinear: 'centro', color: '#fff4b0' });
    texto(b, t('salirPierde2'), BW / 2, y0 + 24, { alinear: 'centro', color: '#fff4b0' });
    const w1 = 30 + t('seguirJugando').length * 6, w2 = 30 + t('irmeIgual').length * 6, x0 = BW / 2 - (w1 + 10 + w2) / 2;
    boton('quedarme', x0, y0 + 46, w1, 24, { cuerpo: '#2f8f6a', lado: '#1c5a42' }, (x, y) => {
      if (!extra.tactil) tecla(b, 'ESC', x + 4, y + 6, 21);
      texto(b, t('seguirJugando'), extra.tactil ? x + w1 / 2 : x + 28, y + 9, { alinear: extra.tactil ? 'centro' : 'izq', color: '#fff' });
    });
    boton('irme', x0 + w1 + 10, y0 + 46, w2, 24, { cuerpo: '#8a2a3a', lado: '#5a1a24' }, (x, y) => {
      if (!extra.tactil) tecla(b, 'Q', x + 4, y + 6);
      texto(b, t('irmeIgual'), extra.tactil ? x + w2 / 2 : x + 22, y + 9, { alinear: extra.tactil ? 'centro' : 'izq', color: '#fff' });
    });
  }

  function portada(s, extra) {
    b.fillStyle = 'rgba(20,15,34,.86)'; b.fillRect(0, 0, BW, BH);
    const ancho = BW > BH;   // pantalla horizontal: modos a la izquierda, controles a la derecha

    // aviso después de irse de una rankeada
    if (extra.aviso === 'abandono') {
      const w = t('abandonaste').length * 6 + 16;
      b.fillStyle = '#5a1a24'; b.fillRect(BW / 2 - w / 2, 58, w, 14);
      texto(b, t('abandonaste'), BW / 2, 62, { alinear: 'centro', color: '#ffd0d0', sombra: null });
    }
    // tu cuenta, arriba a la derecha: tu nombre (con ✓ si entraste con Google o mail) o "ENTRAR"
    {
      const nombre = extra.yo ? extra.yo.nombre : t('entrarCanvas');
      const unida = extra.yo && extra.yo.cuentas && extra.yo.cuentas.length;
      const w = 20 + nombre.length * 6 + (unida ? 10 : 0);
      boton('cuenta', BW - w - 4, 4, w, 18, extra.yo ? GRIS : { cuerpo: '#2f8f6a', lado: '#1c5a42' }, (x, y) => {
        icono(b, 'persona', x + 5, y + 4);
        texto(b, nombre, x + 17, y + 5, { color: extra.yo ? '#c8f4ff' : '#fff' });
        if (unida) icono(b, 'tilde', x + w - 13, y + 4);
      });
    }

    // título: POTRERO 404, con el 404 que cada tanto se corre como un píxel muerto
    const ty = 30, te = BW >= 272 ? 4 : 3;
    texto(b, 'POTRERO 404', BW / 2 + 2, ty + 2, { esc: te, alinear: 'centro', color: '#ffb030', sombra: '#7a2a10' });
    texto(b, 'POTRERO 404', BW / 2, ty, { esc: te, alinear: 'centro', color: '#fff4b0', sombra: null });
    const x404 = BW / 2 - (11 * 6 * te - te) / 2 + 8 * 6 * te;
    if ((s.cuadro % 150) < 10) {
      texto(b, '404', x404 - 3, ty, { esc: te, color: 'rgba(255,40,90,.85)', sombra: null });
      texto(b, '404', x404 + 3, ty + 1, { esc: te, color: 'rgba(40,220,255,.85)', sombra: null });
      texto(b, '404', x404, ty, { esc: te, color: '#fff4b0', sombra: null });
    }

    // columnas: en vertical todo apilado; en horizontal, dos columnas
    const m = 12;
    const colA = ancho ? { x: m, w: Math.round(BW / 2) - m - 6, y: 70 } : { x: m, w: BW - 2 * m, y: 72 };
    const colB = ancho ? { x: Math.round(BW / 2) + 6, w: Math.round(BW / 2) - m - 6, y: 70 } : null;

    // un solo modo, igual que las IAs: rankeada contra un rival al azar. No hay práctica ni salas con amigos.
    const modos = [
      ['online', { cuerpo: '#2f8f6a', lado: '#1c5a42' }, t('online'), t('onlineSub')],
    ];
    // el nombre va en una línea si entra (con la tecla al lado); si no, en dos, y el botón crece
    const partes = modos[0][2].split('|'), junto = partes.join(' ');
    const lineas = junto.length * 12 + 16 + (extra.tactil ? 0 : 26) <= colA.w ? [junto] : partes;
    const alto = 18 + lineas.length * 18, sep = 7;
    modos.forEach(([id, col, , sub], k) => {
      const y = colA.y + k * (alto + sep);
      boton(id, colA.x, y, colA.w, alto, col, (x, yy) => {
        lineas.forEach((l, i) => texto(b, l, x + 8, yy + 6 + i * 18, { esc: 2, color: '#fff' }));
        texto(b, sub, x + Math.max(3, Math.min(8, colA.w - sub.length * 6 - 2)), yy + alto - 12, { color: '#e0dcf6', sombra: null });
        if (!extra.tactil) tecla(b, '⏎', x + colA.w - 26, yy + 6, 21);
      });
    });
    let y = colA.y + modos.length * (alto + sep) + 2;

    // controles (en la compu); en el celu los botones de la pantalla ya muestran qué hacen
    const cx = colB ? colB.x : colA.x, cw = colB ? colB.w : colA.w;
    let yc = colB ? colB.y : y + 4;
    if (!extra.tactil) {
      b.fillStyle = '#2a2448'; b.fillRect(cx, yc, cw, 100);
      const fila = (yy, ic, nombre, teclas) => {
        icono(b, ic, cx + 6, yy + 2);
        texto(b, nombre, cx + 20, yy + 3, { color: '#c8c2ea' });
        let x = cx + cw - 6;
        for (let i = teclas.length - 1; i >= 0; i--) {
          const [et, w] = teclas[i];
          x -= w; tecla(b, et, x, yy, w); x -= 4;
        }
      };
      fila(yc + 6, 'flecha', t('mover'), [['WASD', 29], ['↑↓←→', 29]]);
      fila(yc + 30, 'derrape', t('derrape'), [['⇧', 21], ['C', 13]]);
      fila(yc + 54, 'nitro', t('nitro'), [['', 30], ['CTRL', 29]]);
      fila(yc + 78, 'camara', t('camara'), [['B', 13]]);
      yc += 106;
    } else {
      // en el celu: palanca a la izquierda para manejar, botones redondos a la derecha
      b.fillStyle = '#2a2448'; b.fillRect(cx, yc, cw, 76);
      const circulo = (x, y, r, col) => { b.fillStyle = P.contorno; b.beginPath(); b.arc(x, y, r + 1, 0, 7); b.fill(); b.fillStyle = col; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill(); };
      const fila = (yy, dibujo, nombre) => { dibujo(cx + 14, yy + 6); texto(b, nombre, cx + 30, yy + 3, { color: '#c8c2ea' }); };
      fila(yc + 6, (x, y) => { circulo(x, y, 8, '#3a3456'); circulo(x + 2, y - 2, 4, '#9890b8'); }, t('mover'));
      fila(yc + 30, (x, y) => { circulo(x, y, 8, '#4a4470'); icono(b, 'derrape', x - 4, y - 4); }, t('derrape'));
      fila(yc + 54, (x, y) => { circulo(x, y, 8, '#e07818'); icono(b, 'nitro', x - 4, y - 4); }, t('nitro'));
      // dónde va cada cosa en la pantalla
      // un celu dibujado: parado si la pantalla está parada, acostado si está acostada
      const pw = ancho ? 76 : 40, ph = ancho ? 44 : 64, mx = cx + cw - pw - 6, my = yc + (76 - ph) / 2;
      b.fillStyle = '#1c1830'; b.fillRect(mx, my, pw, ph);
      circulo(mx + 10, my + ph - 12, 6, '#3a3456');
      circulo(mx + pw - 9, my + ph - 10, 5, '#e07818'); circulo(mx + pw - 19, my + ph - 10, 4, '#4a4470');
      yc += 82;
    }
    if (!colB) y = yc; else y = Math.max(y, yc);
    // celu parado: se juega mejor acostado
    if (extra.tactil && !ancho) {
      const gy0 = BH - 58;
      b.fillStyle = 'rgba(255,244,176,.1)'; b.fillRect(12, gy0, BW - 24, 18);
      texto(b, t('girar'), BW / 2 + 8, gy0 + 6, { alinear: 'centro', color: '#fff4b0' });
      const ex = BW / 2 - t('girar').length * 3 - 8;
      b.fillStyle = '#fff4b0'; b.fillRect(ex, gy0 + 4, 6, 10); b.fillStyle = '#2a2448'; b.fillRect(ex + 1, gy0 + 5, 4, 8);
    }

    // se gana con 3 goles
    const gy = colB ? yc + 2 : y + 2;
    const gx = colB ? cx + cw / 2 : BW / 2;
    texto(b, t('gana'), gx, gy, { alinear: 'centro', color: '#fff4b0' });
    for (let k = 0; k < GOLES_PARA_GANAR; k++) b.drawImage(pelotas[(k * 3 + (s.cuadro >> 3)) & 7], gx - 30 + k * 16, gy + 11);
    icono(b, 'flecha', gx + 18, gy + 13); icono(b, 'trofeo', gx + 30, gy + 11, 2);

    // ranking y sonido abajo
    const rw = 22 + t('ranking').length * 6;
    boton('ranking', BW / 2 - rw / 2, BH - 26, rw, 18, { cuerpo: '#7a5a20', lado: '#4a3410' }, (x, yy) => {
      icono(b, 'trofeo', x + 5, yy + 3);
      texto(b, t('ranking'), x + 17, yy + 5, { color: '#fff' });
      if (!extra.tactil) tecla(b, '2', x + rw - 6, yy - 9);
    });
    // instalar como app: solo si el navegador lo ofrece (Android, compu), abajo a la izquierda
    if (extra.instalable) {
      const iw = 22 + t('instalar').length * 6;
      boton('instalar', 6, BH - 26, iw, 18, { cuerpo: '#4a4a9a', lado: '#2a2a62' }, (x, yy) => {
        b.fillStyle = '#fff'; b.fillRect(x + 8, yy + 4, 2, 7); b.fillRect(x + 6, yy + 9, 6, 1); b.fillRect(x + 7, yy + 10, 4, 1); b.fillRect(x + 5, yy + 13, 8, 1);
        texto(b, t('instalar'), x + 17, yy + 5, { color: '#fff' });
      });
    }
    // idioma: ES / EN / PT, a la izquierda del sonido; cada toque pasa al siguiente
    {
      const sw0 = 22 + t('sonido').length * 6, iw = 24;
      boton('idioma', BW - sw0 - 6 - iw - 6, BH - 26, iw, 18, GRIS, (x, yy) => {
        texto(b, (extra.idioma || 'es').toUpperCase(), x + iw / 2, yy + 5, { alinear: 'centro', color: '#c8f4ff' });
      });
    }
    // sonido: verde prendido; gris y tachado apagado
    const sw = 22 + t('sonido').length * 6;
    boton('sonido', BW - sw - 6, BH - 26, sw, 18, extra.sonido ? { cuerpo: '#2f8f6a', lado: '#1c5a42' } : GRIS, (x, yy) => {
      icono(b, 'sonido', x + 5, yy + 4);
      if (!extra.sonido) { b.fillStyle = '#ff6a6a'; for (let k = 0; k < 9; k++) b.fillRect(x + 5 + k, yy + 4 + k, 1, 1); }
      texto(b, t('sonido'), x + 17, yy + 5, { color: extra.sonido ? '#fff' : '#9890b8' });
      if (!extra.tactil) tecla(b, 'M', x + sw - 6, yy - 9);
    });
  }

  // Intro: el logo de Kvothesson (un hexágono que se dibuja y el nombre) y después la cinemática
  // de la Ruta 404 (cinematica.js), que termina con dos corredores jugando de verdad. Cualquier tecla o toque la saltea.
  function intro(s, it) {
    const tt = it.t || 0;
    if (it.fase === 'logo') {
      b.fillStyle = '#0c0a14'; b.fillRect(0, 0, BW, BH);
      const cx = BW / 2, cy = BH / 2 - 14, R = Math.round(Math.min(BW, BH) * 0.12);
      const pts = [...Array(7)].map((_, i) => { const a = Math.PI / 3 * i - Math.PI / 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
      const prog = Math.min(1, tt / 0.9) * 6;
      b.strokeStyle = '#66e0ff'; b.lineWidth = 2; b.beginPath(); b.moveTo(...pts[0]);
      for (let i = 1; i <= 6; i++) { const f = Math.min(1, Math.max(0, prog - (i - 1))); if (f <= 0) break; const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; b.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); }
      b.stroke();
      if (tt > 0.8) {
        b.globalAlpha = Math.min(1, (tt - 0.8) / 0.4);
        const w = 10 * 12 - 2, x = cx - w / 2, y = cy + R + 14;
        texto(b, 'KVOTHES', x, y, { esc: 2, color: '#ffffff', sombra: null });
        texto(b, 'SON', x + 7 * 12, y, { esc: 2, color: '#66e0ff', sombra: null });
        texto(b, t('presenta'), cx, y + 22, { alinear: 'centro', color: '#9890b8', sombra: null });
        b.globalAlpha = 1;
      }
    } else dibujarCinematica(b, BW, BH, tt);
    // saltear, siempre a mano
    if (!LIMPIO) texto(b, t('saltear'), BW - 6, 6, { alinear: 'der', color: 'rgba(232,228,255,.7)', sombra: null });
  }

  // Sala online: código grande, botón para copiar o compartir el link y quién falta.
  let copiado = 0;
  function esperaSala(r, extra) {
    const y0 = franja(170, r.rankeada ? '#2f8f6a' : '#4a4a9a');
    if (r.rankeada) {
      // buscando rival: el globo gira y titila el trofeo
      icono(b, 'globo', BW / 2 - 18, y0 + 14, 4);
      icono(b, 'trofeo', BW / 2 + 26, y0 + 26, 2);
      const t = (Date.now() / 140 | 0) % 8;
      for (let k = 0; k < 8; k++) { b.fillStyle = k === t ? '#fff4b0' : '#3a6a5a'; b.fillRect(BW / 2 - 30 + k * 8, y0 + 70, 5, 5); }
      if (extra.yo) texto(b, extra.yo.nombre, BW / 2, y0 + 90, { alinear: 'centro', color: '#c8f4ff' });
    } else {
      icono(b, 'globo', BW / 2 - 18, y0 + 8, 4);
      texto(b, r.codigo || '', BW / 2, y0 + 50, { esc: 4, alinear: 'centro', color: '#fff4b0', sombra: P.contorno });
      boton('copiar', BW / 2 - 34, y0 + 86, 68, 26, { cuerpo: '#4a4a9a', lado: '#2a2a62' }, (x, y) => {
        icono(b, copiado > 0 ? 'tilde' : 'copiar', x + 25, y + 4, 2);
      });
    }
    if (copiado > 0) copiado--;
    // dos lugares: el tuyo y el que falta
    const t = Date.now() / 300;
    [0, 1].forEach((i) => {
      const x = BW / 2 + (i ? 40 : -40), y = y0 + 140, ocupado = r.jugadores > i || r.lado === i;
      b.fillStyle = P.contorno; b.fillRect(x - 22, y - 16, 44, 32);
      b.fillStyle = '#2a2448'; b.fillRect(x - 21, y - 15, 42, 30);
      if (ocupado) autoChico(i, x, y, ANGULOS * 3 / 4);
      else for (let k = 0; k < 3; k++) { b.fillStyle = (Math.floor(t) % 3) === k ? '#fff' : '#5a5480'; b.fillRect(x - 6 + k * 5, y, 3, 3); }
      if (r.lado === i) { b.fillStyle = COLOR_AUTO[i].techo; b.fillRect(x - 3, y - 22, 7, 2); b.fillRect(x - 2, y - 20, 5, 1); b.fillRect(x - 1, y - 19, 3, 1); }
    });
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, y) => icono(b, 'casa', x + 7, y + 5));
  }

  function caido() {
    const y0 = franja(70, '#e43a3a');
    icono(b, 'globo', BW / 2 - 18, y0 + 16, 4);
    icono(b, 'cruz', BW / 2 - 18, y0 + 16, 4);
    boton('menu', BW / 2 - 16, y0 + 80, 32, 22, GRIS, (x, y) => icono(b, 'casa', x + 11, y + 6));
  }

  // En online, una flechita arriba de tu auto para saber cuál sos.
  function marcarPropio(s, lado) {
    const c = s.autos[lado]; if (!c) return;
    const x = Math.round(bx(c.x)), y = Math.round(by(c.y)) - 18 - (((s.cuadro >> 4) & 1));
    b.fillStyle = P.contorno; b.fillRect(x - 4, y - 1, 9, 5);
    b.fillStyle = COLOR_AUTO[lado].techo; b.fillRect(x - 3, y, 7, 1); b.fillRect(x - 2, y + 1, 5, 1); b.fillRect(x - 1, y + 2, 3, 1);
  }

  function limpiarMarcas() { mctx.clearRect(0, 0, WW, WH); }

  // Cámara: el centro (cx, cy) es tu auto en el mundo y el ángulo hace que mire para arriba.
  // En el menú no gira y sigue despacio a la Luz Mala.
  const cam = { x: 0, y: 0, cx: WW / 2, cy: WH / 2, ang: 0, ancla: BH / 2 };
  function moverCamara(s, extra) {
    const c = extra.seguir >= 0 ? s.autos[extra.seguir] : null;
    let tx, ty, angObj = cam.ang, suave = 0.25, ancla = anclaY();
    if (extra.pantalla === 'menu' || !c) { tx = bx(s.pelota.x); ty = by(s.pelota.y); angObj = 0; suave = 0.04; ancla = BH / 2; }
    else if (extra.camara === 'cancha') {
      // la cancha entera y quieta; acostada si la pantalla es ancha
      tx = bx(W / 2); ty = by(H / 2); angObj = BW > BH ? -Math.PI / 2 : 0; suave = 1; ancla = BH / 2;
    } else {
      tx = bx(c.x); ty = by(c.y);
      // cámara a la pelota (ball cam de Rocket League): "arriba" es hacia la Luz Mala;
      // si no, "arriba" es hacia donde apunta tu auto
      const pdx = s.pelota.x - c.x, pdy = s.pelota.y - c.y;
      if (extra.camara !== 'auto' && Math.hypot(pdx, pdy) > 30) angObj = -(Math.atan2(pdy, pdx) * 180 / Math.PI + 90) * Math.PI / 180;
      else if (!c.aplastado) angObj = -(c.rot + 90) * Math.PI / 180;
      if (c.aplastado) suave = 0.05;
      // como la "rigidez" de Rocket League: cuanto más rápido, más abajo el auto y más se ve adelante
      ancla = anclaY() + Math.min(1, Math.abs(c.vel || 0) / 9) * BH * 0.1;
    }
    if (s.fase === 'cuenta' && s.reloj > 150) suave = 0.6;      // al reubicar, la cámara salta rápido
    cam.cx += (tx - cam.cx) * suave; cam.cy += (ty - cam.cy) * suave;
    let d = angObj - cam.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.ang += d * (suave > 0.5 ? 1 : 0.14);
    cam.ancla += (ancla - cam.ancla) * 0.1;
    cam.x = Math.round(cam.cx - VW / 2); cam.y = Math.round(cam.cy - VW / 2);
  }
  // Referencia en el borde de la pantalla cuando la Luz Mala queda afuera.
  // (De qué lado estás lo dice el piso: cada mitad tiene el color de quien la defiende.)
  function alBorde(px, py, m, arriba) {
    const cx = BW / 2, cy = cam.ancla, dx = px - cx, dy = py - cy;
    if (px >= m && px <= BW - m && py >= arriba && py <= BH - m) return null;
    const tx = dx > 0 ? (BW - m - cx) / dx : dx < 0 ? (m - cx) / dx : Infinity;
    const ty = dy > 0 ? (BH - m - cy) / dy : dy < 0 ? (arriba - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    return { x: cx + dx * t, y: cy + dy * t, ang: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) };
  }
  function flechita(x, y, ang, col, largo = 5) {
    b.fillStyle = col;
    for (let k = 0; k < largo; k++) {
      const ax = x + Math.cos(ang) * k, ay = y + Math.sin(ang) * k, ancho = largo - k;
      for (let j = -ancho; j <= ancho; j++) b.fillRect(Math.round(ax - Math.sin(ang) * j * 0.5), Math.round(ay + Math.cos(ang) * j * 0.5), 1, 1);
    }
  }
  function indicadores(s, seguir) {
    if (seguir < 0 || !s.autos[seguir]) return;
    const pb = aPantalla(bx(s.pelota.x), by(s.pelota.y));
    const eb = alBorde(pb.x, pb.y, 12, 30);
    if (eb) {
      const late = 0.75 + 0.25 * Math.sin(s.cuadro * (0.12 + 0.25 * Math.max(0, 1 - eb.dist / 600)));
      b.globalAlpha = late;
      b.drawImage(pelotas[(s.cuadro >> 2) & 7], Math.round(eb.x - 6), Math.round(eb.y - 6));
      flechita(eb.x + Math.cos(eb.ang) * 8, eb.y + Math.sin(eb.ang) * 8, eb.ang, '#b4ffd0', 5);
      b.globalAlpha = 1;
    }
  }

  // Un punto del mundo (en píxeles del buffer) a la pantalla girada.
  function aPantalla(wx, wy) {
    const dx = wx - cam.cx, dy = wy - cam.cy, co = Math.cos(cam.ang), si = Math.sin(cam.ang);
    return { x: BW / 2 + dx * co - dy * si, y: cam.ancla + dx * si + dy * co };
  }

  function dibujar(s, extra = {}) {
    nombresAhora = (extra.red && extra.red.nombres) || extra.nombres || [null, null];
    zonas.length = 0;
    if (festejo > 0) festejo--;
    enCancha = extra.camara === 'cancha' && extra.pantalla !== 'menu' && extra.seguir >= 0;
    // con la cancha entera se ve más mundo: el cuadrado crece hasta tapar toda la pantalla
    tamMundo(enCancha ? Math.ceil(Math.max(BW, BH) / zCancha() + 80) : 780);
    moverCamara(s, extra);
    // 1) el mundo, alrededor de la cámara, en el cuadrado grande
    b = g;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = '#141018'; b.fillRect(0, 0, VW, VW);
    b.save();
    b.translate(-cam.x, -cam.y);
    b.drawImage(fondo, 0, 0);
    publico(s);
    b.drawImage(marcas, 0, 0);
    pastillas(s);
    if (hombres.length) hombresTanque(s, false);
    // ordenar por y para que lo de adelante tape a lo de atrás (tres cuartos)
    const cosas = [...s.autos.map((c, i) => ({ y: c.y, f: () => auto(c, i) })), { y: s.pelota.y, f: () => pelota(s.pelota) },
      ...(s.camion && s.camion.estado === 'pasa' ? [{ y: s.camion.y, f: () => camion(s) }] : [])];
    cosas.sort((a, z) => a.y - z.y).forEach((o) => o.f());
    if (cancha.noche) {
      noche(s);
      if (cancha.pixelesMuertos) pixelesMuertos(s);     // negro puro: ni la luz los alcanza
      if (cancha.nitro === 'aceite') aceiteBrillo(s);   // el aceite brilla en la oscuridad
      pelota(s.pelota);                                  // la Luz Mala no se apaga con la noche
      if (hombres.length) hombresTanque(s, true);         // los ojos brillan en lo oscuro
    }
    efectos(s);
    const r = extra.red;
    b.restore();
    // 2) el mundo girado en la pantalla, con tu auto en el ancla mirando arriba
    b = vista;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = '#141018'; b.fillRect(0, 0, BW, BH);
    b.save();
    // cancha entera: el mundo se pega achicado directo en la pantalla grande (aPantallaFinal), no acá
    if (enCancha) b.clearRect(0, 0, BW, BH);
    else {
      b.translate(BW / 2, Math.round(cam.ancla)); b.rotate(cam.ang);
      b.drawImage(gran, Math.round(cam.x - cam.cx), Math.round(cam.y - cam.cy));
    }
    b.restore();
    // tu auto, derecho (el del mundo quedó girado y con escalones; este lo tapa)
    const propio = extra.seguir >= 0 && extra.pantalla !== 'menu' ? s.autos[extra.seguir] : null;
    if (propio && !propio.aplastado && !enCancha) {
      const alto = propio.salto > 0 ? Math.sin(Math.PI * (1 - propio.salto / 22)) * 7 : 0;
      const p = aPantalla(bx(propio.x), by(propio.y));
      const enPantalla = ((propio.rot + cam.ang * 180 / Math.PI) % 360 + 360) % 360;   // con cámara a la pelota, tu auto puede girar en pantalla
      const k = Math.round(enPantalla / 360 * ANGULOS) % ANGULOS;
      b.drawImage(spritesDe(extra.seguir)[k], Math.round(p.x - TAM / 2), Math.round(p.y - TAM / 2 - alto));
    }
    // ?limpio: sin marcador ni botones (para la tarjeta del link y el tráiler)
    const limpio = LIMPIO;
    if (!limpio && extra.pantalla !== 'intro') hud(s);
    const enJuego = !limpio && (extra.pantalla === 'bot' || extra.pantalla === 'online');
    if (enJuego) {
      if (!enCancha) { if (s.fase !== 'fin') indicadores(s, extra.seguir); radar(s, extra.seguir); }
      avisoCamion(s);
      // botón de cámara, abajo del radar: muestra la cámara puesta (pelota, auto o cancha) y pasa a la siguiente
      const cw = extra.tactil ? 38 : 34, ch = extra.tactil ? 22 : 16;
      const col = extra.camara === 'pelota' ? { cuerpo: '#2f8f6a', lado: '#1c5a42' } : extra.camara === 'cancha' ? { cuerpo: '#4a4a9a', lado: '#2a2a62' } : GRIS;
      boton('camara', BW - cw - 4, 74, cw, ch, col, (x, y) => {
        const ix = x + (extra.tactil ? (cw - 13) / 2 : 3), iy = y + (ch - 13) / 2;
        if (extra.camara === 'pelota') b.drawImage(pelotas[0], ix, iy);
        else if (extra.camara === 'auto') b.drawImage(spritesDe(Math.max(0, extra.seguir))[ANGULOS / 4 * 3 % ANGULOS], Math.round(ix + 6.5 - TAM / 2), Math.round(iy + 6.5 - TAM / 2));
        else iconoCancha(ix, iy);
        if (!extra.tactil) tecla(b, 'B', x + 18, y + 1);
      });
    }
    if (extra.pantalla === 'intro') intro(s, extra.intro || {});
    else if (extra.pantalla === 'menu') portada(s, extra);
    else if (extra.pantalla === 'ranking') pantallaRanking(extra);
    else if (extra.pantalla === 'nombre') pantallaNombre();
    else if (r && r.caido) caido();
    else if (r && (!r.listo || r.jugadores < 2) && r.lado >= 0) esperaSala(r, extra);
    else {
      if (extra.confirmarSalida) cartelSalida(extra);
      else if (s.fase === 'cuenta') {
        const n = Math.ceil(s.reloj / FPS);
        // primera cuenta de un partido contra un corredor (rankeada o práctica): su placa ocupa la pantalla
        // hasta que falta menos de un segundo
        const ladoRival = r ? (r.rankeada && r.lado >= 0 ? 1 - r.lado : -1) : extra.pantalla === 'bot' ? 1 : -1;
        const rival = ladoRival < 0 ? null : AUTOS_FORZADOS[ladoRival] || nombresAhora[ladoRival];
        if (rival && CORREDORES[rival] && s.tiempoJuego === 0 && s.autos[0].goles + s.autos[1].goles === 0 && s.reloj > 0.8 * FPS) {
          placaCorredor(b, BW, BH, 3 - s.reloj / FPS, rival, { col: COLOR_AUTO[ladoRival], arriba: t('tuRival'), cuenta: n, detalle: true });
          return aPantallaFinal();
        }
        texto(b, n, BW / 2, BH / 2 - 22, { esc: 6, alinear: 'centro', color: '#fff4b0', sombra: P.contorno });
      } else if (s.fase === 'gol' && s.ganador < 0) cartelGol(s);
      else if (s.fase === 'gol' || s.fase === 'fin') cartelFinal(s, extra);
      // en el celu, botón para salir arriba a la izquierda (no hay pausa)
      if (extra.tactil) boton('menu', 4, 3, 30, 24, GRIS, (x, y) => icono(b, 'casa', x + 6, y + 3, 2));
    }
    aPantallaFinal();
  }
  // una canchita de 13×13 para el botón de cámara
  function iconoCancha(x, y) {
    b.fillStyle = P.contorno; b.fillRect(x + 1, y, 11, 13);
    b.fillStyle = rgb(P.pasto1); b.fillRect(x + 2, y + 1, 9, 11);
    b.fillStyle = rgb(P.linea); b.fillRect(x + 2, y + 6, 9, 1); b.fillRect(x + 5, y + 1, 3, 1); b.fillRect(x + 5, y + 11, 3, 1);
  }
  // Cancha entera: el mundo achicado para que entre debajo del marcador, entre las barras de nitro.
  // Se pega en la pantalla grande (no en el buffer chico) así el achique no se come las líneas.
  let enCancha = false;
  const CANCHA_ANCHO = (CAMPO.R - CAMPO.L) * K + 24, CANCHA_LARGO = (CAMPO.B - CAMPO.T + 2 * CAMPO.arcoFondo) * K + 16;
  const ARRIBA = 32, COSTADO = 14;
  function zCancha() {
    const aw = BW - COSTADO * 2, ah = BH - ARRIBA - 6;
    return BW > BH ? Math.min(aw / CANCHA_LARGO, ah / CANCHA_ANCHO) : Math.min(aw / CANCHA_ANCHO, ah / CANCHA_LARGO);
  }
  function tamMundo(n) {
    if (n === VW) return;
    VW = n; gran.width = gran.height = n; oscuro.width = oscuro.height = n;
  }
  function canchaEntera(k, tx, ty) {
    const arriba = ARRIBA, ah = BH - ARRIBA - 6, z = zCancha();
    ctx.save();
    ctx.translate((BW / 2 + tx) * k, (arriba + ah / 2 + ty) * k);
    ctx.rotate(cam.ang); ctx.scale(z * k, z * k);
    ctx.drawImage(gran, Math.round(cam.x - cam.cx), Math.round(cam.y - cam.cy));
    ctx.restore();
  }
  // a pantalla, escala entera y sin suavizado; temblor de cámara en golpes y goles
  function aPantallaFinal() {
    const k = canvas.width / BW;
    const tx = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0, ty = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0;
    if (temblor > 0) temblor--;
    ctx.fillStyle = P.noche; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    if (enCancha) canchaEntera(k, tx, ty);
    ctx.drawImage(buf, tx * k, ty * k, BW * k, BH * k);
  }

  return { dibujar, limpiarMarcas, botonEn, anguloCamara: () => cam.ang * 180 / Math.PI, avisarCopiado: () => { copiado = 90; } };
}

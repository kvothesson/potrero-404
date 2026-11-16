// Pintor en pixel art con aspecto de Super Nintendo: todo se dibuja en un buffer chico
// (272x400) con paleta limitada, contornos de 1 píxel y vista de tres cuartos, y después
// se agranda a escala entera sin suavizado. Solo lee el estado; nunca lo cambia.
import { t } from './idioma.js';
import { W, H, CAMPO, AUTOS, GOLES_PARA_GANAR, FPS, paredes } from './sim.js';
import { texto, icono, tecla } from './fuente.js';
import { CANCHAS, hash } from './canchas.js';
// Sin palabras en pantalla: todo se dice con colores, números, íconos y teclas dibujadas,
// para que se entienda en cualquier idioma.

// BW×BH es lo que se ve en pantalla. El mundo (WW×WH) es más grande: la cancha más el
// escenario de los costados, y la cámara sigue a tu auto.
const BW = 272, BH = 400, K = 0.5;
// La cámara gira (como el Mode 7 de la Super Nintendo): el mundo se dibuja en un cuadrado VW×VW
// centrado en tu auto y después se pega girado en la pantalla, con tu auto siempre mirando arriba.
const VW = 580, ANCLA_Y = Math.round(BH * 0.64);
const OX = 70, OY = 60;                                     // margen de escenario alrededor de la cancha
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

// ---------- sprites de autos: 32 ángulos, rasterizados píxel por píxel ----------
const ANGULOS = 32, TAM = 34;
function hexA(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

function spritesAuto(col) {
  const out = [];
  const c = { cuerpo: hexA(col.cuerpo), lado: hexA(col.lado), techo: hexA(col.techo), oscuro: hexA(col.oscuro) };
  const vidrio = [168, 224, 255], vidrioOsc = [70, 110, 150], faro = [255, 244, 160], cola = [255, 60, 60], franja = [244, 244, 244];
  const goma = [26, 26, 30], llanta = [120, 120, 130], borde = hexA(P.contorno);
  for (let k = 0; k < ANGULOS; k++) {
    const ang = k / ANGULOS * Math.PI * 2, co = Math.cos(ang), si = Math.sin(ang);
    const cv = document.createElement('canvas'); cv.width = TAM; cv.height = TAM;
    const g = cv.getContext('2d'), img = g.createImageData(TAM, TAM), d = img.data;
    const pon = (x, y, col) => { if (x < 0 || y < 0 || x >= TAM || y >= TAM) return; const i = (y * TAM + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
    const hay = (x, y) => x >= 0 && y >= 0 && x < TAM && y < TAM && d[(y * TAM + x) * 4 + 3] > 0;
    const loc = (x, y) => { const dx = x + 0.5 - TAM / 2, dy = y + 0.5 - TAM / 2; return [dx * co + dy * si, -dx * si + dy * co]; };
    const L = 11, A = 5.6, ALTO = 3;
    // 1) costado y ruedas: la planta del auto corrida hacia abajo (se ve el lateral)
    for (let h = ALTO; h >= 1; h--) for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
      const [lx, ly] = loc(x, y - h);
      const rueda = Math.abs(lx) > 4.5 && Math.abs(lx) < 8.8 && Math.abs(ly) < A + 1.2;
      if (rueda && h >= 2) pon(x, y, Math.abs(Math.abs(lx) - 6.6) < 0.8 && h === 2 ? llanta : goma);
      else if (Math.abs(lx) < L && Math.abs(ly) < A) pon(x, y, h === ALTO ? c.oscuro : c.lado);
    }
    // 2) techo y capó
    for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
      const [lx, ly] = loc(x, y);
      if (Math.abs(lx) >= L || Math.abs(ly) >= A) continue;
      let col = c.cuerpo;
      if (lx > 2 && lx <= 5 && Math.abs(ly) < 4.2) col = vidrio;
      else if (lx >= -5 && lx <= 2 && Math.abs(ly) < 4.2) col = c.techo;
      else if (lx >= -8 && lx < -5 && Math.abs(ly) < 3.8) col = vidrioOsc;
      else if (lx > 9.3 && Math.abs(ly) > 2.4) col = faro;
      else if (lx < -9.8 && Math.abs(ly) > 2.4) col = cola;
      else if (Math.abs(ly) < 1.1) col = franja;
      // luz de arriba a la izquierda: el borde de abajo del sprite un poco más oscuro
      if (col === c.cuerpo && (-si * 0 + ly * 0) === 0) {
        const [, ly2] = loc(x, y + 1);
        if (Math.abs(ly2) >= A || Math.abs(loc(x, y + 1)[0]) >= L) col = c.lado;
      }
      pon(x, y, col);
    }
    // 3) contorno oscuro de 1 píxel
    const borrador = [];
    for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
      if (hay(x, y)) continue;
      if (hay(x + 1, y) || hay(x - 1, y) || hay(x, y + 1) || hay(x, y - 1)) borrador.push([x, y]);
    }
    borrador.forEach(([x, y]) => pon(x, y, borde));
    g.putImageData(img, 0, 0);
    out.push(cv);
  }
  return out;
}

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
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) M[y * WW + x] = adentro(x + 0.5, y + 0.5) ? 1 : 0;
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
  const info = { BW: WW, BH: WH, OY, cx: Math.round(cx), ruta0: Math.round(bx(CAMPO.L)), ruta1: Math.round(bx(CAMPO.R)) };

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
  const autos = COLOR_AUTO.map(spritesAuto);
  const pelotas = cancha.pelota === 'luzMala' ? spritesLuzMala() : spritesPelota();
  const oscuro = document.createElement('canvas'); oscuro.width = VW; oscuro.height = VW;
  const octx = oscuro.getContext('2d');
  const marcas = document.createElement('canvas'); marcas.width = WW; marcas.height = WH;
  const mctx = marcas.getContext('2d');
  const chispas = [], fantasmas = [];
  let festejo = 0, quienFesteja = -1, temblor = 0;

  function ajustar() {
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
  function noche(s) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, VW, VW);
    octx.fillStyle = 'rgba(6,8,22,.6)'; octx.fillRect(0, 0, VW, VW);
    octx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
    octx.globalCompositeOperation = 'destination-out';
    const aro = (x, y, r, a) => { octx.fillStyle = `rgba(0,0,0,${a})`; octx.beginPath(); octx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); octx.fill(); };
    // Luz Mala: tres aros escalonados, que titilan
    const pb = s.pelota, ex = bx(pb.x), ey = by(pb.y), tit = 1 + 0.08 * Math.sin(s.cuadro / 3) + (hash(s.cuadro, 1) < 0.05 ? -0.2 : 0);
    aro(ex, ey, 44 * tit, 0.3); aro(ex, ey, 30 * tit, 0.4); aro(ex, ey, 17 * tit, 0.6);
    // el camión trae dos faros enormes
    const k = s.camion;
    if (k && k.estado === 'pasa') {
      const x = bx(k.x), y = by(k.y), d = k.dir;
      aro(x, y, 30, 0.3);
      for (const [largo, ancho, a] of [[120, 50, 0.35], [80, 30, 0.45]]) {
        octx.fillStyle = `rgba(0,0,0,${a})`;
        octx.beginPath(); octx.moveTo(x - 12, y + d * 36); octx.lineTo(x - ancho, y + d * (36 + largo)); octx.lineTo(x + ancho, y + d * (36 + largo)); octx.lineTo(x + 12, y + d * 36); octx.closePath(); octx.fill();
      }
    }
    for (const c of s.autos) {
      if (c.aplastado) continue;
      const x = bx(c.x), y = by(c.y), co = Math.cos(c.rot * Math.PI / 180), si = Math.sin(c.rot * Math.PI / 180);
      aro(x, y, 14, 0.35);
      // faros: un cono hacia adelante en dos escalones
      for (const [largo, ancho, a] of [[46, 18, 0.35], [30, 11, 0.4]]) {
        octx.fillStyle = `rgba(0,0,0,${a})`;
        octx.beginPath();
        octx.moveTo(x + co * 9 - si * 4, y + si * 9 + co * 4);
        octx.lineTo(x + co * largo - si * ancho, y + si * largo + co * ancho);
        octx.lineTo(x + co * largo + si * ancho, y + si * largo - co * ancho);
        octx.lineTo(x + co * 9 + si * 4, y + si * 9 - co * 4);
        octx.closePath(); octx.fill();
      }
      if (c.nitroActivo) aro(x - co * 14, y - si * 14, 10, 0.5);
    }
    for (const p of s.pastillas) if (p.activa) aro(bx(p.x), by(p.y), p.poder > 50 ? 16 : 9, p.poder > 50 ? 0.35 : 0.25);
    b.drawImage(oscuro, cam.x, cam.y);
    // brillo verde de la Luz Mala sobre lo que ilumina
    b.globalCompositeOperation = 'lighter';
    b.fillStyle = 'rgba(40,110,70,.25)'; b.beginPath(); b.arc(Math.round(ex), Math.round(ey), Math.round(18 * tit), 0, Math.PI * 2); b.fill();
    b.fillStyle = 'rgba(60,160,110,.3)'; b.beginPath(); b.arc(Math.round(ex), Math.round(ey), 9, 0, Math.PI * 2); b.fill();
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
    const sp = autos[i][k];
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
    // marcador arriba, sobre las gradas
    marcador(s, BW / 2, 2);
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

  function autoChico(i, x, y, rotK = 0) { b.drawImage(autos[i][rotK], Math.round(x - TAM / 2), Math.round(y - TAM / 2)); }

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
    boton('otra', BW / 2 - 30, y0 + 86, 60, 22, COLOR_AUTO[i], (x, y) => {
      if (!extra.tactil) tecla(b, '⏎', x + 8, y + 4, 21);
      icono(b, extra.rankeada ? 'globo' : 'otra', extra.tactil ? x + 21 : x + 36, y + 6, extra.tactil ? 2 : 1);
    });
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
    icono(b, 'trofeo', BW / 2 - 18, 8, 4);
    const d = extra.ranking;
    if (!d) { const t = (Date.now() / 140 | 0) % 8; for (let k = 0; k < 8; k++) { b.fillStyle = k === t ? '#fff4b0' : '#3a3456'; b.fillRect(BW / 2 - 30 + k * 8, 120, 5, 5); } }
    else if (d.error) { icono(b, 'globo', BW / 2 - 18, 110, 4); icono(b, 'cruz', BW / 2 - 18, 110, 4); }
    else {
      const filas = d.lista.slice(0, 14);
      const fila = (f, y) => {
        if (f.yo) { b.fillStyle = '#3a6a5a'; b.fillRect(8, y - 3, BW - 16, 13); }
        texto(b, f.puesto, 30, y, { alinear: 'der', color: f.puesto <= 3 ? '#ffd040' : '#9890c0' });
        if (f.ia) icono(b, 'robot', 36, y - 1);
        texto(b, f.nombre, f.ia ? 48 : 38, y, { color: f.yo ? '#ffffff' : '#e8e4ff' });
        texto(b, f.elo, BW - 56, y, { alinear: 'der', color: '#fff4b0' });
        icono(b, 'trofeo', BW - 52, y - 1);
        texto(b, `${f.victorias}/${f.partidas}`, BW - 12, y, { alinear: 'der', color: '#9890c0' });
      };
      filas.forEach((f, k) => fila(f, 52 + k * 15));
      if (d.propio) { b.fillStyle = '#5a5480'; b.fillRect(20, 52 + 14 * 15 + 2, BW - 40, 1); fila(d.propio, 52 + 15 * 15); }
    }
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, yy) => icono(b, 'casa', x + 7, yy + 5));
  }

  // Quién sos: el panel de cuenta es HTML (src/cuenta.js), encima del canvas; acá solo el fondo.
  function pantallaNombre() {
    b.fillStyle = 'rgba(20,15,34,.9)'; b.fillRect(0, 0, BW, BH);
    autoChico(0, BW / 2, 60, ANGULOS * 3 / 4);
    boton('menu', 8, BH - 28, 24, 20, GRIS, (x, y) => icono(b, 'casa', x + 7, y + 5));
  }

  function cartelPausa(extra) {
    const y0 = franja(78, '#9890b8');
    icono(b, 'pausa', BW / 2 - 9, y0 + 6, 2);
    const fila = [['pausa', 'sigue', 'ESC', 21], ['otra', 'otra', 'R', 13], ['menu', 'casa', 'Q', 13]];
    fila.forEach(([id, ic, etq, ancho], k) => {
      boton(id, BW / 2 - 102 + k * 70, y0 + 34, 64, 30, GRIS, (x, y) => {
        if (!extra.tactil) { tecla(b, etq, x + 6, y + 8, ancho); icono(b, ic, x + 12 + ancho, y + 10); }
        else icono(b, ic, x + 23, y + 6, 2);
      });
    });
  }

  function portada(s, extra) {
    b.fillStyle = 'rgba(20,15,34,.86)'; b.fillRect(0, 0, BW, BH);
    const ancho = BW > BH;   // pantalla horizontal: modos a la izquierda, controles a la derecha

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
    const ty = 30;
    texto(b, 'POTRERO 404', BW / 2 + 2, ty + 2, { esc: 4, alinear: 'centro', color: '#ffb030', sombra: '#7a2a10' });
    texto(b, 'POTRERO 404', BW / 2, ty, { esc: 4, alinear: 'centro', color: '#fff4b0', sombra: null });
    const x404 = BW / 2 - (11 * 24 - 4) / 2 + 8 * 24;
    if ((s.cuadro % 150) < 10) {
      texto(b, '404', x404 - 3, ty, { esc: 4, color: 'rgba(255,40,90,.85)', sombra: null });
      texto(b, '404', x404 + 3, ty + 1, { esc: 4, color: 'rgba(40,220,255,.85)', sombra: null });
      texto(b, '404', x404, ty, { esc: 4, color: '#fff4b0', sombra: null });
    }

    // columnas: en vertical todo apilado; en horizontal, dos columnas
    const m = 12;
    const colA = ancho ? { x: m, w: Math.round(BW / 2) - m - 6, y: 70 } : { x: m, w: BW - 2 * m, y: 72 };
    const colB = ancho ? { x: Math.round(BW / 2) + 6, w: Math.round(BW / 2) - m - 6, y: 70 } : null;

    // los tres modos, con nombre y qué es cada uno
    const modos = [
      ['bot', GRIS, t('practica'), t('practicaSub')],
      ['online', { cuerpo: '#2f8f6a', lado: '#1c5a42' }, t('online'), t('onlineSub')],
      ['amigo', { cuerpo: '#4a4a9a', lado: '#2a2a62' }, t('amigo'), t('amigoSub')],
    ];
    const alto = 36, sep = 7;
    modos.forEach(([id, col, titulo, sub], k) => {
      const y = colA.y + k * (alto + sep);
      boton(id, colA.x, y, colA.w, alto, col, (x, yy) => {
        texto(b, titulo, x + 8, yy + 6, { esc: 2, color: '#fff' });
        texto(b, sub, x + 8, yy + 24, { color: '#e0dcf6', sombra: null });
        if (!extra.tactil) tecla(b, String(k + 1), x + colA.w - 18, yy + 6);
      });
    });
    let y = colA.y + 3 * (alto + sep) + 2;

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
      fila(yc + 78, 'salto', t('salto'), [['E', 13], ['⏎', 21]]);
      yc += 106;
    }
    if (!colB) y = yc; else y = Math.max(y, yc);

    // se gana con 3 goles
    const gy = colB ? yc + 2 : y + 2;
    const gx = colB ? cx + cw / 2 : BW / 2;
    texto(b, t('gana'), gx, gy, { alinear: 'centro', color: '#fff4b0' });
    for (let k = 0; k < GOLES_PARA_GANAR; k++) b.drawImage(pelotas[(k * 3 + (s.cuadro >> 3)) & 7], gx - 30 + k * 16, gy + 11);
    icono(b, 'flecha', gx + 18, gy + 13); icono(b, 'trofeo', gx + 30, gy + 11, 2);

    // ranking, sonido y pausa abajo
    const rw = 22 + t('ranking').length * 6;
    boton('ranking', BW / 2 - rw / 2, BH - 26, rw, 18, { cuerpo: '#7a5a20', lado: '#4a3410' }, (x, yy) => {
      icono(b, 'trofeo', x + 5, yy + 3);
      texto(b, t('ranking'), x + 17, yy + 5, { color: '#fff' });
      if (!extra.tactil) tecla(b, '4', x + rw - 6, yy - 9);
    });
    if (!extra.tactil) { tecla(b, 'ESC', 8, BH - 22, 21); icono(b, 'pausa', 32, BH - 20); }
    boton('sonido', BW - 30, BH - 26, 22, 18, GRIS, (x, yy) => { icono(b, 'sonido', x + 7, yy + 4); });
    if (!extra.tactil) tecla(b, 'M', BW - 48, BH - 24);
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
    let tx, ty, angObj = cam.ang, suave = 0.25, ancla = ANCLA_Y;
    if (extra.pantalla === 'menu' || !c) { tx = bx(s.pelota.x); ty = by(s.pelota.y); angObj = 0; suave = 0.04; ancla = BH / 2; }
    else {
      tx = bx(c.x); ty = by(c.y);
      // cámara a la pelota (ball cam de Rocket League): "arriba" es hacia la Luz Mala;
      // si no, "arriba" es hacia donde apunta tu auto
      const pdx = s.pelota.x - c.x, pdy = s.pelota.y - c.y;
      if (extra.camPelota && Math.hypot(pdx, pdy) > 30) angObj = -(Math.atan2(pdy, pdx) * 180 / Math.PI + 90) * Math.PI / 180;
      else if (!c.aplastado) angObj = -(c.rot + 90) * Math.PI / 180;
      if (c.aplastado) suave = 0.05;
      // como la "rigidez" de Rocket League: cuanto más rápido, más abajo el auto y más se ve adelante
      ancla = ANCLA_Y + Math.min(1, Math.abs(c.vel || 0) / 9) * BH * 0.1;
    }
    if (s.fase === 'cuenta' && s.reloj > 150) suave = 0.6;      // al reubicar, la cámara salta rápido
    cam.cx += (tx - cam.cx) * suave; cam.cy += (ty - cam.cy) * suave;
    let d = angObj - cam.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.ang += d * (suave > 0.5 ? 1 : 0.14);
    cam.ancla += (ancla - cam.ancla) * 0.1;
    cam.x = Math.round(cam.cx - VW / 2); cam.y = Math.round(cam.cy - VW / 2);
  }
  // Un punto del mundo (en píxeles del buffer) a la pantalla girada.
  function aPantalla(wx, wy) {
    const dx = wx - cam.cx, dy = wy - cam.cy, co = Math.cos(cam.ang), si = Math.sin(cam.ang);
    return { x: BW / 2 + dx * co - dy * si, y: cam.ancla + dx * si + dy * co };
  }

  function dibujar(s, extra = {}) {
    zonas.length = 0;
    if (festejo > 0) festejo--;
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
    b.translate(BW / 2, Math.round(cam.ancla)); b.rotate(cam.ang);
    b.drawImage(gran, Math.round(cam.x - cam.cx), Math.round(cam.y - cam.cy));
    b.restore();
    // tu auto, derecho (el del mundo quedó girado y con escalones; este lo tapa)
    const propio = extra.seguir >= 0 && extra.pantalla !== 'menu' ? s.autos[extra.seguir] : null;
    if (propio && !propio.aplastado) {
      const alto = propio.salto > 0 ? Math.sin(Math.PI * (1 - propio.salto / 22)) * 7 : 0;
      const p = aPantalla(bx(propio.x), by(propio.y));
      const enPantalla = ((propio.rot + cam.ang * 180 / Math.PI) % 360 + 360) % 360;   // con cámara a la pelota, tu auto puede girar en pantalla
      const k = Math.round(enPantalla / 360 * ANGULOS) % ANGULOS;
      b.drawImage(autos[extra.seguir][k], Math.round(p.x - TAM / 2), Math.round(p.y - TAM / 2 - alto));
    }
    hud(s);
    const enJuego = extra.pantalla === 'bot' || extra.pantalla === 'online';
    if (enJuego) {
      radar(s, extra.seguir); avisoCamion(s);
      // botón de cámara a la pelota, abajo del radar: la Luz Mala prendida o apagada
      boton('camPelota', BW - 38, 74, 34, 16, extra.camPelota ? { cuerpo: '#2f8f6a', lado: '#1c5a42' } : GRIS, (x, y) => {
        b.globalAlpha = extra.camPelota ? 1 : 0.4; b.drawImage(pelotas[0], x + 3, y + 1); b.globalAlpha = 1;
        if (!extra.tactil) tecla(b, 'B', x + 18, y + 1);
      });
    }
    if (extra.pantalla === 'menu') portada(s, extra);
    else if (extra.pantalla === 'ranking') pantallaRanking(extra);
    else if (extra.pantalla === 'nombre') pantallaNombre();
    else if (r && r.caido) caido();
    else if (r && (!r.listo || r.jugadores < 2) && r.lado >= 0) esperaSala(r, extra);
    else {
      if (extra.pausa) cartelPausa(extra);
      else if (s.fase === 'cuenta') {
        const n = Math.ceil(s.reloj / FPS);
        texto(b, n, BW / 2, BH / 2 - 22, { esc: 6, alinear: 'centro', color: '#fff4b0', sombra: P.contorno });
      } else if (s.fase === 'gol' && s.ganador < 0) cartelGol(s);
      else if (s.fase === 'gol' || s.fase === 'fin') cartelFinal(s, extra);
      // en el celu, botón para pausar (o salir, si es online) arriba a la izquierda
      if (extra.tactil && !extra.pausa) {
        if (r) boton('menu', 4, 2, 22, 16, GRIS, (x, y) => icono(b, 'casa', x + 6, y + 3));
        else boton('pausa', 4, 2, 22, 16, GRIS, (x, y) => icono(b, 'pausa', x + 6, y + 3));
      }
    }
    // a pantalla, escala entera y sin suavizado; temblor de cámara en golpes y goles
    const k = canvas.width / BW;
    const tx = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0, ty = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0;
    if (temblor > 0) temblor--;
    ctx.fillStyle = P.noche; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, tx * k, ty * k, BW * k, BH * k);
  }

  return { dibujar, limpiarMarcas, botonEn, anguloCamara: () => cam.ang * 180 / Math.PI, avisarCopiado: () => { copiado = 90; } };
}

// Pintor en pixel art con aspecto de Super Nintendo: todo se dibuja en un buffer chico
// (272x400) con paleta limitada, contornos de 1 píxel y vista de tres cuartos, y después
// se agranda a escala entera sin suavizado. Solo lee el estado; nunca lo cambia.
import { W, H, CAMPO, AUTOS, GOLES_PARA_GANAR, FPS, paredes } from './sim.js';
import { texto } from './fuente.js';

const BW = 272, BH = 400, OX = 16, OY = 20, K = 0.5;     // buffer y paso de sim a buffer
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

// ---------- pelota: 8 cuadros de rodado ----------
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

// ---------- cancha fija: pasto, líneas, paredes en tres cuartos, gradas ----------
function fondoFijo() {
  const cv = document.createElement('canvas'); cv.width = BW; cv.height = BH;
  const g = cv.getContext('2d'), img = g.createImageData(BW, BH), d = img.data;
  const poly = paredes().puntos.map(([x, y]) => [bx(x), by(y)]);
  const adentro = (x, y) => {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };
  const M = new Uint8Array(BW * BH);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) M[y * BW + x] = adentro(x + 0.5, y + 0.5) ? 1 : 0;
  const m = (x, y) => (x < 0 || y < 0 || x >= BW || y >= BH ? 0 : M[y * BW + x]);
  const pon = (x, y, c) => { const i = (y * BW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };

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

  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (m(x, y)) {
      // ¿borde de la pared?
      let tope = false;
      for (let a = -2; a <= 2 && !tope; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) <= 2 && !m(x + a, y + b)) { tope = true; break; }
      if (tope) { pon(x, y, P.paredTope); continue; }
      // cara de la pared de arriba (mira a la cámara)
      let cara = 0;
      for (let k = 3; k <= 6; k++) if (!m(x, y - k)) { cara = k; break; }
      if (cara) { pon(x, y, cara < 5 ? P.paredCara : P.paredCaraOsc); continue; }
      if (cara === 0 && !m(x, y - 7)) { pon(x, y, P.paredSombra); continue; }
      // red de los arcos
      if (py < T || py > B) {
        const hilo = (x % 3 === 0) || (y % 3 === 0);
        pon(x, y, hilo ? P.redHilo : P.red); continue;
      }
      if (linea(px, py)) { pon(x, y, P.linea); continue; }
      // pasto en franjas de 16 px con tramado en el borde
      const fr = Math.floor((y - OY) / 16), dentro = (y - OY) % 16;
      let col = fr % 2 ? P.pasto1 : P.pasto2;
      if (dentro === 0 && (x + y) % 2) col = fr % 2 ? P.pasto2 : P.pasto1;
      if ((x * 7 + y * 13) % 29 === 0) col = P.pasto3;
      pon(x, y, col);
    } else {
      // contorno oscuro pegado a la pared
      if (m(x + 1, y) || m(x - 1, y) || m(x, y + 1) || m(x, y - 1)) { pon(x, y, hexA(P.contorno)); continue; }
      // gradas: escalones de 4 px
      const esc = Math.floor(y / 4) % 2, borde = y % 4 === 3;
      pon(x, y, borde ? P.grada3 : esc ? P.grada1 : P.grada2);
    }
  }
  g.putImageData(img, 0, 0);
  // palos de color
  [[T, COLOR_AUTO[0]], [B, COLOR_AUTO[1]]].forEach(([y, col]) => {
    [g0, g1].forEach((x) => { g.fillStyle = P.contorno; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); g.fillStyle = col.cuerpo; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); });
  });
  return { cv, M };
}

// Público: un puntito con cabeza en cada lugar libre de las gradas.
function armarPublico(M) {
  const gente = [];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let y = 2; y < BH - 4; y += 4) for (let x = 1; x < BW - 2; x += 3) {
    let libre = true;
    for (let a = -2; a <= 3 && libre; a++) for (let b = -2; b <= 4; b++) {
      const xx = x + a, yy = y + b;
      if (xx >= 0 && yy >= 0 && xx < BW && yy < BH && M[yy * BW + xx]) { libre = false; break; }
    }
    if (!libre || azar() < 0.35) continue;
    gente.push({ x: x + (azar() < 0.5 ? 0 : 1), y, ropa: P.publico[(azar() * P.publico.length) | 0], piel: P.piel[(azar() * 3) | 0], fase: azar() * 6.28,
      lado: (y + 2) * K < (H / 2) * K ? 0 : 1 });
  }
  return gente;
}

export function crearPintor(canvas) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
  const b = buf.getContext('2d');
  const { cv: fondo, M } = fondoFijo();
  const gente = armarPublico(M);
  const autos = COLOR_AUTO.map(spritesAuto);
  const pelotas = spritesPelota();
  const marcas = document.createElement('canvas'); marcas.width = BW; marcas.height = BH;
  const mctx = marcas.getContext('2d');
  const chispas = [];
  let festejo = 0, quienFesteja = -1, temblor = 0;

  function ajustar() {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth * dpr / BW, window.innerHeight * dpr / BH)));
    canvas.width = BW * k; canvas.height = BH * k;
    canvas.style.width = `${BW * k / dpr}px`; canvas.style.height = `${BH * k / dpr}px`;
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

  function auto(c, i) {
    const x = bx(c.x), y = by(c.y);
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
        b.fillStyle = n < 2 ? P.nitro[2] : n < 4 ? P.nitro[1] : P.nitro[0];
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
      mctx.fillStyle = 'rgba(16,40,20,.35)';
      [-1, 1].forEach((l) => mctx.fillRect(Math.round(x - co * 6 - si * 5 * l), Math.round(y - si * 6 + co * 5 * l + 2), 1, 1));
      if (Math.random() < 0.4) chispazo(x - co * 9, y - si * 9, 1, '#d8d8d8');
    }
  }

  function pelota(p) {
    const x = Math.round(bx(p.x)), y = Math.round(by(p.y));
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
      if (e.t === 'aterriza') { const c = s.autos[e.quien]; chispazo(bx(c.x), by(c.y) + 2, 6, '#c8c0a8'); }
      if (e.t === 'choque' || e.t === 'choqueAutos') temblor = Math.max(temblor, 3);
    }
    for (let k = chispas.length - 1; k >= 0; k--) {
      const p = chispas[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93;
      if (--p.vida <= 0) { chispas.splice(k, 1); continue; }
      b.fillStyle = p.col; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }

  function hud(s) {
    // marcador arriba, sobre las gradas
    const ancho = 120, x0 = BW / 2 - ancho / 2;
    b.fillStyle = P.contorno; b.fillRect(x0 - 1, 1, ancho + 2, 16);
    b.fillStyle = '#2a2448'; b.fillRect(x0, 2, ancho, 14);
    b.fillStyle = COLOR_AUTO[0].cuerpo; b.fillRect(x0, 2, 40, 14);
    b.fillStyle = COLOR_AUTO[1].cuerpo; b.fillRect(x0 + ancho - 40, 2, 40, 14);
    texto(b, 'AZUL', x0 + 20, 6, { alinear: 'centro' });
    texto(b, 'ROJO', x0 + ancho - 20, 6, { alinear: 'centro' });
    texto(b, `${s.autos[0].goles}-${s.autos[1].goles}`, BW / 2, 5, { alinear: 'centro', color: '#ffe060', esc: 1 });
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

  function cartel(t1, t2, col) {
    b.fillStyle = 'rgba(20,15,34,.75)'; b.fillRect(0, BH / 2 - 30, BW, t2 ? 62 : 46);
    b.fillStyle = col || '#fff'; b.fillRect(0, BH / 2 - 31, BW, 1); b.fillRect(0, BH / 2 + (t2 ? 31 : 15), BW, 1);
    texto(b, t1, BW / 2, BH / 2 - 24, { esc: 4, alinear: 'centro', color: col || '#fff', sombra: P.contorno });
    if (t2) texto(b, t2, BW / 2, BH / 2 + 16, { alinear: 'centro' });
  }

  function portada() {
    b.fillStyle = 'rgba(20,15,34,.82)'; b.fillRect(0, 0, BW, BH);
    texto(b, 'AUTOBOL', BW / 2 + 2, 62, { esc: 6, alinear: 'centro', color: '#ffb030', sombra: '#7a2a10' });
    texto(b, 'AUTOBOL', BW / 2, 60, { esc: 6, alinear: 'centro', color: '#fff4b0', sombra: null });
    texto(b, 'PROG II 2016 · REVIVIDO 2026', BW / 2, 112, { alinear: 'centro', color: '#9890c0' });
    const bloque = (y, i, nom, filas) => {
      b.fillStyle = COLOR_AUTO[i].cuerpo; b.fillRect(BW / 2 - 110, y - 3, 220, 13);
      texto(b, nom, BW / 2, y, { alinear: 'centro' });
      filas.forEach((f, k) => texto(b, f, BW / 2, y + 16 + k * 11, { alinear: 'centro', color: '#e8e4ff' }));
    };
    bloque(140, 0, 'AZUL · MÁS ÁGIL', ['MANEJA: W A S D', 'FRENO DE MANO: SHIFT IZQ O C', 'NITRO: ESPACIO O V', 'SALTO: E O F']);
    bloque(214, 1, 'ROJO · MÁS RÁPIDO', ['MANEJA: FLECHAS', 'FRENO DE MANO: SHIFT DER O .', 'NITRO: CTRL DER O /', 'SALTO: ENTER']);
    texto(b, `GANA EL PRIMERO EN HACER ${GOLES_PARA_GANAR} GOLES`, BW / 2, 300, { alinear: 'centro', color: '#ffb030' });
    if ((Date.now() / 450 | 0) % 2) texto(b, 'APRETÁ ENTER', BW / 2, 330, { esc: 2, alinear: 'centro' });
    texto(b, 'ESC PAUSA · M SONIDO', BW / 2, 372, { alinear: 'centro', color: '#8a84b0' });
  }

  function limpiarMarcas() { mctx.clearRect(0, 0, BW, BH); }

  function dibujar(s, extra = {}) {
    if (festejo > 0) festejo--;
    b.drawImage(fondo, 0, 0);
    publico(s);
    b.drawImage(marcas, 0, 0);
    pastillas(s);
    // ordenar por y para que lo de adelante tape a lo de atrás (tres cuartos)
    const cosas = [...s.autos.map((c, i) => ({ y: c.y, f: () => auto(c, i) })), { y: s.pelota.y, f: () => pelota(s.pelota) }];
    cosas.sort((a, z) => a.y - z.y).forEach((o) => o.f());
    efectos(s);
    hud(s);
    if (extra.portada) portada();
    else if (extra.pausa) cartel('PAUSA', 'ESC SIGUE · R REINICIA');
    else if (s.fase === 'cuenta') {
      const n = Math.ceil(s.reloj / FPS);
      texto(b, n, BW / 2, BH / 2 - 22, { esc: 6, alinear: 'centro', color: '#fff4b0', sombra: P.contorno });
    } else if (s.fase === 'gol' && s.ganador < 0) {
      cartel('¡GOL!', `DEL ${AUTOS[s.ultimoGol].nombre.toUpperCase()}`, COLOR_AUTO[s.ultimoGol].techo);
    } else if (s.fase === 'gol' || s.fase === 'fin') {
      cartel(`GANÓ`, `EL ${AUTOS[s.ganador].nombre.toUpperCase()} · ${s.autos[0].goles} A ${s.autos[1].goles} · ENTER REVANCHA`, COLOR_AUTO[s.ganador].techo);
    }
    // a pantalla, escala entera y sin suavizado; temblor de cámara en golpes y goles
    const k = canvas.width / BW;
    const tx = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0, ty = temblor > 0 ? Math.round((Math.random() - 0.5) * temblor * 0.6) : 0;
    if (temblor > 0) temblor--;
    ctx.fillStyle = P.noche; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, tx * k, ty * k, BW * k, BH * k);
  }

  return { dibujar, limpiarMarcas };
}

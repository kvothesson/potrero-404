// Pintor en pixel art con aspecto de Super Nintendo: todo se dibuja en un buffer chico
// (272x400) con paleta limitada, contornos de 1 píxel y vista de tres cuartos, y después
// se agranda a escala entera sin suavizado. Solo lee el estado; nunca lo cambia.
import { W, H, CAMPO, AUTOS, GOLES_PARA_GANAR, FPS, paredes } from './sim.js';
import { texto, icono, tecla } from './fuente.js';
// Sin palabras en pantalla: todo se dice con colores, números, íconos y teclas dibujadas,
// para que se entienda en cualquier idioma.

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
      icono(b, 'otra', extra.tactil ? x + 21 : x + 36, y + 6, extra.tactil ? 2 : 1);
    });
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
    b.fillStyle = 'rgba(20,15,34,.84)'; b.fillRect(0, 0, BW, BH);
    texto(b, 'AUTOBOL', BW / 2 + 2, 26, { esc: 6, alinear: 'centro', color: '#ffb030', sombra: '#7a2a10' });
    texto(b, 'AUTOBOL', BW / 2, 24, { esc: 6, alinear: 'centro', color: '#fff4b0', sombra: null });
    texto(b, '2016 → 2026', BW / 2, 74, { alinear: 'centro', color: '#9890c0' });

    if (!extra.tactil) {
      // una columna por jugador: auto, teclas de manejo y una fila por acción (ícono → tecla)
      const columna = (i, cx, manejo, freno, nitro, salto) => {
        b.fillStyle = COLOR_AUTO[i].lado; b.fillRect(cx - 62, 90, 124, 168);
        b.fillStyle = COLOR_AUTO[i].cuerpo; b.fillRect(cx - 61, 91, 122, 166);
        b.fillStyle = 'rgba(20,15,34,.55)'; b.fillRect(cx - 58, 124, 116, 130);
        autoChico(i, cx, 108, ANGULOS * 3 / 4);
        tecla(b, manejo[0], cx - 7, 130);
        tecla(b, manejo[1], cx - 23, 146); tecla(b, manejo[2], cx - 7, 146); tecla(b, manejo[3], cx + 9, 146);
        const fila = (y, nombre, etq, ancho) => { icono(b, nombre, cx - 44, y + 2); icono(b, 'flecha', cx - 28, y + 2); tecla(b, etq, cx - 14, y, ancho); };
        fila(172, 'derrape', freno[0], freno[1]);
        fila(198, 'nitro', nitro[0], nitro[1]);
        fila(224, 'salto', salto[0], salto[1]);
      };
      columna(0, BW / 2 - 66, ['W', 'A', 'S', 'D'], ['⇧', 21], ['', 40], ['E', 13]);
      columna(1, BW / 2 + 66, ['↑', '←', '↓', '→'], ['⇧', 21], ['CTRL', 29], ['⏎', 21]);
    } else {
      // en el celu: palanca a la izquierda maneja, botones a la derecha
      b.fillStyle = '#2a2448'; b.fillRect(14, 90, BW - 28, 168);
      icono(b, 'palanca', 40, 120, 4);
      icono(b, 'flecha', 84, 140, 2);
      autoChico(0, 120, 150, 0);
      [['derrape', 112], ['salto', 160], ['nitro', 208]].forEach(([ic, y]) => {
        b.fillStyle = P.contorno; b.beginPath(); b.arc(196, y, 18, 0, Math.PI * 2); b.fill();
        b.fillStyle = '#4a4470'; b.beginPath(); b.arc(196, y, 17, 0, Math.PI * 2); b.fill();
        icono(b, ic, 187, y - 9, 2);
      });
    }

    // se gana con 3 goles: tres pelotas y el trofeo
    for (let k = 0; k < GOLES_PARA_GANAR; k++) b.drawImage(pelotas[(k * 3 + (s.cuadro >> 3)) & 7], BW / 2 - 46 + k * 16, 266);
    icono(b, 'flecha', BW / 2 + 2, 268); icono(b, 'trofeo', BW / 2 + 16, 266, 2);

    // tres modos: dos en un teclado, contra la máquina, online con un link
    const modos = extra.tactil ? [['bot', 0], ['online', 1]] : [['local', 0], ['bot', 1], ['online', 2]];
    const w = 76, sep = 10, total = modos.length * w + (modos.length - 1) * sep;
    modos.forEach(([id], k) => {
      boton(id, BW / 2 - total / 2 + k * (w + sep), 292, w, 52, id === 'online' ? { cuerpo: '#2f8f6a', lado: '#1c5a42' } : GRIS, (x, y) => {
        if (id === 'local') { autoChico(0, x + 22, y + 20, ANGULOS / 2); autoChico(1, x + 54, y + 20, 0); icono(b, 'teclado', x + 30, y + 38); }
        if (id === 'bot') { autoChico(0, x + 22, y + 22, 0); icono(b, 'robot', x + 42, y + 10, 3); }
        if (id === 'online') { icono(b, 'globo', x + 11, y + 8, 4); autoChico(1, x + 60, y + 30, ANGULOS * 3 / 4); }
        if (!extra.tactil) tecla(b, String(k + 1), x + w - 16, y - 7);
      });
    });
    if (!extra.tactil) { tecla(b, 'ESC', 8, BH - 22, 21); icono(b, 'pausa', 32, BH - 20); }
    boton('sonido', BW - 30, BH - 26, 22, 18, GRIS, (x, y) => { icono(b, 'sonido', x + 7, y + 4); });
    if (!extra.tactil) tecla(b, 'M', BW - 48, BH - 24);
  }

  // Sala online: código grande, botón para copiar o compartir el link y quién falta.
  let copiado = 0;
  function esperaSala(r, extra) {
    const y0 = franja(170, '#2f8f6a');
    icono(b, 'globo', BW / 2 - 18, y0 + 8, 4);
    texto(b, r.codigo || '', BW / 2, y0 + 50, { esc: 4, alinear: 'centro', color: '#fff4b0', sombra: P.contorno });
    boton('copiar', BW / 2 - 34, y0 + 86, 68, 26, { cuerpo: '#2f8f6a', lado: '#1c5a42' }, (x, y) => {
      icono(b, copiado > 0 ? 'tilde' : 'copiar', x + 25, y + 4, 2);
    });
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

  function limpiarMarcas() { mctx.clearRect(0, 0, BW, BH); }

  function dibujar(s, extra = {}) {
    zonas.length = 0;
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
    const r = extra.red;
    if (extra.pantalla === 'menu') portada(s, extra);
    else if (r && r.caido) caido();
    else if (r && (!r.listo || r.jugadores < 2) && r.lado >= 0) esperaSala(r, extra);
    else {
      if (r && r.lado >= 0) marcarPropio(s, r.lado);
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

  return { dibujar, limpiarMarcas, botonEn, avisarCopiado: () => { copiado = 90; } };
}

// Canchas: cada una decide los colores del fondo píxel por píxel y qué decorado lleva.
// El fondo se arma por categorías (pared, cara de la pared, red, línea, campo, afuera)
// y cada cancha elige el color de cada una. Para sumar una cancha nueva, agregar otra entrada.

const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- Estadio: la cancha de pasto con tribunas ----------
const estadio = {
  noche: false, publico: 'tribuna', pelota: 'futbol', nitro: 'lata',
  color(cat, x, y, info) {
    switch (cat) {
      case 'tope': return [222, 222, 232];
      case 'cara1': return [150, 150, 176];
      case 'cara2': return [104, 104, 136];
      case 'sombra': return [30, 70, 36];
      case 'red': return [36, 40, 54];
      case 'redHilo': return [200, 204, 214];
      case 'linea': return [240, 240, 228];
      case 'contorno': return [20, 15, 34];
      case 'campo': {
        const fr = Math.floor((y - info.OY) / 16), dentro = (y - info.OY) % 16;
        let col = fr % 2 ? [64, 148, 64] : [52, 126, 54];
        if (dentro === 0 && (x + y) % 2) col = fr % 2 ? [52, 126, 54] : [64, 148, 64];
        if ((x * 7 + y * 13) % 29 === 0) col = [40, 100, 46];
        return col;
      }
      default: {   // gradas
        const esc = Math.floor(y / 4) % 2, borde = y % 4 === 3;
        return borde ? [58, 56, 86] : esc ? [86, 84, 118] : [70, 68, 100];
      }
    }
  },
};

// ---------- Ruta 404: picado de noche en la ruta del campo con píxeles muertos ----------
// Canon: Protocolo Ruta 404 (el campo tiene píxeles muertos; los Hombres-Tanque vagan ahí).
// Expansión: la pelota es una Luz Mala y el nitro es el aceite negro que gotean los Hombres-Tanque.
function grietas(BW, BH) {
  const set = new Set();
  for (let k = 0; k < 26; k++) {
    let x = Math.floor(hash(k, 1, 3) * BW), y = Math.floor(hash(k, 2, 3) * BH);
    const largo = 6 + Math.floor(hash(k, 3, 3) * 22);
    for (let p = 0; p < largo; p++) {
      set.add(y * BW + x);
      const r = hash(k, p, 9);
      x += r < 0.33 ? -1 : r > 0.66 ? 1 : 0; y += hash(k, p, 11) < 0.5 ? 1 : 0;
      if (hash(k, p, 13) < 0.5) x += hash(k, p, 17) < 0.5 ? 1 : -1;
    }
  }
  return set;
}
let GRIETAS = null;
const ruta404 = {
  noche: true, publico: 'hombresTanque', pelota: 'luzMala', nitro: 'aceite', pixelesMuertos: true,
  color(cat, x, y, info) {
    if (!GRIETAS) GRIETAS = grietas(info.BW, info.BH);
    const h = hash(x, y);
    const asfalto = (osc = 0) => {
      if (GRIETAS.has(y * info.BW + x)) return [24, 24, 30];
      let c = [46 - osc, 46 - osc, 54 - osc];
      // bacheo: parches de asfalto más nuevo
      const px = Math.floor(x / 22), py = Math.floor(y / 30);
      if (hash(px, py, 5) < 0.12) c = [38 - osc, 38 - osc, 44 - osc];
      if (h < 0.07) c = [c[0] + 12, c[1] + 12, c[2] + 12];
      else if (h > 0.96) c = [c[0] - 10, c[1] - 10, c[2] - 10];
      return c;
    };
    const ruta = x >= info.ruta0 && x <= info.ruta1;
    const amarilla = Math.abs(x - info.cx) < 1 && ((y >> 3) % 2 === 0);
    switch (cat) {
      case 'tope': {   // alambrado: postes de quebracho y alambre
        if ((x + y * 3) % 11 === 0 || (x * 3 + y) % 11 === 0) return [92, 66, 42];
        return (x + y) % 2 ? [150, 150, 160] : [70, 70, 78];
      }
      case 'cara1': return [40, 36, 32];
      case 'cara2': return [32, 28, 26];
      case 'sombra': return [30, 30, 36];
      case 'red': return [22, 22, 26];
      case 'redHilo': return [130, 128, 118];
      case 'linea': return h < 0.25 ? asfalto() : h < 0.4 ? [150, 150, 140] : [196, 196, 184];   // pintura gastada
      case 'contorno': return [12, 10, 18];
      case 'campo': return amarilla ? (h < 0.2 ? [140, 110, 40] : [206, 166, 52]) : asfalto();
      default: return afuera(x, y, info, asfalto, amarilla);
    }
  },
  decorar,
};

// Ruido suave (valores en una grilla, mezclados): para manchas grandes de pasto y tierra.
function suave(x, y, paso, s) {
  const gx = Math.floor(x / paso), gy = Math.floor(y / paso), fx = x / paso - gx, fy = y / paso - gy;
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const mezcla = (c, f) => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];

// Afuera de la cancha: la ruta sigue más allá de los arcos, con banquina, zanja y alambrado;
// después la pampa de noche, cada vez más oscura hacia el horizonte.
function afuera(x, y, info, asfalto, amarilla) {
  const h = hash(x, y);
  let c;
  const d = x < info.ruta0 ? info.ruta0 - x : x > info.ruta1 ? x - info.ruta1 : 0;   // distancia a la ruta
  if (d === 0) {
    const borde = Math.min(x - info.ruta0, info.ruta1 - x);
    if (borde === 4 && h > 0.15) c = [150, 150, 140];               // línea blanca del borde, gastada
    else if (amarilla) c = [120, 96, 36];
    else c = asfalto(8);
  } else if (d <= 9) {                                             // banquina de ripio
    c = h < 0.3 ? [70, 66, 58] : h < 0.6 ? [58, 54, 48] : h < 0.9 ? [48, 46, 42] : [86, 80, 70];
  } else if (d <= 15) {                                            // zanja con agua quieta
    c = d === 10 || d === 15 ? [26, 32, 26] : [16, 20, 24];
    if (d > 11 && d < 14 && h > 0.97) c = [70, 90, 110];
  } else {                                                         // pampa
    const n = suave(x, y, 40, 3), m2 = suave(x, y, 11, 4);
    c = n < 0.35 ? [34, 44, 30] : n < 0.6 ? [30, 40, 28] : [38, 46, 30];
    if (m2 > 0.72) c = [44, 52, 32];                               // pasto más alto
    if (n > 0.78 && m2 < 0.4) c = [46, 40, 30];                    // tierra pelada
    if (h < 0.05) c = [56, 66, 38]; else if (h > 0.985) c = [76, 72, 46];
    // surcos de un sembrado lejos de la ruta
    if (d > 120 && suave(x, y, 90, 8) > 0.62 && (x + (y >> 1)) % 6 === 0) c = [26, 34, 24];
  }
  // alambrado paralelo a la ruta: alambre con postes cada 14
  if (d === 26) c = y % 14 < 2 ? [92, 66, 42] : (y % 2 ? [96, 96, 104] : c);
  // hacia el borde del mundo se apaga, para que no se note dónde termina
  const borde = Math.min(x, y, info.BW - 1 - x, info.BH - 1 - y);
  if (borde < 120) c = mezcla(c, 0.35 + 0.65 * (borde / 120));
  return c;
}

// Cosas sueltas al costado de la ruta, dibujadas encima del fondo (vista de arriba, tres cuartos).
function decorar(g, info) {
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const lejos = (x, y) => (x < info.ruta0 ? info.ruta0 - x : x > info.ruta1 ? x - info.ruta1 : 0);
  const usados = [];
  const libre = (x, y, r) => usados.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r);

  // postes de teléfono a la izquierda, con los cables
  const xp = info.ruta0 - 40;
  g.strokeStyle = 'rgba(20,18,26,.9)'; g.lineWidth = 1;
  for (let y = 10; y < info.BH; y += 90) {
    px(xp - 1, y - 1, 3, 3, '#140f22'); px(xp, y, 1, 1, '#6a4a2c');
    px(xp - 4, y - 1, 9, 1, '#3a2a1c');
    usados.push({ x: xp, y, r: 6 });
  }
  for (const dx of [-3, 3]) { px(xp + dx, 0, 1, info.BH, 'rgba(10,10,16,.55)'); }

  // eucaliptos: copas redondas oscuras con sombra, en grupitos
  for (let k = 0; k < 140; k++) {
    const x = Math.floor(hash(k, 1, 31) * info.BW), y = Math.floor(hash(k, 2, 31) * info.BH);
    if (lejos(x, y) < 48) continue;
    const grupo = 1 + Math.floor(hash(k, 3, 31) * 4);
    for (let j = 0; j < grupo; j++) {
      const tx = x + (hash(k, j, 33) - 0.5) * 40, ty = y + (hash(k, j, 34) - 0.5) * 40;
      const r = 6 + Math.floor(hash(k, j, 35) * 6);
      if (lejos(tx, ty) < 44 || Math.min(tx, ty, info.BW - tx, info.BH - ty) < 90 || !libre(tx, ty, r)) continue;
      usados.push({ x: tx, y: ty, r });
      g.fillStyle = 'rgba(6,8,10,.55)'; g.beginPath(); g.ellipse(tx + 3, ty + 4, r, r * 0.8, 0, 0, 7); g.fill();     // sombra
      g.fillStyle = '#16221a'; g.beginPath(); g.arc(tx, ty, r, 0, 7); g.fill();
      g.fillStyle = '#1f3024'; g.beginPath(); g.arc(tx - 1, ty - 1, r - 2, 0, 7); g.fill();
      for (let p = 0; p < r * 2; p++) {                                                                        // hojitas
        const a = hash(k * 7 + j, p, 36) * 6.28, rr = hash(k * 7 + j, p, 37) * (r - 1);
        px(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 1, 1, hash(k, p, 38) < 0.5 ? '#2c4230' : '#122016');
      }
    }
  }

  // matas de cortadera cerca del alambrado
  for (let k = 0; k < 220; k++) {
    const lado = hash(k, 1, 41) < 0.5 ? -1 : 1;
    const x = lado < 0 ? info.ruta0 - 18 - hash(k, 2, 41) * 80 : info.ruta1 + 18 + hash(k, 2, 41) * 80;
    const y = hash(k, 3, 41) * info.BH;
    if (!libre(x, y, 3)) continue;
    for (let p = 0; p < 7; p++) px(x + (p - 3), y - Math.abs(p - 3) * 0.6 - 2, 1, 3, p % 2 ? '#5a6a3a' : '#7a7a52');
    px(x - 1, y - 6, 3, 1, '#b4ac84');
  }

  // cartel verde de la ruta: 404
  const sx = info.ruta0 - 30, sy = Math.round(info.OY * 0.55);
  px(sx - 1, sy + 9, 2, 8, '#3a3a40');
  px(sx - 12, sy - 1, 24, 12, '#0c1410'); px(sx - 11, sy, 22, 10, '#1e6a3a'); px(sx - 11, sy, 22, 1, '#3a9a5a');
  const cuatro = ['101', '101', '111', '001', '001'], cero = ['111', '101', '101', '101', '111'];
  [cuatro, cero, cuatro].forEach((dig, i) => dig.forEach((fila, r) => [...fila].forEach((v, c) => { if (v === '1') px(sx - 8 + i * 6 + c, sy + 2 + r, 1, 1, '#e8f0e0'); })));
  usados.push({ x: sx, y: sy, r: 16 });

  // santuario del Gauchito Gil: casita, cintas y banderas rojas
  const gx = info.ruta1 + 34, gy = Math.round(info.BH - info.OY * 0.6);
  for (let k = 0; k < 9; k++) px(gx - 14 + k * 3, gy - 10 + (k % 3), 2, 4, k % 2 ? '#c82828' : '#8a1818');      // banderas
  px(gx - 5, gy - 5, 11, 9, '#140f22'); px(gx - 4, gy - 4, 9, 7, '#a82020'); px(gx - 4, gy - 4, 9, 2, '#d84040');
  px(gx - 1, gy, 3, 2, '#ffd27a');                                                                              // velita
  usados.push({ x: gx, y: gy, r: 18 });

  // auto abandonado en la banquina, oxidado
  const ax = info.ruta1 + 42, ay = Math.round(info.OY * 0.4);
  px(ax - 8, ay - 5, 17, 11, '#140f22'); px(ax - 7, ay - 4, 15, 9, '#6a3a22'); px(ax - 3, ay - 3, 7, 7, '#3a2418');
  px(ax - 7, ay - 4, 3, 2, '#8a5232'); px(ax + 5, ay + 2, 2, 2, '#2a1a12');
  usados.push({ x: ax, y: ay, r: 14 });
}

export const CANCHAS = { ruta404, estadio };
export { hash };

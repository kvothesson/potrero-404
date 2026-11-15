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
      default: {
        // afuera: la ruta sigue más allá de los arcos; a los costados, pampa de noche
        if (ruta) return amarilla ? [120, 96, 36] : asfalto(10);
        if (h < 0.06) return [56, 64, 38];
        if (h < 0.12) return [44, 54, 34];
        if (h > 0.985) return [74, 70, 44];
        return (x * 5 + y * 3) % 7 === 0 ? [36, 46, 30] : [30, 38, 28];
      }
    }
  },
};

export const CANCHAS = { ruta404, estadio };
export { hash };

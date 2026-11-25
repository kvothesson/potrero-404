// Los autos de cada corredor de la Ruta 404. Solo cambia la pinta: el tamaño de choque y la física
// son los mismos para todos (sim.js), así la competencia es pareja.
//
// Cada diseño es una planta (qué puntos ocupa, en coordenadas del auto: x hacia adelante, y al
// costado), una altura, dónde van las ruedas y una función que pinta cada punto del techo. El color
// del equipo entra por `c` (cuerpo, lado, techo, oscuro): casi todos van con el cuerpo del color del
// equipo; Silencio con Dientes es negro y lleva el equipo en dos líneas a los costados.
// Los humanos usan el auto común. Bocetos y criterio: production/ruta_404 del taller.
export const ANGULOS = 32, TAM = 34;
const hexA = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BORDE = [20, 15, 34];
const VIDRIO = [168, 224, 255], VIDRIO_OSC = [70, 110, 150], FARO = [255, 244, 160], COLA = [255, 60, 60];
const GOMA = [26, 26, 30], LLANTA = [120, 120, 130];
const ruido = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// El auto de siempre (el de 2016, redibujado): el que manejan los humanos.
const COMUN = {
  nombre: 'comun', alto: 3, ruedas: [[-8.8, -4.5], [4.5, 8.8]],
  planta: (x, y) => Math.abs(x) < 11 && Math.abs(y) < 5.6,
  pintar(x, y, c) {
    const ay = Math.abs(y);
    if (x > 2 && x <= 5 && ay < 4.2) return VIDRIO;
    if (x >= -5 && x <= 2 && ay < 4.2) return c.techo;
    if (x >= -8 && x < -5 && ay < 3.8) return VIDRIO_OSC;
    if (x > 9.3 && ay > 2.4) return FARO;
    if (x < -9.8 && ay > 2.4) return COLA;
    if (ay < 1.1) return [244, 244, 244];
    return c.cuerpo;
  },
};

const CORREDORES = [
  {
    nombre: 'Chatarra', sub: 'nivel 1 · arma con lo que hay',
    nota: 'Puerta de otro auto, capó con antióxido, una sola luz, la trompa abollada y atada con soga.',
    alto: 3, ruedas: [[-8.8,-4.5],[4.5,8.8]],
    planta: (x, y) => Math.abs(x) < 11 && Math.abs(y) < 5.6 && !(x > 7.5 && y < -3.2),
    pintar(x, y, c) {
      if (x > 6.6 && x < 7.6) return [200,176,120];                       // soga
      if (x > 9.3 && y > 2.4) return FARO;                                  // un solo faro
      if (x < -9.8 && y < -2.4) return COLA;
      if (x > 2 && x <= 5 && Math.abs(y) < 4.2) return (Math.abs(x - 3.5 - y * 0.5) < 0.5) ? VIDRIO_OSC : VIDRIO; // vidrio rajado
      if (x >= -5 && x <= 2 && Math.abs(y) < 4.2) return c.techo;
      if (x >= -8 && x < -5 && Math.abs(y) < 3.8) return VIDRIO_OSC;
      if (x > 5 && x < 9.3) return ruido(x, y) < 0.25 ? [104,100,92] : [138,134,122]; // capó gris antióxido
      if (x > -4 && x < 2 && y > 0) return [150,82,40];                     // puerta de otro auto
      if (ruido(x * 2, y * 2) < 0.12) return [120,64,32];                   // óxido
      return c.cuerpo;
    },
  },
  {
    nombre: 'Ternero Diesel', sub: 'nivel 2 · choque',
    nota: 'Ancho y alto, overo como un ternero, cuernos en la trompa y caño de escape vertical. Va de frente a todo.',
    alto: 4, ruedas: [[-9,-4.6],[3.6,8]],
    planta: (x, y) => (Math.abs(x) < 10.5 && Math.abs(y) < 6.2) || (x >= 10.5 && x < 12.6 && Math.abs(y) > 3.8 + (x - 10.5) * 1.2 && Math.abs(y) < 5.6 + (x - 10.5) * 1.1),
    pintar(x, y, c) {
      if (x >= 10.5) return x > 11.8 ? [90,80,60] : [236,224,190];          // cuernos abiertos para afuera
      if (x > 9.2 && Math.abs(y) < 2.4) return FARO;
      if (x < -9.6 && Math.abs(y) > 2.6) return COLA;
      if (Math.hypot(x - 5, y - 3.6) < 1.2) return [40,40,44];              // escape vertical
      if (x > 1.6 && x <= 4.4 && Math.abs(y) < 4.8) return VIDRIO;
      if (x >= -6 && x <= 1.6 && Math.abs(y) < 4.8) return c.techo;
      if (Math.sin(x * 0.7) + Math.cos(y * 0.9 + x * 0.3) > 0.55) return [240,236,226]; // manchas overas
      return c.cuerpo;
    },
  },
  {
    nombre: 'Luz de Chacra', sub: 'nivel 3 · arquero',
    nota: 'Utilitario redondo de campo con un farol grande en el techo y un paragolpes blanco ancho como guantes de arquero.',
    alto: 3, ruedas: [[-8,-4.4],[4.2,8]],
    planta: (x, y) => (Math.abs(x) / 11) ** 4 + (Math.abs(y) / 6) ** 4 < 1,
    pintar(x, y, c) {
      if (x > 9.2) return Math.abs(y) < 3.8 ? [244,244,236] : [200,200,196];  // paragolpes guante
      const r = Math.hypot(x + 1.5, y);
      if (r < 1.3) return [255,255,224];                                      // farol del techo
      if (r < 2.4) return [255,224,110];
      if (r < 3.0) return [150,110,40];
      if (x > 3.4 && x <= 6.6 && Math.abs(y) < 4.2) return VIDRIO;
      if (x >= -6 && x <= 3.4 && Math.abs(y) < 4.4) return c.techo;
      if (x < -9.4 && Math.abs(y) > 2) return COLA;
      return c.cuerpo;
    },
  },
  {
    nombre: 'Pombero 2.0', sub: 'nivel 4 · juega con la pared',
    nota: 'Chiquito y peludo, con sombrero de paja en el techo. Aparece por donde no lo esperás, rebotando en la pared.',
    alto: 3, ruedas: [[-7.6,-4],[3.6,7.4]],
    planta: (x, y) => Math.abs(x) < 9.6 && Math.abs(y) < 5.2,
    pintar(x, y, c) {
      const r = Math.hypot(x + 1, y);
      if (r < 1.6) return [170,136,64];                                       // copa del sombrero
      if (r < 3.9) return ruido(x * 3, y * 3) < 0.3 ? [190,156,80] : [222,192,116]; // ala de paja
      if (r < 4.4) return [120,92,40];
      if ((Math.abs(y) > 4.2 || Math.abs(x) > 8.6) && ruido(x * 5, y * 5) < 0.55) return [74,50,30]; // pelo en los bordes
      if (x > 7.8 && Math.abs(y) > 2) return FARO;
      if (x > 3.6 && x <= 6.4 && Math.abs(y) < 3.6) return VIDRIO;
      return c.cuerpo;
    },
  },
  {
    nombre: 'Lobizon V8', sub: 'nivel 5 · vive del nitro',
    nota: 'Muscle car de capó largo con el motor afuera, escapes a los costados y faros amarillos de lobo.',
    alto: 3, ruedas: [[-9.4,-5],[4.6,9]],
    planta: (x, y) => (x > -11 && x < 11.8 && Math.abs(y) < 5.4) || (x > -3 && x < 4 && Math.abs(y) < 6.6),
    pintar(x, y, c) {
      if (Math.abs(y) >= 5.4) return Math.floor(x) % 2 ? [200,200,210] : [130,130,140]; // escapes laterales
      if (x > 10.4 && Math.abs(y) > 2.2) return [255,196,40];                 // ojos de lobo
      if (x > 4 && x < 8.4 && Math.abs(y) < 2) return Math.floor(x * 1.5) % 2 ? [210,210,220] : [70,70,80]; // motor afuera
      if (x > -0.6 && x <= 2.4 && Math.abs(y) < 4.2) return VIDRIO;
      if (x >= -6 && x <= -0.6 && Math.abs(y) < 4.2) return c.techo;
      if (x < -10.2 && Math.abs(y) > 2.2) return COLA;
      if (Math.abs(Math.abs(y) - 3) < 0.6 && x > 2.4) return c.oscuro;       // rayas del capó
      return c.cuerpo;
    },
  },
  {
    nombre: 'Gaucho de Ferrita', sub: 'nivel 6 · chata de campo',
    nota: 'Camioneta con caja atrás y un fardo, burro de metal en el frente y guarda pampa en el techo.',
    alto: 4, ruedas: [[-9.6,-5.4],[4.4,8.6]],
    planta: (x, y) => x > -12 && x < 11.6 && Math.abs(y) < 6,
    pintar(x, y, c) {
      if (x > 10.4) return Math.abs(y) % 2 < 1 ? [90,90,100] : [150,150,160]; // burro de metal
      if (x > 9.2 && Math.abs(y) > 2.6) return FARO;
      if (x < -11 && Math.abs(y) > 3) return COLA;
      if (x > 3 && x <= 6 && Math.abs(y) < 4.6) return VIDRIO;
      if (x >= -1 && x <= 3 && Math.abs(y) < 4.6) {                         // techo con guarda pampa de lado a lado
        if (x >= 0 && x < 2.2) return ((Math.floor(y + 10) + Math.floor((x) * 1.4)) % 2 === 0) ? [244,240,228] : [20,18,26];
        return c.techo;
      }
      if (x < -1.6 && x > -11 && Math.abs(y) < 4.8) {                       // caja
        if (x > -7.5 && x < -3.5 && Math.abs(y) < 3) return ruido(x, y) < 0.5 ? [212,180,92] : [184,150,70]; // fardo
        return c.oscuro;
      }
      return c.cuerpo;
    },
  },
  {
    nombre: 'Tanque Nandu', sub: 'nivel 7 · sale de contra',
    nota: 'Hombre-Tanque de la Ruta 404: orugas en vez de ruedas, torreta con cuello largo de ñandú y plumas atrás.',
    alto: 3, ruedas: [[-10.4,10.4]], oruga: true,
    planta: (x, y) => (Math.abs(x) < 10.6 && Math.abs(y) < 5.2) || (x >= 10.6 && x < 13.6 && Math.abs(y) < 0.9),
    pintar(x, y, c) {
      if (x >= 10.6) return x > 12.6 ? [80,80,90] : [170,170,182];           // cuello
      const r = Math.hypot(x + 1.5, y);
      if (r < 1.4) return c.oscuro;                                           // escotilla
      if (r < 3.4) return c.techo;                                            // torreta
      if (r < 3.9) return c.oscuro;
      if (x > -1 && x < 10.6 && Math.abs(y) < 0.9) return [170,170,182];      // cuello sobre la chapa
      if (x < -8.6) return (Math.floor(y * 1.4 + 10) % 2) ? [180,176,190] : [120,116,132]; // plumas
      if (x > 9.4 && Math.abs(y) > 2.8) return FARO;
      return c.cuerpo;
    },
  },
  {
    nombre: 'Silencio con Dientes', sub: 'nivel 8 · el que nadie oye venir',
    nota: 'Bajo y en punta, negro mate. El color del equipo va en dos líneas que brillan a los costados. Dientes pintados en la trompa y ojos finos en vez de faros.',
    alto: 2, ruedas: [[-9,-5],[4.2,7.6]],
    planta: (x, y) => x > -11 && x < 12 && Math.abs(y) < 5.6 * (1 - Math.max(0, (x - 4) / 8) * 0.4),
    pintar(x, y, c) {
      const ancho = 5.6 * (1 - Math.max(0, (x - 4) / 8) * 0.4);
      if (x > 7.2) {                                                        // boca: fila de dientes en triángulo
        const fase = (Math.abs(y) * 0.75) % 1, tri = 1 - Math.abs(fase - 0.5) * 2;
        return x > 11.6 - 4 * tri ? [240,240,232] : [70,10,18];
      }
      if (Math.abs(y) > ancho - 1.1) return c.techo;                        // líneas del equipo
      if (x > 4.6 && x < 6 && Math.abs(y) > 0.9 && Math.abs(y) < 2.8) return [255,255,255]; // ojos
      if (x > -1 && x <= 3.6 && Math.abs(y) < 3.4) return [36,48,64];       // vidrio polarizado
      if (x < -10 && Math.abs(y) > 1.5) return c.techo;
      return ruido(x, y) < 0.1 ? [40,38,48] : [28,26,34];
    },
  },
];

const POR_NOMBRE = new Map(CORREDORES.map((d) => [d.nombre, d]));
// El diseño que le toca a un jugador según su nombre (los nombres son únicos, IAs incluidas).
export function disenoDe(nombre) { return POR_NOMBRE.get(nombre) || COMUN; }

// Los 32 ángulos de un auto, rasterizados píxel por píxel: el costado corrido hacia abajo, el techo
// pintado y un contorno oscuro de 1 píxel. `col` son los colores del equipo en hex.
export function spritesAuto(d, col) {
  const c = { cuerpo: hexA(col.cuerpo), lado: hexA(col.lado), techo: hexA(col.techo), oscuro: hexA(col.oscuro) };
  const out = [];
  for (let k = 0; k < ANGULOS; k++) {
    const cv = document.createElement('canvas'); cv.width = TAM; cv.height = TAM;
    const g = cv.getContext('2d'), img = g.createImageData(TAM, TAM), px = img.data;
    const a = k / ANGULOS * Math.PI * 2, co = Math.cos(a), si = Math.sin(a);
    const pon = (x, y, cc) => { if (x < 0 || y < 0 || x >= TAM || y >= TAM) return; const i = (y * TAM + x) * 4; px[i] = cc[0]; px[i + 1] = cc[1]; px[i + 2] = cc[2]; px[i + 3] = 255; };
    const hay = (x, y) => x >= 0 && y >= 0 && x < TAM && y < TAM && px[(y * TAM + x) * 4 + 3] > 0;
    const loc = (x, y) => { const dx = x + 0.5 - TAM / 2, dy = y + 0.5 - TAM / 2; return [dx * co + dy * si, -dx * si + dy * co]; };
    // 1) costado y ruedas (u orugas)
    for (let h = d.alto; h >= 1; h--) for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
      const [lx, ly] = loc(x, y - h);
      const rueda = d.ruedas.find(([x0, x1]) => lx > x0 && lx < x1);
      if (rueda && h >= 2 && Math.abs(ly) > 3 && Math.abs(ly) < 6.8 && d.planta(lx, 0)) {
        const centro = (rueda[0] + rueda[1]) / 2;
        pon(x, y, d.oruga ? (Math.floor(lx * 1.2 + 20) % 2 ? GOMA : [70, 70, 78]) : Math.abs(lx - centro) < 0.8 && h === 2 ? LLANTA : GOMA);
      } else if (d.planta(lx, ly)) pon(x, y, h === d.alto ? c.oscuro : c.lado);
    }
    // 2) techo, con el borde de abajo del cuerpo un poco más oscuro (luz de arriba)
    for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
      const [lx, ly] = loc(x, y);
      if (!d.planta(lx, ly)) continue;
      let cc = d.pintar(lx, ly, c);
      if (cc === c.cuerpo) { const [l2x, l2y] = loc(x, y + 1); if (!d.planta(l2x, l2y)) cc = c.lado; }
      pon(x, y, cc);
    }
    // 3) contorno
    const borde = [];
    for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) if (!hay(x, y) && (hay(x + 1, y) || hay(x - 1, y) || hay(x, y + 1) || hay(x, y - 1))) borde.push([x, y]);
    borde.forEach(([x, y]) => pon(x, y, BORDE));
    g.putImageData(img, 0, 0);
    out.push(cv);
  }
  return out;
}

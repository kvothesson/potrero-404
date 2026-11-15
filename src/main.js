import { FPS, nuevoEstado, paso, revancha } from './sim.js';
import { crearPintor as pintorLiso } from './render.js';
import { crearPintor as pintorPixel } from './render-pixel.js';
import { crearSonido } from './sonido.js';
import { crearBot } from './bot.js';
import { crearTactil, esTactil } from './tactil.js';
import { conectar, codigoNuevo } from './red.js';

const params = new URLSearchParams(location.search);
// Arte en pixel a lo Super Nintendo; con ?liso se ve el dibujo vectorial anterior.
const canvas = document.getElementById('juego');
// ?cancha=estadio elige la cancha de pasto; por defecto se juega en la Ruta 404.
const pintor = (params.has('liso') ? pintorLiso : pintorPixel)(canvas, { cancha: params.get('cancha') || 'ruta404' });
const sonido = crearSonido();
// Opción oculta: ?fisica=2016 usa la fórmula de rebote original de la pelota (Ball.as).
const fisica = params.get('fisica') === '2016' ? '2016' : null;
const tactil = esTactil() ? crearTactil() : null;

let estado = nuevoEstado();
if (fisica) estado.fisica = fisica;
// pantalla: 'menu' | 'local' (2 en un teclado) | 'bot' | 'online'
let pantalla = 'menu', pausa = false, bot = null, red = null;

// Teclas por jugador, con las del original y alternativas cómodas.
const TECLAS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], freno: ['ShiftLeft', 'KeyC', 'KeyK'], nitro: ['Space', 'KeyV', 'KeyL'],
    salto: ['KeyE', 'KeyF'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    freno: ['ShiftRight', 'Period', 'Numpad0'], nitro: ['ControlRight', 'Slash', 'NumpadDecimal'], salto: ['Enter', 'NumpadEnter'] },
];
const apretadas = new Set();
const DE_JUEGO = new Set(TECLAS.flatMap((t) => Object.values(t).flat()));

function empezar(modo) {
  sonido.despertar();
  pintor.limpiarMarcas();
  pausa = false;
  if (red) { red.cerrar(); red = null; }
  pantalla = modo;
  if (modo === 'online') {
    let codigo = params.get('sala');
    if (!codigo) {
      codigo = codigoNuevo();
      const url = new URL(location.href); url.searchParams.set('sala', codigo);
      history.replaceState(null, '', url);
    }
    red = conectar({ codigo, fisica });
    red.codigo = codigo;
  } else {
    revancha(estado);
    bot = modo === 'bot' ? crearBot(1) : null;
  }
}

function volverAlMenu() {
  if (red) { red.cerrar(); red = null; }
  const url = new URL(location.href); url.searchParams.delete('sala'); history.replaceState(null, '', url);
  pantalla = 'menu'; pausa = false;
}

addEventListener('keydown', (e) => {
  if (DE_JUEGO.has(e.code)) e.preventDefault();
  sonido.despertar();
  apretadas.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyM') sonido.alternar();
  if (pantalla === 'menu') {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Digit1') empezar('local');
    else if (e.code === 'Digit2') empezar('bot');
    else if (e.code === 'Digit3') empezar('online');
    return;
  }
  const actual = vista();
  if (actual && actual.fase === 'fin' && (e.code === 'Enter' || e.code === 'NumpadEnter')) { revanchaAhora(); return; }
  if (e.code === 'Escape') {
    if (pantalla === 'online') { volverAlMenu(); return; }   // online no se pausa: Esc sale
    pausa = !pausa;
  }
  if (pausa && e.code === 'KeyR') { pausa = false; revancha(estado); pintor.limpiarMarcas(); }
  if (pausa && e.code === 'KeyQ') volverAlMenu();
});
addEventListener('keyup', (e) => apretadas.delete(e.code));
addEventListener('blur', () => apretadas.clear());

function revanchaAhora() {
  pintor.limpiarMarcas();
  if (red) red.revancha(); else revancha(estado);
}

// Toques y clics: botones del menú y de las pantallas dibujados en el canvas.
canvas.addEventListener('pointerdown', (e) => {
  sonido.despertar();
  const id = pintor.botonEn(e.clientX, e.clientY);
  if (!id) return;
  if (id === 'local' || id === 'bot' || id === 'online') empezar(id);
  else if (id === 'menu') volverAlMenu();
  else if (id === 'otra') revanchaAhora();
  else if (id === 'copiar') copiarLink();
  else if (id === 'sonido') sonido.alternar();
  else if (id === 'pausa') pausa = !pausa;
});

async function copiarLink() {
  const url = location.href;
  try {
    if (navigator.share && tactil) await navigator.share({ url });
    else { await navigator.clipboard.writeText(url); pintor.avisarCopiado(); }
  } catch { /* el usuario canceló */ }
}

function leer(i) {
  const t = TECLAS[i], e = {};
  for (const k in t) e[k] = t[k].some((c) => apretadas.has(c));
  return e;
}
// Contra el bot u online se maneja con cualquiera de las dos manos del teclado o con el táctil.
function leerPropio(auto) {
  const a = leer(0), b = leer(1), t = tactil ? tactil.leer(auto) : {};
  const e = {};
  for (const k of Object.keys(a)) e[k] = a[k] || b[k] || !!t[k];
  return e;
}

function vista() {
  if (pantalla === 'online') return red && red.estado;
  return estado;
}

// Paso fijo de 1/60 s, igual que el frameRate del SWF original.
const DT = 1000 / FPS;
let acumulado = 0, antes = performance.now();
function cuadro(ahora) {
  acumulado += Math.min(250, ahora - antes); antes = ahora;
  while (acumulado >= DT) {
    if (pantalla === 'local' && !pausa) {
      paso(estado, [leer(0), leer(1)]);
      sonido.eventos(estado);
    } else if (pantalla === 'bot' && !pausa) {
      paso(estado, [leerPropio(estado.autos[0]), bot(estado)]);
      sonido.eventos(estado);
    } else if (pantalla === 'online' && red) {
      const lado = red.lado >= 0 ? red.lado : 0;
      const s = red.tic(leerPropio(red.estado && red.estado.autos[lado]));
      if (s) sonido.eventos(s);
    }
    acumulado -= DT;
  }
  const s = pantalla === 'online' && red ? red.vista() : vista();
  if (tactil) tactil.mostrar(pantalla !== 'menu' && !pausa);
  sonido.motores(pantalla === 'menu' || pausa || !s ? null : s);
  pintor.dibujar(s || estado, {
    pantalla, pausa, tactil: !!tactil,
    red: red && { lado: red.lado, jugadores: red.jugadores, codigo: red.codigo, caido: red.caido, conectado: red.conectado, ping: red.ping, listo: !!red.estado },
  });
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// Si se entra con un link de sala, ir directo a la sala.
if (params.get('sala')) empezar('online');

// para pruebas automáticas desde la consola
window.autobol = {
  get estado() { return vista() || estado; }, get red() { return red; },
  paso: (e) => paso(estado, e), empezar: (m = 'local') => empezar(m), menu: volverAlMenu,
  dibujar: () => pintor.dibujar(vista() || estado, { pantalla, pausa, tactil: !!tactil, red: red && { lado: red.lado, jugadores: red.jugadores, codigo: red.codigo, caido: red.caido, conectado: red.conectado, ping: red.ping, listo: !!red.estado } }),
};

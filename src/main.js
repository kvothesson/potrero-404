import { FPS, nuevoEstado, paso, revancha } from './sim.js';
import { crearPintor } from './render.js';
import { crearSonido } from './sonido.js';

const canvas = document.getElementById('juego');
const pintor = crearPintor(canvas);
const sonido = crearSonido();
let estado = nuevoEstado();
let portada = true, pausa = false;

// Teclas por jugador, con las del original y alternativas cómodas.
const TECLAS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], freno: ['ShiftLeft', 'KeyC', 'KeyK'], nitro: ['Space', 'KeyV', 'KeyL'],
    salto: ['KeyE', 'KeyF'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    freno: ['ShiftRight', 'Period', 'Numpad0'], nitro: ['ControlRight', 'Slash', 'NumpadDecimal'], salto: ['Enter', 'NumpadEnter'] },
];
const apretadas = new Set();
const DE_JUEGO = new Set(TECLAS.flatMap((t) => Object.values(t).flat()));

addEventListener('keydown', (e) => {
  if (DE_JUEGO.has(e.code)) e.preventDefault();
  sonido.despertar();
  apretadas.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyM') sonido.alternar();
  if (portada && (e.code === 'Enter' || e.code === 'NumpadEnter')) { portada = false; revancha(estado); pintor.limpiarMarcas(); return; }
  if (!portada && estado.fase === 'fin' && e.code === 'Enter') { revancha(estado); pintor.limpiarMarcas(); return; }
  if (!portada && e.code === 'Escape') pausa = !pausa;
  if (pausa && e.code === 'KeyR') { pausa = false; revancha(estado); pintor.limpiarMarcas(); }
});
addEventListener('keyup', (e) => apretadas.delete(e.code));
addEventListener('blur', () => apretadas.clear());

function leer(i) {
  const t = TECLAS[i], e = {};
  for (const k in t) e[k] = t[k].some((c) => apretadas.has(c));
  return e;
}

// Paso fijo de 1/60 s, igual que el frameRate del SWF original.
const DT = 1000 / FPS;
let acumulado = 0, antes = performance.now();
function cuadro(ahora) {
  acumulado += Math.min(250, ahora - antes); antes = ahora;
  while (acumulado >= DT) {
    if (!portada && !pausa) {
      paso(estado, [leer(0), leer(1)]);
      sonido.eventos(estado);
    }
    acumulado -= DT;
  }
  sonido.motores(portada || pausa ? null : estado);
  pintor.dibujar(estado, { portada, pausa });
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// para pruebas automáticas desde la consola
window.autobol = { get estado() { return estado; }, paso: (e) => paso(estado, e), empezar: () => { portada = false; revancha(estado); } };

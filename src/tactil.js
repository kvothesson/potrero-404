// Controles para celular: un joystick que aparece donde apoyás el pulgar izquierdo
// (el auto va para donde apuntás) y tres botones a la derecha: nitro, salto y freno de mano.
import { icono } from './fuente.js';

export const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function botonIcono(nombre) {
  const cv = document.createElement('canvas'); cv.width = 9; cv.height = 9;
  icono(cv.getContext('2d'), nombre, 0, 0, 1);
  cv.className = 'icono';
  return cv;
}

export function crearTactil() {
  const capa = document.createElement('div'); capa.id = 'tactil';
  capa.innerHTML = '<div class="zona-palanca"><div class="base"><div class="perilla"></div></div></div><div class="botones"></div>';
  document.body.appendChild(capa);
  document.body.classList.add('tactil');
  const zona = capa.querySelector('.zona-palanca'), base = capa.querySelector('.base'), perilla = capa.querySelector('.perilla');
  const botones = capa.querySelector('.botones');
  const apretado = { nitro: false, salto: false, freno: false };
  for (const [clave, ic] of [['freno', 'derrape'], ['salto', 'salto'], ['nitro', 'nitro']]) {
    const b = document.createElement('button'); b.className = `boton ${clave}`; b.setAttribute('aria-label', clave);
    b.appendChild(botonIcono(ic));
    const soltar = () => { apretado[clave] = false; b.classList.remove('activo'); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* sin captura */ } apretado[clave] = true; b.classList.add('activo'); navigator.vibrate?.(8); });
    b.addEventListener('pointerup', soltar); b.addEventListener('pointercancel', soltar); b.addEventListener('lostpointercapture', soltar);
    botones.appendChild(b);
  }

  let id = null, ox = 0, oy = 0, vx = 0, vy = 0;
  const RADIO = 56;
  zona.addEventListener('pointerdown', (e) => {
    e.preventDefault(); id = e.pointerId; try { zona.setPointerCapture(id); } catch { /* sin captura */ }
    const r = zona.getBoundingClientRect();
    ox = e.clientX; oy = e.clientY; vx = vy = 0;
    base.style.left = `${ox - r.left}px`; base.style.top = `${oy - r.top}px`; base.classList.add('visible');
    perilla.style.transform = 'translate(-50%,-50%)';
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
    if (d > RADIO) { dx *= RADIO / d; dy *= RADIO / d; }
    vx = dx / RADIO; vy = dy / RADIO;
    perilla.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const fin = (e) => { if (e.pointerId !== id) return; id = null; vx = vy = 0; base.classList.remove('visible'); };
  zona.addEventListener('pointerup', fin); zona.addEventListener('pointercancel', fin);

  // Traduce el joystick a las teclas de siempre, según para dónde mira el auto.
  // anguloCamara: cuánto está girada la pantalla (grados); la palanca se lee en la pantalla.
  function leer(auto, anguloCamara = 0) {
    const e = { up: false, down: false, left: false, right: false, freno: apretado.freno, nitro: apretado.nitro, salto: apretado.salto };
    const fuerza = Math.hypot(vx, vy);
    if (!auto || fuerza < 0.25) return e;
    const quiere = Math.atan2(vy, vx) * 180 / Math.PI - anguloCamara;
    const dif = ((quiere - auto.rot + 540) % 360) - 180;
    if (Math.abs(dif) > 150 && Math.abs(auto.vel) < 1.5) { e.down = true; return e; }   // tirar para atrás: marcha atrás
    e.up = true;
    if (dif > 5) e.right = true; else if (dif < -5) e.left = true;
    return e;
  }
  return { leer, mostrar: (si) => capa.classList.toggle('oculto', !si) };
}

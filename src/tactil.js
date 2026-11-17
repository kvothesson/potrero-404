// Controles para celular: un joystick que aparece donde apoyás el pulgar izquierdo
// (el auto va para donde apuntás) y tres botones a la derecha: nitro, salto y freno de mano.
import { icono } from './fuente.js';
import { t } from './idioma.js';

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
  for (const [clave, ic] of [['freno', 'derrape'], ['nitro', 'nitro']]) {
    const b = document.createElement('button'); b.className = `boton ${clave}`; b.setAttribute('aria-label', clave);
    b.appendChild(botonIcono(ic));
    const etq = document.createElement('span'); etq.className = 'etq'; etq.textContent = t(ic === 'derrape' ? 'derrape' : ic); b.appendChild(etq);
    const soltar = () => { apretado[clave] = false; b.classList.remove('activo'); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* sin captura */ } apretado[clave] = true; b.classList.add('activo'); navigator.vibrate?.(8); });
    b.addEventListener('pointerup', soltar); b.addEventListener('pointercancel', soltar); b.addEventListener('lostpointercapture', soltar);
    botones.appendChild(b);
  }

  // Palanca: se escuchan los toques de siempre (touchstart/move/end), que andan en todos los celus,
  // y los pointer events solo para el mouse. Aparece donde apoyás el pulgar; quieta, se ve tenue abajo.
  let activo = null, ox = 0, oy = 0, vx = 0, vy = 0;
  let RADIO = 56;
  const reposo = () => { base.classList.remove('visible'); base.classList.add('quieta'); base.style.left = ''; base.style.top = ''; perilla.style.transform = 'translate(-50%,-50%)'; };
  reposo();
  function empieza(x, y) {
    const r = zona.getBoundingClientRect();
    ox = x; oy = y; vx = vy = 0;
    RADIO = Math.max(40, base.offsetWidth * 0.45 || 56);
    base.classList.remove('quieta');
    base.style.left = `${ox - r.left}px`; base.style.top = `${oy - r.top}px`; base.classList.add('visible');
    perilla.style.transform = 'translate(-50%,-50%)';
  }
  function mueve(x, y) {
    let dx = x - ox, dy = y - oy; const d = Math.hypot(dx, dy);
    if (d > RADIO) { dx *= RADIO / d; dy *= RADIO / d; }
    vx = dx / RADIO; vy = dy / RADIO;
    perilla.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function termina() { activo = null; vx = vy = 0; reposo(); }

  const toque = (lista) => { for (const t of lista) if (t.identifier === activo) return t; return null; };
  zona.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (activo !== null) return;
    const t = e.changedTouches[0]; activo = t.identifier; empieza(t.clientX, t.clientY);
  }, { passive: false });
  zona.addEventListener('touchmove', (e) => { e.preventDefault(); const t = toque(e.changedTouches); if (t) mueve(t.clientX, t.clientY); }, { passive: false });
  const fin = (e) => { if (toque(e.changedTouches)) termina(); };
  zona.addEventListener('touchend', fin); zona.addEventListener('touchcancel', fin);

  // mouse (para probar en la compu)
  zona.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault(); activo = 'mouse'; try { zona.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    empieza(e.clientX, e.clientY);
  });
  zona.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch' && activo === 'mouse') mueve(e.clientX, e.clientY); });
  zona.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch' && activo === 'mouse') termina(); });

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
  // el aro del botón de nitro muestra cuánto te queda; vacío se apaga
  const bNitro = botones.querySelector('.nitro');
  let nitroAntes = -1;
  function nitro(n) {
    const v = Math.round(Math.max(0, Math.min(100, n)));
    if (v === nitroAntes) return;
    nitroAntes = v; bNitro.style.setProperty('--n', v); bNitro.classList.toggle('vacio', v < 1);
  }
  return { leer, nitro, mostrar: (si) => capa.classList.toggle('oculto', !si) };
}

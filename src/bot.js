// Rival manejado por la computadora, para jugar solo. Se pone detrás de la pelota, en la
// línea hacia el arco contrario, y le pega; si la pelota está cerca de su arco, vuelve a defender.
import { W, CAMPO } from './sim.js';

export function crearBot(lado) {
  const arcoContrario = { x: W / 2, y: lado === 1 ? CAMPO.T - 20 : CAMPO.B + 20 };
  const arcoPropio = { x: W / 2, y: lado === 1 ? CAMPO.B : CAMPO.T };
  let trabado = 0;
  return function pensar(s) {
    const c = s.autos[lado], b = s.pelota;
    if (s.fase !== 'juego') return {};
    // punto detrás de la pelota mirando al arco contrario
    const dx = arcoContrario.x - b.x, dy = arcoContrario.y - b.y, d = Math.hypot(dx, dy) || 1;
    let tx = b.x - dx / d * 22, ty = b.y - dy / d * 22;
    // si la pelota está entre el auto y su propio arco, volver a cubrir primero
    const pelotaAtras = lado === 1 ? b.y > c.y + 10 : b.y < c.y - 10;
    if (pelotaAtras) { tx = (b.x + arcoPropio.x) / 2; ty = (b.y + arcoPropio.y) / 2; }
    const ang = Math.atan2(ty - c.y, tx - c.x) * 180 / Math.PI;
    const dif = ((ang - c.rot + 540) % 360) - 180;
    const lejos = Math.hypot(tx - c.x, ty - c.y);
    // si se quedó contra una pared, marcha atrás un rato
    if (Math.abs(c.vel) < 0.3) trabado++; else trabado = Math.max(0, trabado - 2);
    if (trabado > 40) { if (trabado > 70) trabado = 0; return { down: true, left: true }; }
    const cercaPelota = Math.hypot(b.x - c.x, b.y - c.y) < 40;
    return {
      up: Math.abs(dif) < 120 || lejos > 60,
      down: Math.abs(dif) > 150 && lejos < 50,
      right: dif > 6, left: dif < -6,
      freno: Math.abs(dif) > 75 && Math.abs(c.vel) > 3,
      nitro: c.nitro > 30 && Math.abs(dif) < 12 && lejos > 120,
      salto: cercaPelota && Math.abs(dif) < 20 && !pelotaAtras && (s.cuadro % 30 === 0),
    };
  };
}

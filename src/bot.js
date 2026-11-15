// Rival manejado por la computadora. Se pone detrás de la pelota, en la línea hacia el arco
// contrario, y le pega; si la pelota está entre él y su arco, vuelve a defender. También se
// corre del camión cuando lo escucha venir.
//
// nivel 1 a 8 (las IAs del ranking): los bajos piensan más lento, apuntan peor, casi no usan
// nitro ni salto y a veces levantan el pie; el 8 juega a fondo.
import { W, CAMPO } from './sim.js';

export function crearBot(lado, nivel = 5) {
  const n = Math.max(1, Math.min(8, nivel));
  const arcoContrario = { x: W / 2, y: lado === 1 ? CAMPO.T - 20 : CAMPO.B + 20 };
  const arcoPropio = { x: W / 2, y: lado === 1 ? CAMPO.B : CAMPO.T };
  const cadaCuanto = Math.max(1, 10 - n);           // cuadros entre decisiones
  const punteria = 4 + (8 - n) * 3;                  // grados de tolerancia al apuntar
  const errorApunte = (8 - n) * 9;                   // cuánto se corre el punto al que apunta
  const usaNitro = n >= 3, usaSalto = n >= 4, frenaMal = n <= 2;
  let trabado = 0, ultima = {}, cuenta = 0, error = { x: 0, y: 0 };

  return function pensar(s) {
    const c = s.autos[lado], b = s.pelota;
    if (s.fase !== 'juego' || c.aplastado) return {};
    if (cuenta-- > 0) return ultima;
    cuenta = cadaCuanto - 1;
    if (Math.random() < 0.05) error = { x: (Math.random() - 0.5) * errorApunte * 2, y: (Math.random() - 0.5) * errorApunte * 2 };

    // punto detrás de la pelota mirando al arco contrario
    const dx = arcoContrario.x - b.x, dy = arcoContrario.y - b.y, d = Math.hypot(dx, dy) || 1;
    let tx = b.x - dx / d * 22 + error.x, ty = b.y - dy / d * 22 + error.y;
    const pelotaAtras = lado === 1 ? b.y > c.y + 10 : b.y < c.y - 10;
    if (pelotaAtras) { tx = (b.x + arcoPropio.x) / 2; ty = (b.y + arcoPropio.y) / 2; }
    // el camión: si viene y el bot está en su carril, se corre para el lado más libre
    const k = s.camion;
    if (k && (k.estado === 'aviso' || k.estado === 'pasa') && Math.abs(c.x - k.x) < 70 && n >= 2) {
      tx = c.x + (c.x < k.x ? -160 : 160); ty = c.y;
    }
    const ang = Math.atan2(ty - c.y, tx - c.x) * 180 / Math.PI;
    const dif = ((ang - c.rot + 540) % 360) - 180;
    const lejos = Math.hypot(tx - c.x, ty - c.y);
    // si se quedó contra una pared, marcha atrás un rato
    if (Math.abs(c.vel) < 0.3) trabado += cadaCuanto; else trabado = Math.max(0, trabado - 2 * cadaCuanto);
    if (trabado > 40) { if (trabado > 70) trabado = 0; return (ultima = { down: true, left: true }); }
    const cercaPelota = Math.hypot(b.x - c.x, b.y - c.y) < 40;
    ultima = {
      up: (Math.abs(dif) < 120 || lejos > 60) && !(frenaMal && Math.random() < 0.15),
      down: Math.abs(dif) > 150 && lejos < 50,
      right: dif > punteria, left: dif < -punteria,
      freno: Math.abs(dif) > 75 && Math.abs(c.vel) > 3,
      nitro: usaNitro && c.nitro > 30 && Math.abs(dif) < 12 && lejos > 120,
      salto: usaSalto && cercaPelota && Math.abs(dif) < 20 && !pelotaAtras && Math.random() < 0.5,
    };
    return ultima;
  };
}

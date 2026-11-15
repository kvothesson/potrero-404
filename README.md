# Autobol

Fútbol con autos visto desde arriba, para dos jugadores. Es el parcial de Programación II de 2016 (en Flash, ActionScript 3, con el nombre "Antiguo Ball"), revivido en JavaScript para que se juegue en el navegador.

Nombre de trabajo: se puede cambiar.

## Jugar

Abrir `abrir.cmd`, que sirve la carpeta en http://127.0.0.1:5421/.

| | Manejar | Freno de mano | Nitro |
|---|---|---|---|
| Azul (más ágil) | W A S D | Shift izq., C o K | Espacio, V o L |
| Rojo (más rápido) | Flechas | Shift der., punto o 0 del teclado numérico | Ctrl der., barra o punto del teclado numérico |

Esc pausa, R reinicia desde la pausa y M apaga el sonido. Gana el primero en hacer 3 goles.

## Qué se respetó del original

Se sacó del fuente de la versión 09 (`Antiguo Ball/09-CarPruebas/src`, mayo de 2016):

- **Autos:** el azul dobla mejor y el rojo corre más, con las mismas velocidades máximas (5 y 6).
- **Manejo:** el freno de mano gira más y le saca velocidad.
- **Nitro:** arranca en 30, el tope es 100 y se gasta 2 por cuadro.
- **Pastillas de nitro:** 4 grandes que dan 100, 6 chicas que dan 10, y vuelven a los 5 segundos.
- **Pelota:** frena 0,01 por cuadro. El frente del auto la saca en su dirección, la cola la tira para atrás y los costados la hacen rebotar.
- **Partido:** cuenta de 3 segundos al arrancar y después de cada gol. Se gana con 3 goles.
- **Pantalla:** 480×720 a 60 cuadros por segundo.

## Qué cambió

- **Arte y sonido:** los sprites y los sonidos del original están en el .fla y no se bajaron. Los autos, la cancha y los efectos se dibujan con código, y los sonidos se sintetizan.
- **Choques:** son por geometría (círculos y rectángulo rotado) en vez de `hitTestObject`. Ya no se traba nada contra las paredes.
- **Manejo suavizado** (2026-11-15, porque era muy difícil de controlar): acelera a fondo en medio segundo en vez de 4 cuadros, gira unos 210 grados por segundo en vez de 400, dobla aunque no acelere, en marcha atrás dobla como un auto real, el volante tiene un poco de inercia, el nitro llega a 8,5–9,5 en vez de 13–14 y contra la pared rebota en vez de clavarse.
- **Cancha:** tiene esquinas en ochava.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/sim.js` | Simulación pura, sin DOM. Es la misma que va a correr el servidor cuando sea online. |
| `src/render.js` | Dibuja en canvas 2D. |
| `src/sonido.js` | Sonidos con Web Audio. |
| `src/main.js` | Teclado y bucle de juego con paso fijo de 1/60 s. |

## Próximo paso: online

El plan es jugar online desde el navegador, sin cuenta, compartiendo un link de sala. Cada sala corre la misma `sim.js` en un Durable Object de Cloudflare, con autoridad del servidor, y los jugadores mandan solo sus teclas por WebSocket. Se publica en kvothesson.com.

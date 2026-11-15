# Autobol

Fútbol con autos visto desde arriba, para dos jugadores. Es el parcial de Programación II de 2016 (en Flash, ActionScript 3, con el nombre "Antiguo Ball"), revivido en JavaScript para que se juegue en el navegador.

Nombre de trabajo: se puede cambiar.

## Jugar

Abrir `abrir.cmd`, que sirve la carpeta en http://127.0.0.1:5421/.

| | Manejar | Freno de mano | Nitro | Salto |
|---|---|---|---|---|
| Azul (más ágil) | W A S D | Shift izq., C o K | Espacio, V o L | E o F |
| Rojo (más rápido) | Flechas | Shift der., punto o 0 del teclado numérico | Ctrl der., barra o punto del teclado numérico | Enter |

El salto es el *dodge* de Rocket League: solo va para adelante, con doblar va al costado y con atrás va para atrás. Mientras dura no hay agarre y el golpe a la pelota sale casi al doble de fuerte. Tiene una recarga de poco más de un segundo, que se ve en el punto blanco junto a la barra de nitro.

Esc pausa, R reinicia desde la pausa y M apaga el sonido. Gana el primero en hacer 3 goles.

## Sin idioma

En pantalla no hay palabras, para que se entienda en cualquier idioma. Los jugadores se distinguen por el color. Los controles se muestran con teclas dibujadas e íconos (derrape, nitro, salto), y para "se gana con 3" hay tres pelotas, una flecha y un trofeo. El gol se muestra con el auto que lo hizo, la pelota y el marcador, y el final con el trofeo y la tecla ⏎ para la revancha. El único texto que queda es el nombre del juego.

## Qué se respetó del original

Se sacó del fuente de la versión 09 (`Antiguo Ball/09-CarPruebas/src`, mayo de 2016):

- **Autos:** el azul dobla mejor y el rojo corre más, como en el original (velocidad máxima 5 y 5,6).
- **Manejo:** el freno de mano gira más y le saca velocidad.
- **Nitro:** tope de 100 y se junta de las pastillas.
- **Pastillas de nitro:** 4 grandes que dan 100, 6 chicas que dan 10, y vuelven a los 5 segundos.
- **Partido:** cuenta de 3 segundos al arrancar y después de cada gol. Se gana con 3 goles.
- **Pantalla:** 480×720 a 60 cuadros por segundo.

## Qué cambió

- **Arte y sonido:** los sprites y los sonidos del original están en el .fla y no se bajaron. Todo se dibuja con código y los sonidos se sintetizan. Desde el 2026-11-15 el arte es pixel art a lo Super Nintendo (`src/render-pixel.js`): buffer de 272×400 agrandado a escala entera sin suavizado, autos en tres cuartos rasterizados en 32 ángulos con contorno de 1 píxel, paredes con cara visible, tribunas con público que salta en los goles, fuente de 5×7 propia (`src/fuente.js`) y temblor de cámara. Con `?liso` en la dirección se ve el dibujo vectorial anterior.
- **Física a lo Rocket League** (2026-11-15): autos y pelota tienen velocidad como vector y los choques se resuelven con impulsos (auto con 3 veces la masa de la pelota, más un empujón extra al pegar). La pelota sale según dónde y qué tan fuerte le pegás. El auto agarra el piso, dobla con radio chico despacio y más abierto a fondo, se desliza por las paredes y con el freno de mano derrapa conservando la velocidad. Antes la pelota copiaba la dirección del auto, como en el original.
- **Manejo suavizado** (2026-11-15, porque era muy difícil de controlar): acelera a fondo en medio segundo en vez de 4 cuadros, gira unos 210 grados por segundo en vez de 400, dobla aunque no acelere, en marcha atrás dobla como un auto real, el volante tiene un poco de inercia, el nitro llega a 8,5–9,5 en vez de 13–14 y contra la pared rebota en vez de clavarse.
- **Derrape y nitro que se notan:** el freno de mano ahora hace patinar el auto de cola (velocidad lateral con poco agarre) y deja marcas y humo. El nitro se gasta 0,7 por cuadro en vez de 2 y arranca en 40: la barra llena dura unos 2,4 s en vez de 0,8.
- **Cancha:** tiene esquinas en ochava.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/sim.js` | Simulación pura, sin DOM. Es la misma que va a correr el servidor cuando sea online. |
| `src/render-pixel.js` | Dibuja en pixel art (el de siempre). |
| `src/render.js` | Dibujo vectorial anterior, con `?liso`. |
| `src/fuente.js` | Fuente de 5×7 píxeles. |
| `src/sonido.js` | Sonidos con Web Audio. |
| `src/main.js` | Teclado y bucle de juego con paso fijo de 1/60 s. |

## Próximo paso: online

El plan es jugar online desde el navegador, sin cuenta, compartiendo un link de sala. Cada sala corre la misma `sim.js` en un Durable Object de Cloudflare, con autoridad del servidor, y los jugadores mandan solo sus teclas por WebSocket. Se publica en kvothesson.com.

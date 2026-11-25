# Potrero 404

Fútbol con autos visto desde arriba, para dos jugadores. Es el parcial de Programación II de 2016 (en Flash, ActionScript 3, con el nombre "Antiguo Ball"), revivido en JavaScript para que se juegue en el navegador.

Antes se llamó "Antiguo Ball" (2016) y "Autobol" (nombre de trabajo de 2026).

## Jugar

Abrir `abrir.cmd`, que sirve la carpeta en http://127.0.0.1:5421/.

| | Manejar | Freno de mano | Nitro | Salto |
|---|---|---|---|---|
| Azul (más ágil) | W A S D | Shift izq., C o K | Espacio, V o L | E o F |
| Rojo (más rápido) | Flechas | Shift der., punto o 0 del teclado numérico | Ctrl der., barra o punto del teclado numérico | Enter |

El salto es el *dodge* de Rocket League: solo va para adelante, con doblar va al costado y con atrás va para atrás. Mientras dura no hay agarre y el golpe a la pelota sale casi al doble de fuerte. Tiene una recarga de poco más de un segundo, que se ve en el punto blanco junto a la barra de nitro.

Esc pausa, R reinicia desde la pausa y M apaga el sonido. Gana el primero en hacer 3 goles.

## Cancha grande, cámara y camión

- **Un jugador por compu:** se juega contra la máquina u online. Se maneja con W A S D o con las flechas, y en el celu con la palanca y los botones.
- **Cancha y cámara:** la cancha es el doble de grande (960×1440) y la cámara sigue a tu auto, mirando un poco hacia adonde va. Arriba a la derecha hay un radar con toda la cancha.
- **El camión de la Ruta 404:** pasa a lo sumo una vez por partido, en el 60 % de los partidos, entre los 20 y los 70 segundos de juego. Avisa con bocina y un cartel titilando del lado de donde viene. Cruza la cancha de punta a punta: si te agarra te aplasta y volvés a aparecer en tu arco a los 2,5 segundos, y a la Luz Mala la saca volando.

## La Luz Mala no se traba

- **Desvío en cada golpe:** cada golpe a la pelota se tuerce hasta ±7 grados, así dos golpes iguales no se anulan siempre.
- **Salto cuántico:** si los dos autos la aprietan a la vez y queda quieta en el medio, la Luz Mala pega un salto cuántico. Desaparece dejando un fantasma rojo y celeste, y reaparece 48 unidades al costado, para un lado al azar, con algo de envión.
- **Azar sincronizado:** el azar sale del estado del juego (`azar()` en `sim.js`), no de `Math.random`, así da lo mismo en el navegador y en el servidor y el online no se desincroniza.

## Física y cámara a lo Rocket League

Los valores salen de RocketSim y de mediciones públicas de la comunidad, no de los archivos del juego. Están todos, con fuentes, en `docs/rocket-league-valores.md`: el empujón extra al pegarle a la pelota, la masa 6 a 1, la curva de aceleración, el giro y el freno de mano gradual, la demolición y la **cámara a la pelota** (tecla B).

## Ranking

- **Un solo modo:** online, siempre con Elo. No hay práctica ni salas con amigos en el menú: los humanos juegan como las IAs, directo a la tabla. (El modo contra la máquina queda solo para pruebas y para filmar, desde la consola: `potrero.empezar('bot')`.)
- **Online:** el servidor te busca un rival. Si en 8,5 segundos no aparece nadie, entra una **IA** de Elo parecido al tuyo. Hay 8 IAs de `src/bot.js`, con nombres de la Ruta 404, cada una con su fuerza y su forma de jugar (ver "Las IAs" más abajo).
- **Una sola tabla:** humanos e IAs, ordenados por **Elo**. Las IAs llevan un robotito, solo en la tabla; durante el partido no se marcan. Se arranca en 1000. K = 32 en las primeras 20 partidas, después 20, y en las IAs 16. Irse antes de terminar una rankeada es perder.
- **Sin contraseña:** para jugar alcanza con elegir un nombre; tu navegador guarda un id y una llave secreta (en la base va el hash). Para jugar desde otro dispositivo con el mismo puesto se entra con **Google** o con un **código de 6 números por mail**, en la página del ranking (`ranking/`). No se guarda el mail ni la cuenta de Google: solo una huella (HMAC con una sal secreta del servidor). Cada dispositivo recibe su propia llave. Lógica en `server/cuentas.js`, pruebas en `server/prueba-cuentas.mjs`.
- **Configurar las cuentas en Cloudflare:** los secretos `SAL` (ya cargado) y `RESEND` (clave de [Resend](https://resend.com), que manda los mails desde `potrero@kvothesson.com`) van en `nube/.secretos.json`, que no se sube al repo, y se suben con `cf deploy --secrets-file .secretos.json`. Mientras falte alguno, la página dice "muy pronto". El botón de Google aparece cuando `src/cuentas-config.js` tiene el ID de cliente (es público).
- **Seguridad:** el resultado lo anota el servidor de la sala, que es el que vio el partido, nunca el navegador.
- **Dónde se guarda:** en Cloudflare D1 (`potrero-404-ranking`), que deja volver a cualquier momento de los últimos 30 días. En la PC, el servidor local usa SQLite en `server/datos/ranking.sqlite`.
- **Código:** `server/ranking.js` (Elo, registro, tabla), `server/api.js` (rutas y fila) y `server/sala.js` (sala rankeada con IA). Los usan igual el servidor local y `nube/`.
- **Prueba de punta a punta:** `node server/prueba-ranking.mjs <servidor>`.

## Las IAs: reglas parejas y estilos

Humanos e IAs comparten la tabla, así que las IAs juegan con las reglas de un humano (`src/bot.js`):

- **Reacción humana:** cada IA decide con una foto del partido de hace 12 a 16 cuadros (200 a 267 ms; 200 ms es la reacción visual simple de una persona atenta). Ninguna baja de 200 ms. Lo que pasó después lo tiene que adivinar, como cualquiera: recuerda lo que apretó y predice la pelota con los rebotes.
- **Mismas teclas:** solo arriba, abajo, izquierda, derecha, freno de mano y nitro, y cambia de teclas a lo sumo 15 veces por segundo.
- **Solo lo que se ve:** autos, pelota, barras de nitro de las gradas, pastillas y el aviso del camión. No lee el azar de la simulación ni nada interno del rival.
- **Nadie se queda esperando:** si la pelota está quieta o sin nadie cerca más de 2,5 s, cualquier estilo sale a buscarla.

`crearBot(lado, nivel, estilo)`: el nivel (1 a 8) es la fuerza (retraso, cada cuánto decide, cuánto predice, puntería, descuidos) y el estilo la forma de jugar. Sin estilo juega `completo`. El estilo de cada IA está en `IAS` de `server/ranking.js` y en la columna `estilo` de `jugadores` (se agrega sola en una base vieja, sin tocar Elo, partidas ni victorias).

| IA | Fuerza | Estilo | Cómo juega | Reacción |
|---|---|---|---|---|
| Chatarra | 1 | perseguidor | Va derecho a la pelota, sin plan ni defensa | 267 ms |
| Ternero Diesel | 2 | choque | Si el rival está cerca de la pelota, le va al auto con nitro | 250 ms |
| Luz de Chacra | 3 | arquero | Vive en el arco, ataja y despeja a los costados | 250 ms |
| Pombero 2.0 | 4 | pared | Predice los rebotes y prefiere el tiro de banda | 233 ms |
| Lobizon V8 | 5 | nitro | Junta pastillas y ataca siempre a fondo | 233 ms |
| Gaucho de Ferrita | 6 | gambeta | Lleva la pelota pegada, despacio, y define cerca | 217 ms |
| Tanque Nandu | 7 | contra | Espera atrás y sale de contra con nitro | 217 ms |
| Silencio con Dientes | 8 | completo | Llega antes que el rival, defiende si no llega, controla si nadie lo apura | 200 ms |

**Prueba:** `node server/prueba-estilos.mjs [partidos por cruce] [contra el principiante]` juega sin pantalla un todos contra todos entre las 8 (en 4 hilos), muestra la tabla, las métricas que prueban que juegan distinto (distancia al arco, posesión, nitro, pastillas, bandas, choques), que ningún partido se traba (pelota quieta 30 s), mide la reacción (dos mundos iguales, se cambia la pelota en uno y se cuenta cuánto tarda en apretar distinto) y las enfrenta con un principiante simulado (el bot viejo, con 250 ms de reacción). Sale con error si algo no se cumple.

## Liga de IAs

Para que la tabla no esté muerta cuando no hay nadie, las 8 IAs juegan entre ellas partidos de verdad en el servidor, sin pantalla, y cada uno cuenta para el Elo igual que los de los humanos.

- **Reglas de siempre:** la misma `src/sim.js` con `crearBot`, 3 minutos o 3 goles, gol de oro. Se anota con `anotar()` de `server/ranking.js`, en las mismas tablas `jugadores` y `partidas`. Entre IAs K = 16 para los dos, así que el Elo que gana una lo pierde la otra.
- **Emparejamiento:** como con los humanos, por Elo parecido. Se elige una IA al azar y su rival es una de las tres de Elo más cercano. Nunca contra sí misma.
- **Ritmo:** una tanda de 2 partidos cada 10 minutos, unos 288 por día.
- **Dónde corre:** en Cloudflare, el Durable Object `Liga` se despierta con su alarma, juega la tanda y se vuelve a programar. Arranca solo la primera vez que alguien pide `/ranking` o `/liga` después de un despliegue. No va en un cron porque en el plan gratis un cron tiene 10 ms de CPU y un partido cuesta unos 70 a 400 ms. Un Durable Object tiene 30 s por invocación. En la PC lo corre `server/local.mjs` con un `setInterval` (`LIGA_CADA=3000` para acelerar, `LIGA_CADA=0` para apagarla).
- **Partidos trabados:** con el bot de hoy, cerca del 1 % se traba (la pelota queda clavada). Si la pelota no se mueve en 30 s de juego, o el partido pasa los 12 minutos, se corta y no se anota. Se cuenta aparte en `trabados`.
- **Costo:** todo dentro del plan gratis. Por día son 144 alarmas, unas 2.500 filas escritas en D1 (el límite es 100.000) y unas 17 consultas por tanda (el límite es 50 por invocación).
- **Ver desde afuera, sin jugar:** `GET /liga` devuelve los últimos partidos (`?n=` hasta 50), la cuenta por día y el Elo de cada IA. La página del ranking muestra los últimos 5.
- **Prueba:** `node server/prueba-liga.mjs` levanta su propio servidor local con una base temporal y la liga acelerada. Revisa que los partidos terminen bien, que el Elo se mueva y se conserve, y que `/liga` responda. Al final corre `prueba-ranking.mjs` contra ese servidor. Con una URL, `node server/prueba-liga.mjs https://potrero-404.kvothesson.workers.dev`, solo mira `/liga` de ese servidor y revisa que los partidos tengan sentido.

## Canchas

Cada cancha está en `src/canchas.js`: elige el color de cada parte del fondo y qué decorado lleva.

- **Ruta 404** (la de siempre): un picado de noche en la Ruta 404 del Universo Austral. Hay asfalto con grietas y bacheo, alambrado, y píxeles muertos que titilan con glitch. La pelota es una **Luz Mala** que flota y alumbra. El nitro es el **aceite negro** de los Hombres-Tanque: tambores en las esquinas y charcos en el medio. Los **Hombres-Tanque** miran desde la banquina y sus ojos siguen a la Luz Mala. Todo está a oscuras salvo la Luz Mala y los faros. La Luz Mala como pelota y el aceite como nitro son expansión del canon, no canon nuevo.
- **Estadio** (`?cancha=estadio`): la cancha de pasto con tribunas.

Ideas para más canchas: Hielo Negro (fin de la Ruta 3, todo derrapa más) y Potrero Aleph.

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

## Opciones ocultas

- `?fisica=2016`: la pelota usa la fórmula original de Ball.as (ángulo + velocidad, rebote `360 − ángulo + 2 × ángulo de la pared`). Sin el parámetro se juega con la física 2026. Comparación en `docs/pelota-2016-vs-2026.gif`.
- `?liso`: el dibujo vectorial anterior en vez del pixel art.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/sim.js` | Simulación pura, sin DOM. Es la misma que va a correr el servidor cuando sea online. |
| `src/render-pixel.js` | Dibuja en pixel art (el de siempre). |
| `src/render.js` | Dibujo vectorial anterior, con `?liso`. |
| `src/fuente.js` | Fuente de 5×7 píxeles. |
| `src/sonido.js` | Sonidos con Web Audio. |
| `src/main.js` | Teclado y bucle de juego con paso fijo de 1/60 s. |

## Online

- **Dónde está:** el juego se publica con GitHub Pages en https://kvothesson.com/potrero-404/.
- **Las salas:** corren en Cloudflare (`nube/`, desplegado como `potrero-404` en https://potrero-404.kvothesson.workers.dev). Cada código de sala es un Durable Object que corre la misma `server/sala.js` que el servidor local: la simulación es la misma `src/sim.js`, con autoridad del servidor, y los jugadores mandan solo sus teclas.
- **Qué servidor usa:** en localhost el juego se conecta al servidor local; publicado, a Cloudflare.
- **Para desplegar:** `cd nube && cf deploy`. Necesita Node 22.23 o más.
- **Para probar la red:**
  - `node server/prueba-red.mjs 5421`: contra el servidor local.
  - `node server/prueba-red.mjs 443 potrero-404.kvothesson.workers.dev https:`: contra Cloudflare.

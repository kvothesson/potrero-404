# Rocket League por dentro: valores para Potrero 404

Valores de la física de Rocket League para la cámara, la pelota y los autos, y cómo se traducen a Potrero 404.

**De dónde salen.** No se sacaron de los archivos del juego instalado: el acuerdo de licencia prohíbe desarmarlo, y además vienen comprimidos y cifrados. Salen de lo que la comunidad midió y publicó:

- [RocketSim](https://github.com/ZealanL/RocketSim) (licencia MIT): un simulador independiente que replica la física sin usar código del juego. Las constantes están en `src/RLConst.h` y la fórmula del golpe en `src/Sim/Ball/Ball.cpp`.
- [Samuel Mish, ball simulation](https://www.smish.dev/rocket_league/ball_simulation_1): los rebotes de la pelota y el empujón extra al pegarle.
- [Callum Devlin, ground kinematics](https://callumdevlin.github.io/ProjectPages/rlbot/ground-kinematics/): aceleración, frenada y nitro en el piso.
- [RLGym, game values](https://rlgym.org/Cheatsheets/game_values): cancha, masas y velocidades máximas.

En Rocket League las distancias van en *uu* (1 uu = 1 cm) y las velocidades en uu/s. Como en Potrero el auto es mucho más grande con respecto a la cancha, lo que se copia son las **proporciones y las formas de las curvas**, no los números tal cual.

## Autos

| Qué | Rocket League | Potrero hoy | Qué haríamos |
|---|---|---|---|
| Velocidad máxima | 2300 uu/s (solo con nitro) | 9 a 9,8 con nitro | igual |
| Tope sin nitro | 1410 uu/s, el 61 % del máximo | 5,4/9 = 60 % | ya coincide |
| Aceleración según velocidad | 1600 uu/s² parado, baja en línea recta a 160 en 1400 y a 0 en 1410 | tira 2× más fuerte parado y baja a la mitad cerca del tope | copiar la curva: `acel × (1 − 0,9 × v / tope)` |
| Nitro | suma 991,7 uu/s², el 62 % de la aceleración parado, en cualquier velocidad hasta 2300 | duplica la aceleración | sumar 0,62 × acel, en vez de multiplicar |
| Frenada (apretar atrás yendo adelante) | 3500 uu/s², 2,2× la aceleración | 0,4 contra 0,24, 1,7× | subir a 2,2× |
| Rueda libre (sin apretar nada) | 525 uu/s², 0,33× la aceleración | 0,05 contra 0,24, 0,2× | subir a 0,33×: frena más al soltar |
| Gasto de nitro | 33,3 por segundo: la barra llena dura 3 s | 2,4 s | 0,55 por cuadro |
| Pastillas de nitro | grandes: 100, vuelven a los 10 s; chicas: 12, vuelven a los 4 s | todas a los 5 s | separar los tiempos: 10 s y 4 s |
| Giro máximo según velocidad (ángulo de las ruedas) | 0,534 rad parado, 0,319 a 500, 0,182 a 1000, 0,106 a 1500, 0,085 a 1750, 0,035 a 3000 | fijo, salvo a muy baja velocidad | ver la fila siguiente |
| Velocidad de giro resultante | casi constante: unos **115 a 135 grados por segundo** a cualquier velocidad (el radio crece con la velocidad, de 1,2 a 10 largos de auto) | 180 a 258 grados por segundo | bajar a unos 2,2 grados por cuadro: el doble de suave |
| Freno de mano (powerslide) | el agarre de costado baja al 10 %; el giro se abre a 0,392 rad parado y 0,126 a 2500; entra a 5 por segundo y sale a 2 por segundo, no de golpe | se corta en seco | que entre y salga gradual (5/s y 2/s) |
| Choque entre autos | el que pega le da al otro unos 1100 uu/s a 1400 y 1530 a 2200; a velocidad supersónica (2200 o más) lo destruye; vuelve a los 3 s | empujón con rebote 0,45 | empujón según la velocidad del que pega; "demolición" si va a fondo con nitro |
| Salto (dodge) | adelante: +500 uu/s (22 % del máximo); costado 1,9× y atrás 2,5× en el límite de velocidad; giro de 0,65 s | envión 4,6, casi la mitad del máximo | bajarlo a 22 % del tope; el golpe fuerte sale del empujón extra (abajo), no del envión |

## Pelota

| Qué | Rocket League | Potrero hoy | Qué haríamos |
|---|---|---|---|
| Masa auto / pelota | 6 a 1 (180 y 30) | 3 a 1 | 6 a 1: el auto casi no se frena al pegarle |
| Velocidad máxima | 6000 uu/s, 2,6× la del auto | 14, 1,4× el auto con nitro | subir a unos 2,6× el tope sin nitro |
| Rebote contra la pared | 0,6 | 0,78 | 0,6: la pelota rebota más muerta |
| Roce del aire | 3 % por segundo: casi nada | 0,8 % + 0,3 % por cuadro (mucho más) | bajarlo: la pelota rueda más lejos |
| Choque auto-pelota | sin rebote (inelástico) + un **empujón extra** de Psyonix | rebote 0,5 + empujón 0,45 × velocidad | copiar el empujón tal cual (abajo) |

### El empujón extra al pegarle (la clave del "feel")

Cuando el auto toca la pelota, además del choque normal, a la pelota (y no al auto) se le suma una velocidad:

```
relPos   = pelota.pos − auto.pos
relVel   = pelota.vel − auto.vel
relSpeed = min(|relVel|, 4600)
dir      = normalizar(relPos con la altura × 0,35)
dir      = normalizar(dir − adelante × (dir · adelante) × (1 − 0,65))   // le saca 35 % de lo que va hacia adelante del auto
pelota.vel += dir × relSpeed × factor(relSpeed)
factor: 0,65 hasta 500 uu/s → 0,55 a 2300 → 0,30 a 4600 (en línea recta entre puntos)
```

Además, solo se aplica una vez cada dos ticks: no se acumula mientras dura el contacto.

- **Qué hace:** la pelota sale para donde está con respecto al auto (de punta, de costado), con una fuerza que crece con la velocidad del choque pero cada vez menos.
- **Por qué le saca algo de "adelante":** para que los golpes de refilón abran más. Es lo que hace que apuntar con la punta del auto sea una habilidad.
- **En Potrero:** en 2D no hay altura. El resto se copia igual, pasando la velocidad a nuestra escala.

## Cámara

Rocket League tiene una cámara detrás del auto, en 3D. En la configuración vienen los valores que usa casi todo el mundo (los de los jugadores profesionales):

| Ajuste | Valor típico | Qué hace | En Potrero (vista de arriba que gira) |
|---|---|---|---|
| Campo de visión | 110° (máximo) | cuánto se ve de costado | ya se ve todo el ancho cercano |
| Distancia | 260 a 280 (estándar 240) | qué tan atrás va la cámara | que el auto quede abajo en la pantalla (hoy al 64 %) |
| Altura / ángulo | 100 a 110 / −3 a −5° | — | no aplica (vista de arriba) |
| Rigidez (*stiffness*) | 0,35 a 0,7 | con rigidez 0, a fondo la cámara se aleja más de 100; con 1, no se mueve | alejar o mostrar más adelante cuanto más rápido vas |
| Velocidad de giro (*swivel*) | 2,5 a 4,7 | qué tan rápido gira la cámara para seguir al auto | hoy 0,14 por cuadro; hacerlo un ajuste |
| **Cámara a la pelota** (*ball cam*) | se prende y se apaga con un botón; casi todos juegan con ella prendida | la cámara mira desde el auto hacia la pelota, no hacia donde apunta el auto | la técnica más importante para copiar: un botón que hace que "arriba" sea hacia la pelota |

## Lo que más cambiaría el juego, en orden

1. **Empujón extra de la pelota y masa 6 a 1:** los golpes se sienten como en Rocket League y apuntar pasa a importar.
2. **Cámara a la pelota con un botón:** con la cámara que gira es casi obligatoria, porque si no, la pelota queda fuera de la pantalla.
3. **Giro más suave (unos 2,2 grados por cuadro) y freno de mano gradual.**
4. **Pelota que rebota menos (0,6) y rueda más (menos roce).**
5. **Curva de aceleración, frenada fuerte y rueda libre de Rocket League.**
6. **Demolición con nitro a fondo y tiempos de pastillas de 10 s y 4 s.**

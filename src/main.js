import { FPS, nuevoEstado, paso, revancha } from './sim.js';
import { crearPintor as pintorLiso } from './render.js';
import { crearPintor as pintorPixel } from './render-pixel.js';
import { crearSonido } from './sonido.js';
import { crearBot } from './bot.js';
import { crearTactil, esTactil } from './tactil.js';
import { conectar, codigoNuevo, urlApi } from './red.js';
import { crearCuenta } from './cuenta.js';
import { visita, evento, duracion } from './metricas.js';
import { IDIOMA, cambiarIdioma } from './idioma.js';
import { CINE, RIVALES_INTRO } from './cinematica.js';

const params = new URLSearchParams(location.search);
// Opción oculta ?grabar: el juego no corre solo; se avanza cuadro a cuadro desde afuera
// (window.potrero.avanzar(ms)) con un reloj inventado, para grabar el tráiler sin saltos.
const GRABAR = params.has('grabar');
let relojVirtual = 0;
const ahora = () => (GRABAR ? relojVirtual : performance.now());
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
// pantalla: 'menu' | 'bot' (práctica) | 'online' (rankeada, con Elo) | 'amigo' (sala por link, sin Elo)
//           | 'ranking' | 'nombre' (elegir nombre antes de la primera rankeada)
let pantalla = 'menu', pausa = false, bot = null, red = null, ranking = null, despuesDelNombre = null, mostrarRespaldo = false;

// ---------- quién sos: id + llave guardados en este navegador ----------
const CLAVE_YO = 'potrero404.yo';
function cargarYo() { try { return JSON.parse(localStorage.getItem(CLAVE_YO)) || null; } catch { return null; } }
function guardarYo(y) { try { if (y) localStorage.setItem(CLAVE_YO, JSON.stringify(y)); else localStorage.removeItem(CLAVE_YO); } catch { /* sin almacenamiento */ } }
let yo = cargarYo();
// Cámara a la pelota (como la ball cam de Rocket League): prendida de entrada, se recuerda.
let camPelota = (() => { try { return localStorage.getItem('potrero404.camPelota') !== '0'; } catch { return true; } })();
function alternarCamara() { camPelota = !camPelota; try { localStorage.setItem('potrero404.camPelota', camPelota ? '1' : '0'); } catch { /* sin almacenamiento */ } }
const codigoRespaldo = () => (yo ? `${yo.id}-${yo.llave}` : '');

async function api(ruta, cuerpo) {
  const r = await fetch(urlApi() + ruta, cuerpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : {});
  const datos = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, datos };
}
// Quién sos: entrar con Google, con un código por mail, o como invitado (solo un nombre).
const cuenta = crearCuenta({ api, obtenerYo: () => yo, guardar: (y) => { yo = y; guardarYo(y); }, alCerrar: () => { pantalla = 'menu'; } });
cuenta.refrescar();
function abrirCuenta(despues) {
  if (red) { red.cerrar(); red = null; }
  cerrarTexto();
  pantalla = 'nombre';
  cuenta.abrir(despues || (() => { pantalla = 'menu'; }));
}

// ---------- entrada de texto (nombre o código de respaldo), sin palabras: íconos y un ✓ ----------
const entrada = document.createElement('form');
entrada.id = 'entrada'; entrada.className = 'oculto';
entrada.innerHTML = '<input autocomplete="off" spellcheck="false" maxlength="40" aria-label="nombre"><button type="submit" aria-label="ok">✓</button>';
document.body.appendChild(entrada);
const campo = entrada.querySelector('input');
let alConfirmar = null;
function pedirTexto({ largo = 16, valor = '', alListo }) {
  campo.maxLength = largo; campo.value = valor; alConfirmar = alListo;
  entrada.classList.remove('oculto'); entrada.classList.remove('error');
  setTimeout(() => campo.focus(), 30);
}
function cerrarTexto() { entrada.classList.add('oculto'); campo.blur(); alConfirmar = null; }
// Un solo envío a la vez: dos toques seguidos en ✓ registraban el nombre dos veces.
let enviando = false;
entrada.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (enviando || !alConfirmar) return;
  enviando = true; entrada.querySelector('button').disabled = true;
  try {
    if (!(await alConfirmar(campo.value.trim()))) { entrada.classList.add('error'); setTimeout(() => entrada.classList.remove('error'), 500); }
  } finally { enviando = false; entrada.querySelector('button').disabled = false; }
});

function pedirNombre(despues) {
  pantalla = 'nombre'; despuesDelNombre = despues;
  pedirTexto({
    largo: 16,
    alListo: async (nombre) => {
      if (nombre.length < 2) return false;
      const r = await api('/registro', { nombre }).catch(() => ({ ok: false }));
      if (!r.ok) return false;
      yo = { id: r.datos.id, llave: r.datos.llave, nombre: r.datos.nombre };
      guardarYo(yo); cerrarTexto();
      const d = despuesDelNombre; despuesDelNombre = null;
      if (d) d(); else pantalla = 'menu';
      return true;
    },
  });
}

// Pegar un código de respaldo para recuperar tu puesto en otro navegador.
function pedirRespaldo() {
  pedirTexto({
    largo: 40,
    alListo: async (codigo) => {
      const [id, llave] = codigo.split('-');
      const r = await api(`/yo?id=${encodeURIComponent(id || '')}&llave=${encodeURIComponent(llave || '')}`).catch(() => ({ ok: false }));
      if (!r.ok) return false;
      yo = { id, llave, nombre: r.datos.nombre };
      guardarYo(yo); cerrarTexto(); verRanking();
      return true;
    },
  });
}

// ---------- modos ----------
const TECLAS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], freno: ['ShiftLeft', 'KeyC', 'KeyK'], nitro: ['Space', 'KeyV', 'KeyL'],
    salto: ['KeyE', 'KeyF'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    freno: ['ShiftRight', 'Period', 'Numpad0'], nitro: ['ControlRight', 'Slash', 'NumpadDecimal'], salto: ['Enter', 'NumpadEnter'] },
];
const apretadas = new Set();
const DE_JUEGO = new Set(TECLAS.flatMap((t) => Object.values(t).flat()));

let partidaEnCurso = null;   // { modo, desde } para las métricas
// Irse de una rankeada en juego es perder (lo anota el servidor): antes se pregunta, y después se avisa.
let confirmarSalida = false, aviso = null;
function rankeadaEnJuego() {
  if (pantalla !== 'online' || !red || red.lado < 0 || red.jugadores < 2) return false;
  const s = red.estado; return !!s && s.fase !== 'fin';
}
function salirDeOnline() {
  if (rankeadaEnJuego() && !confirmarSalida) { confirmarSalida = true; return; }
  const abandona = rankeadaEnJuego();
  confirmarSalida = false;
  volverAlMenu();
  if (abandona) aviso = { hasta: ahora() + 6000 };
}

// ---------- intro: logo de Kvothesson y cinemática de la Ruta 404, solo la primera vez (o con ?intro), salteable ----------
// La cinemática (cinematica.js) cuenta el lore y cierra con un partido real entre dos corredores.
const LOGO_S = 2.4;
let introDesde = 0, introJuega = false, botIntro = null;
function quiereIntro() {
  if (params.get('sala')) return false;
  if (params.has('intro')) return true;
  try { return !localStorage.getItem('potrero404.intro'); } catch { return false; }
}
function empezarIntro() {
  pantalla = 'intro'; introDesde = ahora(); introJuega = false;
  estado = nuevoEstado(); botIntro = crearBot(0, 8, 'completo'); bot = crearBot(1, 6, 'gambeta');
}
function terminarIntro() {
  try { localStorage.setItem('potrero404.intro', '1'); } catch { /* sin almacenamiento */ }
  pantalla = 'menu'; estado = nuevoEstado(); if (fisica) estado.fisica = fisica; bot = null; botIntro = null;
  pintor.limpiarMarcas();
}
function pasoIntro() {
  const t = (ahora() - introDesde) / 1000;
  if (t > LOGO_S + CINE.fin) { terminarIntro(); return; }
  if (t < LOGO_S + CINE.juego) return;
  if (!introJuega) {
    // el partido del cierre arranca ya empezado: se juegan 8 segundos de un saque antes de mostrarlo
    introJuega = true; estado.fase = 'juego'; estado.reloj = 0;
    for (let n = 0; n < 8 * FPS; n++) paso(estado, [botIntro(estado), bot(estado)]);
  }
  paso(estado, [botIntro(estado), bot(estado)]);
}
async function empezar(modo) {
  sonido.despertar();
  pintor.limpiarMarcas();
  pausa = false; mostrarRespaldo = false;
  if (red) { red.cerrar(); red = null; }
  if (modo === 'online') {
    // rankeada: hace falta un nombre; el servidor busca rival o, si no hay, una IA de tu nivel
    if (!yo) { abrirCuenta(() => empezar('online')); return; }
    pantalla = 'online';
    const r = await api('/buscar').catch(() => ({ ok: false }));
    if (pantalla !== 'online') return;
    if (!r.ok) { red = { caido: true, cerrar() {}, tic: () => null, vista: () => null }; return; }
    red = conectar({ codigo: r.datos.codigo, fisica, rank: true, yo });
    red.codigo = r.datos.codigo;
    partidaEnCurso = { modo: 'online', desde: ahora() }; evento({ t: 'partida', modo: 'online' });
  } else if (modo === 'amigo') {
    // sala por link con amigos: no cuenta para el ranking
    pantalla = 'amigo';
    let codigo = params.get('sala');
    if (!codigo) {
      codigo = codigoNuevo();
      const url = new URL(location.href); url.searchParams.set('sala', codigo); history.replaceState(null, '', url);
    }
    red = conectar({ codigo, fisica, yo });
    red.codigo = codigo;
    partidaEnCurso = { modo: 'amigo', desde: ahora() }; evento({ t: 'partida', modo: 'amigo' });
  } else {
    pantalla = 'bot';
    revancha(estado); if (fisica) estado.fisica = fisica;
    bot = crearBot(1, 5);
    partidaEnCurso = { modo: 'bot', desde: ahora() }; evento({ t: 'partida', modo: 'bot' });
  }
}

function volverAlMenu() {
  cuenta.cerrar();
  if (partidaEnCurso) { evento({ t: 'abandono', modo: partidaEnCurso.modo }); partidaEnCurso = null; }
  if (red) { red.cerrar(); red = null; }
  cerrarTexto();
  const url = new URL(location.href); url.searchParams.delete('sala'); history.replaceState(null, '', url);
  params.delete('sala');
  pantalla = 'menu'; pausa = false; mostrarRespaldo = false;
}

async function verRanking() {
  pantalla = 'ranking'; ranking = null; mostrarRespaldo = false;
  const r = await api(`/ranking${yo ? `?yo=${encodeURIComponent(yo.id)}` : ''}`).catch(() => ({ ok: false }));
  if (pantalla === 'ranking') ranking = r.ok ? r.datos : { error: true };
}

const online = () => pantalla === 'online' || pantalla === 'amigo';

addEventListener('keydown', (e) => {
  if (pantalla === 'intro') { e.preventDefault(); terminarIntro(); return; }
  if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape') volverAlMenu(); return; }
  if (cuenta.abierto()) { if (e.code === 'Escape') volverAlMenu(); return; }
  if (DE_JUEGO.has(e.code)) e.preventDefault();
  sonido.despertar();
  apretadas.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyM') sonido.alternar();
  if (e.code === 'KeyB') alternarCamara();
  if (pantalla === 'menu') {
    // 1 o Enter: contra la máquina · 2: online con Elo · 3: sala con amigos · 4: ranking
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Digit1') empezar('bot');
    else if (e.code === 'Digit2') empezar('online');
    else if (e.code === 'Digit3') empezar('amigo');
    else if (e.code === 'Digit4') verRanking();
    return;
  }
  if (pantalla === 'ranking') { if (e.code === 'Escape' || e.code === 'Enter') volverAlMenu(); return; }
  const actual = vista();
  if (actual && actual.fase === 'fin' && (e.code === 'Enter' || e.code === 'NumpadEnter')) { revanchaAhora(); return; }
  if (confirmarSalida && (e.code === 'Enter' || e.code === 'KeyQ')) { salirDeOnline(); return; }
  if (e.code === 'Escape') {
    if (online()) { if (confirmarSalida) confirmarSalida = false; else salirDeOnline(); return; }   // online no se pausa: Esc sale (en rankeada, pregunta)
    pausa = !pausa;
  }
  if (pausa && e.code === 'KeyR') { pausa = false; revancha(estado); pintor.limpiarMarcas(); }
  if (pausa && e.code === 'KeyQ') volverAlMenu();
});
addEventListener('keyup', (e) => apretadas.delete(e.code));
addEventListener('blur', () => apretadas.clear());

// Desafiar a un amigo: se arma una sala nueva, se comparte (o copia) el link y te quedás esperando ahí.
function desafiar() {
  partidaEnCurso = null;
  volverAlMenu();
  empezar('amigo');
  evento({ t: 'comparte', que: 'sala' });
  copiar(location.href, true);
}

// Otra: en la rankeada busca un partido nuevo; con amigos, revancha; contra la máquina, de nuevo.
function revanchaAhora() {
  pintor.limpiarMarcas();
  if (pantalla === 'online') { empezar('online'); return; }
  if (red) red.revancha(); else revancha(estado);
  const modo = pantalla === 'bot' ? 'bot' : 'amigo';
  partidaEnCurso = { modo, desde: ahora() }; evento({ t: 'partida', modo });
}

// Toques y clics: botones dibujados en el canvas.
// cualquier toque saltea la intro (en captura, para que no apriete nada de abajo)
addEventListener('pointerdown', (e) => { if (pantalla === 'intro') { e.stopPropagation(); e.preventDefault(); terminarIntro(); } }, true);
canvas.addEventListener('pointerdown', (e) => {
  sonido.despertar();
  const id = pintor.botonEn(e.clientX, e.clientY);
  if (!id) return;
  if (id === 'bot' || id === 'online' || id === 'amigo') empezar(id);
  else if (id === 'ranking') verRanking();
  else if (id === 'cuenta') abrirCuenta();
  else if (id === 'menu') { if (online()) salirDeOnline(); else volverAlMenu(); }
  else if (id === 'irme') salirDeOnline();
  else if (id === 'quedarme') confirmarSalida = false;
  else if (id === 'otra') revanchaAhora();
  else if (id === 'desafiar') desafiar();
  else if (id === 'instalar') instalar();
  else if (id === 'idioma') cambiarIdioma();
  else if (id === 'copiar') copiar(location.href, true);
  else if (id === 'respaldo') mostrarRespaldo = !mostrarRespaldo;
  else if (id === 'copiarRespaldo') copiar(codigoRespaldo(), false);
  else if (id === 'restaurar') pedirRespaldo();
  else if (id === 'sonido') sonido.alternar();
  else if (id === 'camPelota') alternarCamara();
  else if (id === 'pausa') pausa = !pausa;
});

async function copiar(texto, compartir) {
  try {
    if (compartir && navigator.share && tactil) await navigator.share({ url: texto });
    else { await navigator.clipboard.writeText(texto); pintor.avisarCopiado(); }
  } catch { /* el usuario canceló */ }
}

function leer(i) {
  const t = TECLAS[i], e = {};
  for (const k in t) e[k] = t[k].some((c) => apretadas.has(c));
  return e;
}
// Se maneja con cualquiera de las dos manos del teclado o con el táctil.
function leerPropio(auto) {
  const a = leer(0), b = leer(1), t = tactil ? tactil.leer(auto, pintor.anguloCamara ? pintor.anguloCamara() : 0) : {};
  const e = {};
  for (const k of Object.keys(a)) e[k] = a[k] || b[k] || !!t[k];
  return e;
}

// La cámara sigue a tu auto: contra la máquina sos el azul; online, el lado que te tocó.
function aQuienSigo() {
  if (pantalla === 'bot' || pantalla === 'intro') return 0;
  if (online() && red && red.lado >= 0) return red.lado;
  return -1;
}

function vista() {
  if (online()) return red && red.estado;
  return estado;
}

function extras() {
  return {
    pantalla: pantalla === 'amigo' ? 'online' : pantalla,
    intro: pantalla === 'intro' ? (() => { const t = (ahora() - introDesde) / 1000; return t < LOGO_S ? { fase: 'logo', t } : { fase: 'cine', t: t - LOGO_S }; })() : null, nombres: pantalla === 'intro' ? RIVALES_INTRO : null, rankeada: pantalla === 'online', pausa, tactil: !!tactil, seguir: aQuienSigo(),
    yo, ranking, mostrarRespaldo, respaldo: codigoRespaldo(), camPelota, sonido: sonido.prendido(), instalable: !!instalable, idioma: IDIOMA,
    confirmarSalida: confirmarSalida && rankeadaEnJuego(), aviso: aviso && ahora() < aviso.hasta ? 'abandono' : null,
    red: red && { lado: red.lado, jugadores: red.jugadores, codigo: red.codigo, caido: red.caido, conectado: red.conectado, ping: red.ping,
      listo: !!red.estado, nombres: red.nombres, elo: red.elo, rankeada: pantalla === 'online' },
  };
}

// Paso fijo de 1/60 s, igual que el frameRate del SWF original.
const DT = 1000 / FPS;
let acumulado = 0, antes = ahora();
function cuadro(tAhora) {
  if (window.potrero && window.potrero.congelado) { antes = tAhora; if (!GRABAR) requestAnimationFrame(cuadro); return; }   // para pruebas
  acumulado += Math.min(250, tAhora - antes); antes = tAhora;
  while (acumulado >= DT) {
    if (pantalla === 'intro') pasoIntro();
    else if (pantalla === 'bot' && !pausa) {
      paso(estado, [leerPropio(estado.autos[0]), bot(estado)]);
      sonido.eventos(estado);
    } else if (online() && red) {
      const lado = red.lado >= 0 ? red.lado : 0;
      const s = red.tic(leerPropio(red.estado && red.estado.autos[lado]));
      if (s) sonido.eventos(s);
      if (red.sinIdentidad) { guardarYo(null); yo = null; abrirCuenta(() => empezar('online')); }
    }
    acumulado -= DT;
  }
  const s = online() && red ? red.vista() : vista();
  const jugando = pantalla === 'bot' || online();
  if (partidaEnCurso && s && s.fase === 'fin') {
    const lado = Math.max(0, aQuienSigo());
    evento({ t: 'fin', modo: partidaEnCurso.modo, res: s.ganador === lado ? 'gana' : 'pierde', dura: duracion(ahora() - partidaEnCurso.desde) });
    partidaEnCurso = null;
  }
  if (tactil) {
    tactil.mostrar(jugando && !pausa);
    const yoAuto = s && aQuienSigo() >= 0 ? s.autos[aQuienSigo()] : null;
    if (yoAuto) tactil.nitro(yoAuto.nitro);
  }
  sonido.motores(!jugando || pausa || !s ? null : s);
  pintor.dibujar(s || estado, extras());
  if (!GRABAR) requestAnimationFrame(cuadro);
}
// Instalable como app: el archivo sw.js guarda una copia para jugar sin internet y se actualiza solo.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
// En Android y en la compu el navegador avisa que se puede instalar: se muestra un botón discreto en la portada.
let instalable = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalable = e; });
addEventListener('appinstalled', () => { instalable = null; evento({ t: 'comparte', que: 'instalada' }); });
async function instalar() {
  if (!instalable) return;
  instalable.prompt();
  await instalable.userChoice.catch(() => null);
  instalable = null;
}
if (quiereIntro()) empezarIntro();
if (!GRABAR) { requestAnimationFrame(cuadro); visita(); }

// Si se entra con un link de sala, ir directo a esa sala (con amigos, sin Elo).
if (params.get('sala')) empezar('amigo');

// para pruebas automáticas desde la consola
window.potrero = {
  get estado() { return vista() || estado; }, get red() { return red; }, get pantalla() { return pantalla; },
  paso: (e) => paso(estado, e), empezar: (m = 'bot') => empezar(m), menu: volverAlMenu, ranking: verRanking, intro: () => empezarIntro(),
  avanzar: (ms) => { relojVirtual += ms; cuadro(relojVirtual); },
  leerPropio: () => leerPropio(vista() && vista().autos[Math.max(0, aQuienSigo())]),
  dibujar: () => pintor.dibujar((online() && red ? red.vista() : vista()) || estado, extras()),
};

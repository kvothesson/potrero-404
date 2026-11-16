// Panel "quién sos" del juego, encima del canvas: entrar con Google, con un código por mail,
// o jugar como invitado eligiendo solo un nombre. Casi sin palabras: íconos y campos.
// La lógica del servidor está en server/cuentas.js.
import { GOOGLE_CLIENT_ID } from './cuentas-config.js';

const SOBRE = '<svg viewBox="0 0 9 7" aria-hidden="true"><path d="M0 0h9v7H0z" fill="#e8e4ff"/><path d="M0 0l4.5 4L9 0" fill="none" stroke="#2a2448"/></svg>';
const PERSONA = '<svg viewBox="0 0 9 9" aria-hidden="true"><path d="M3 0h2v1h1v2H5v1H3V3H2V1h1zM1 4h6v1h1v1H7v1H6v2H5V7H4v2H3V7H2v2H1V6H0V5h1z" fill="#e8e4ff"/></svg>';

// api(ruta, cuerpo) → {ok, status, datos}; guardar(yo) recuerda la identidad en el navegador.
export function crearCuenta({ api, obtenerYo, guardar }) {
  const panel = document.createElement('div');
  panel.id = 'cuenta'; panel.className = 'oculto';
  panel.setAttribute('role', 'dialog');
  document.body.appendChild(panel);

  let alListo = null, pendiente = null, mail = '', googleListo = false;
  if (GOOGLE_CLIENT_ID) {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => entrar({ google: r.credential }) });
      googleListo = true;
      if (!panel.classList.contains('oculto')) pintar();
    };
    document.head.appendChild(sc);
  }

  const temblar = (el) => { el.classList.add('error'); setTimeout(() => el.classList.remove('error'), 500); };
  const fila = (html) => `<form class="fila">${html}</form>`;

  async function entrar(datos, nombre) {
    const yo = obtenerYo();
    const r = await api('/entrar', { ...datos, id: yo?.id, llave: yo?.llave, nombre }).catch(() => ({ ok: false, datos: {} }));
    if (r.datos.necesitaNombre) { pendiente = datos; pintar('nombre'); return true; }
    if (!r.ok) return false;
    guardar({ id: r.datos.id, llave: r.datos.llave, nombre: r.datos.nombre, cuentas: [...new Set([...(yo?.id === r.datos.id ? yo.cuentas || [] : []), r.datos.proveedor])] });
    pendiente = null;
    terminar();
    return true;
  }

  function terminar() {
    const f = alListo; cerrar();
    if (f) f();
  }

  // paso: 'inicio' | 'codigo' | 'nombre'
  function pintar(paso = 'inicio') {
    const yo = obtenerYo();
    let html = '';
    if (paso === 'codigo') {
      html = `<div class="titulo">${SOBRE}<span>${mail.replace(/[<>&"]/g, '')}</span></div>` +
        fila('<input id="cCodigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="······" aria-label="código"><button aria-label="entrar">✓</button>') +
        '<button class="chico" id="cVolver" aria-label="volver">←</button>';
    } else if (paso === 'nombre') {
      html = `<div class="titulo">${PERSONA}</div>` +
        fila('<input id="cNombre" maxlength="16" autocomplete="nickname" aria-label="nombre"><button aria-label="listo">✓</button>');
    } else {
      const ya = yo?.cuentas || [];
      if (yo) html += `<div class="titulo">${PERSONA}<span>${String(yo.nombre).replace(/[<>&"]/g, '')}</span>${ya.length ? '<b class="tilde">✓</b>' : ''}</div>`;
      if (GOOGLE_CLIENT_ID && !ya.includes('google')) html += '<div id="cGoogle" class="google"></div>';
      if (!ya.includes('mail')) html += fila(`<span class="ic">${SOBRE}</span><input id="cMail" type="email" autocomplete="email" placeholder="@" aria-label="mail"><button aria-label="mandar código">→</button>`);
      // invitado: solo un nombre, lo recuerda este navegador
      if (!yo) html += '<div class="o"></div>' + fila(`<span class="ic">${PERSONA}</span><input id="cNombre" maxlength="16" autocomplete="nickname" aria-label="jugar como invitado: nombre"><button aria-label="jugar">✓</button>`);
      if (yo && ya.length) html += '<button class="chico" id="cSalir" aria-label="salir en este navegador">⏏</button>';
    }
    panel.innerHTML = html;
    const g = panel.querySelector('#cGoogle');
    if (g && googleListo) window.google.accounts.id.renderButton(g, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width: 240 });
    else if (g) g.remove();

    panel.querySelectorAll('form').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = f.querySelector('button');
      if (boton.disabled) return;
      boton.disabled = true;
      try {
        const campo = f.querySelector('input');
        const v = campo.value.trim();
        let ok = true;
        if (campo.id === 'cMail') {
          const r = await api('/mail', { mail: v }).catch(() => ({ ok: false }));
          ok = r.ok; if (ok) { mail = v; pintar('codigo'); }
        } else if (campo.id === 'cCodigo') {
          ok = await entrar({ mail, codigo: v });
        } else if (campo.id === 'cNombre' && pendiente) {
          ok = v.length >= 2 && await entrar(pendiente, v);
        } else if (campo.id === 'cNombre') {
          // invitado
          ok = v.length >= 2;
          if (ok) {
            const r = await api('/registro', { nombre: v }).catch(() => ({ ok: false }));
            ok = r.ok;
            if (ok) { guardar({ id: r.datos.id, llave: r.datos.llave, nombre: r.datos.nombre, cuentas: [] }); terminar(); }
          }
        }
        if (!ok) temblar(f);
      } finally { boton.disabled = false; }
    }));
    panel.querySelector('#cVolver')?.addEventListener('click', () => pintar());
    panel.querySelector('#cSalir')?.addEventListener('click', () => { guardar(null); pintar(); });
    setTimeout(() => panel.querySelector('input')?.focus(), 30);
  }

  function abrir(despues) {
    alListo = despues || null; pendiente = null;
    panel.classList.remove('oculto');
    pintar();
  }
  function cerrar() { panel.classList.add('oculto'); panel.innerHTML = ''; alListo = null; }
  const abierto = () => !panel.classList.contains('oculto');

  // Al abrir el juego: si ya tenés id, se pregunta al servidor con qué cuentas está unido.
  async function refrescar() {
    const yo = obtenerYo();
    if (!yo?.id) return;
    const r = await api(`/yo?id=${encodeURIComponent(yo.id)}&llave=${encodeURIComponent(yo.llave)}`).catch(() => ({ ok: false }));
    if (r.ok) guardar({ ...yo, nombre: r.datos.nombre, cuentas: r.datos.cuentas || [] });
  }

  return { abrir, cerrar, abierto, refrescar };
}

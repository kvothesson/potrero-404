// Panel de cuenta del juego, encima del canvas. Una decisión por pantalla:
//   elegir  → Entrar (Google o mail) o Jugar como invitado
//   mail    → escribir el mail y pedir el código
//   codigo  → escribir el código que llegó
//   nombre  → elegir nombre (invitado, o cuenta nueva)
//   cuenta  → si ya jugás: con qué entraste, sumar otra forma, salir
// La lógica del servidor está en server/cuentas.js; los textos en src/idioma.js.
import { GOOGLE_CLIENT_ID } from './cuentas-config.js';
import { t, IDIOMA } from './idioma.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// api(ruta, cuerpo) → {ok, status, datos}; guardar(yo) recuerda la identidad en el navegador.
export function crearCuenta({ api, obtenerYo, guardar, alCerrar }) {
  const panel = document.createElement('div');
  panel.id = 'cuenta'; panel.className = 'oculto';
  panel.setAttribute('role', 'dialog');
  document.body.appendChild(panel);

  let alListo = null, pendiente = null, mail = '', googleListo = false, paso = 'elegir', error = '';
  if (GOOGLE_CLIENT_ID) {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => entrar({ google: r.credential }) });
      googleListo = true;
      if (abierto()) pintar();
    };
    document.head.appendChild(sc);
  }

  const ir = (p, e = '') => { paso = p; error = e; pintar(); };
  const mensajeError = (r) => t(`e_${(r && r.datos && r.datos.error) || 'servidor'}`);

  async function entrar(datos, nombre) {
    const yo = obtenerYo();
    const r = await api('/entrar', { ...datos, id: yo?.id, llave: yo?.llave, nombre }).catch(() => ({ ok: false, datos: {} }));
    if (r.datos.necesitaNombre) { pendiente = datos; ir('nombre'); return; }
    if (!r.ok) { ir(datos.mail ? 'codigo' : paso, mensajeError(r)); return; }
    const antes = yo?.id === r.datos.id ? yo.cuentas || [] : [];
    guardar({ id: r.datos.id, llave: r.datos.llave, nombre: r.datos.nombre, cuentas: [...new Set([...antes, r.datos.proveedor])] });
    pendiente = null;
    terminar();
  }
  function terminar() { const f = alListo; cerrar(); if (f) f(); }

  const opcionesEntrar = (ya = []) =>
    (GOOGLE_CLIENT_ID && googleListo && !ya.includes('google') ? '<div id="cGoogle" class="google"></div>' : '') +
    (!ya.includes('mail') ? `<button class="btn verde" data-ir="mail">✉ ${t('conMail')}</button>` : '');

  function pintar() {
    const yo = obtenerYo();
    let html = `<button class="x" id="cCerrar" aria-label="${t('cerrar')}">×</button>`;
    if (paso === 'elegir') {
      html += `<h2>${t('comoJugar')}</h2>
        <section class="opcion fuerte"><h3>${t('entrar')}</h3><p>${t('entrarSub')}</p>${opcionesEntrar()}</section>
        <button class="opcion" data-ir="nombre"><h3>${t('invitado')}</h3><p>${t('invitadoSub')}</p></button>`;
    } else if (paso === 'mail') {
      html += `<h2>${t('mailTitulo')}</h2><p>${t('mailSub')}</p>
        <form id="f"><input id="v" type="email" autocomplete="email" placeholder="${t('mailEj')}" value="${esc(mail)}"><button class="btn verde">${t('mandar')}</button></form>
        <button class="volver" data-ir="${yo ? 'cuenta' : 'elegir'}">${t('volver')}</button>`;
    } else if (paso === 'codigo') {
      html += `<h2>${t('revisa')}</h2><p>${t('revisaSub', { mail: `<b>${esc(mail)}</b>` })}</p>
        <form id="f"><input id="v" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" class="codigo"><button class="btn verde">${t('entrar')}</button></form>
        <button class="volver" data-ir="mail">${t('volver')}</button>`;
    } else if (paso === 'nombre') {
      html += `<h2>${t('nombreTitulo')}</h2><p>${t('nombreSub')}</p>
        <form id="f"><input id="v" maxlength="16" autocomplete="nickname" placeholder="${t('nombreEj')}"><button class="btn verde">${pendiente ? t('listo') : t('jugar')}</button></form>
        <button class="volver" data-ir="${pendiente ? 'elegir' : yo ? 'cuenta' : 'elegir'}">${t('volver')}</button>`;
    } else if (paso === 'cuenta' && yo) {
      const ya = yo.cuentas || [];
      const con = ya.map((p) => (p === 'google' ? t('google') : t('tuMail'))).join(t('y'));
      const mas = opcionesEntrar(ya);
      html += `<h2>${t('tuCuenta')}: ${esc(yo.nombre)}</h2>
        <p>${ya.length ? t('unida', { x: con }) : t('sinUnir')}</p>
        ${mas ? (ya.length ? `<p>${t('otraForma')}</p>` : '') + mas : ''}
        ${ya.length ? `<button class="volver" id="cSalir">${t('salir')}</button>` : ''}`;
    }
    if (error) html += `<p class="error">${esc(error)}</p>`;
    panel.innerHTML = html;

    const g = panel.querySelector('#cGoogle');
    if (g) window.google.accounts.id.renderButton(g, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(400, g.clientWidth || 300), locale: IDIOMA });
    panel.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));
    panel.querySelector('#cCerrar').addEventListener('click', () => { cerrar(); if (alCerrar) alCerrar(); });
    panel.querySelector('#cSalir')?.addEventListener('click', () => { guardar(null); ir('elegir'); });

    const f = panel.querySelector('#f');
    if (f) {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const boton = f.querySelector('button');
        if (boton.disabled) return;
        boton.disabled = true;
        const v = f.querySelector('input').value.trim();
        try {
          if (paso === 'mail') {
            const r = await api('/mail', { mail: v }).catch(() => ({ ok: false, datos: {} }));
            if (r.ok) { mail = v; ir('codigo'); } else ir('mail', mensajeError(r));
          } else if (paso === 'codigo') {
            await entrar({ mail, codigo: v });
          } else if (paso === 'nombre') {
            if (v.length < 2) { ir('nombre', t('e_nombre')); return; }
            if (pendiente) { await entrar(pendiente, v); return; }
            const r = await api('/registro', { nombre: v }).catch(() => ({ ok: false, datos: {} }));
            if (!r.ok) { ir('nombre', mensajeError(r)); return; }
            guardar({ id: r.datos.id, llave: r.datos.llave, nombre: r.datos.nombre, cuentas: [] });
            terminar();
          }
        } finally { boton.disabled = false; }
      });
      setTimeout(() => f.querySelector('input')?.focus(), 30);
    }
  }

  function abrir(despues) {
    alListo = despues || null; pendiente = null;
    panel.classList.remove('oculto');
    ir(obtenerYo() ? 'cuenta' : 'elegir');
  }
  function cerrar() { panel.classList.add('oculto'); panel.innerHTML = ''; alListo = null; }
  function abierto() { return !panel.classList.contains('oculto'); }

  // Al abrir el juego: si ya tenés id, se pregunta al servidor con qué cuentas está unido.
  async function refrescar() {
    const yo = obtenerYo();
    if (!yo?.id) return;
    const r = await api(`/yo?id=${encodeURIComponent(yo.id)}&llave=${encodeURIComponent(yo.llave)}`).catch(() => ({ ok: false }));
    if (r.ok) guardar({ ...yo, nombre: r.datos.nombre, cuentas: r.datos.cuentas || [] });
  }

  return { abrir, cerrar, abierto, refrescar };
}

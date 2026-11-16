// Cuentas de Potrero 404: entrar con Google o con un código que llega por mail.
// No hay contraseñas. Igual para el servidor local y para Cloudflare.
//
// Qué se guarda: ni el mail ni el nombre de Google. Solo una huella (HMAC con una sal secreta del
// servidor) del mail o del número de cuenta de Google, para reconocerte la próxima vez.
// Al entrar, el navegador recibe una llave nueva (como antes): cada dispositivo tiene la suya.
import { GOOGLE_CLIENT_ID } from '../src/cuentas-config.js';

export const ESQUEMA_CUENTAS = `
CREATE TABLE IF NOT EXISTS cuentas (
  proveedor TEXT NOT NULL,
  huella TEXT NOT NULL,
  jugador TEXT NOT NULL,
  creado TEXT NOT NULL,
  PRIMARY KEY (proveedor, huella)
);
CREATE TABLE IF NOT EXISTS llaves (
  llave_hash TEXT PRIMARY KEY,
  jugador TEXT NOT NULL,
  creado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS limites (
  clave TEXT PRIMARY KEY,
  ventana INTEGER NOT NULL,
  n INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codigos (
  huella TEXT PRIMARY KEY,
  codigo_hash TEXT NOT NULL,
  vence INTEGER NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  pedidos INTEGER NOT NULL DEFAULT 1,
  ultimo INTEGER NOT NULL,
  dia TEXT NOT NULL
);
`;

const MIN = 60_000;
const VIDA_CODIGO = 15 * MIN;
const INTENTOS = 5;          // errores permitidos por código
const POR_DIA = 6;           // códigos por mail por día
const ENTRE_PEDIDOS = MIN;   // espera entre dos códigos al mismo mail
const TOPE_HORA = 100;       // mails por hora en total (para que nadie gaste la cuota)

const ahora = () => new Date().toISOString();
const enc = new TextEncoder();
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
export async function hash(texto) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(texto))); }
async function hmac(sal, texto) {
  const k = await crypto.subtle.importKey('raw', enc.encode(sal), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
}
const LETRAS = 'abcdefghijkmnpqrstuvwxyz23456789';
export function azarTexto(n) {
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  return Array.from(b, (x) => LETRAS[x % LETRAS.length]).join('');
}
function codigo6() {
  const b = new Uint32Array(1); crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6, '0');
}

export function limpiarMail(m) {
  const s = String(m || '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(s) && s.length <= 254 ? s : null;
}

// ---------- Google: verificar el token que da el botón "Acceder con Google" ----------
let clavesGoogle = null;
async function traerClavesGoogle() {
  if (clavesGoogle && clavesGoogle.vence > Date.now()) return clavesGoogle.keys;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const d = await r.json();
  clavesGoogle = { keys: d.keys, vence: Date.now() + 60 * MIN };
  return d.keys;
}
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

// Devuelve el número de cuenta de Google (sub) si el token es válido, o null.
export async function verificarGoogle(token, { clientId = GOOGLE_CLIENT_ID, claves = traerClavesGoogle, ahoraS = Date.now() / 1000 } = {}) {
  if (!clientId || typeof token !== 'string' || token.length > 4096) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  let cab, datos;
  try { cab = JSON.parse(new TextDecoder().decode(b64url(partes[0]))); datos = JSON.parse(new TextDecoder().decode(b64url(partes[1]))); } catch { return null; }
  if (cab.alg !== 'RS256') return null;
  const jwk = (await claves()).find((k) => k.kid === cab.kid);
  if (!jwk) return null;
  const clave = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, b64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`));
  if (!ok) return null;
  if (datos.aud !== clientId) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(datos.iss)) return null;
  if (!(datos.exp > ahoraS)) return null;
  return datos.sub ? String(datos.sub) : null;
}

// ---------- Límite por conexión ----------
// Cuántas veces por hora puede hacer cada cosa una misma conexión. No se guarda la IP:
// solo una huella con la sal secreta, que se borra sola al pasar la hora.
export const LIMITES = { registro: 8, mail: 6, entrar: 30, evento: 240 };
export async function dentroDelLimite(db, sal, que, ip) {
  const tope = LIMITES[que];
  if (!tope) return true;
  const ventana = Math.floor(Date.now() / 3_600_000);
  const clave = `${que}:${await hmac(sal, `ip:${ip || 'sin-ip'}`)}`;
  const f = await db.una(`SELECT ventana, n FROM limites WHERE clave = ?`, clave);
  if (f && f.ventana === ventana && f.n >= tope) return false;
  if (f && f.ventana === ventana) await db.correr(`UPDATE limites SET n = n + 1 WHERE clave = ?`, clave);
  else await db.correr(`INSERT OR REPLACE INTO limites (clave, ventana, n) VALUES (?, ?, 1)`, clave, ventana);
  if (Math.random() < 0.02) await db.correr(`DELETE FROM limites WHERE ventana < ?`, ventana);   // limpieza de vez en cuando
  return true;
}

// ---------- Anti-bots de Cloudflare (Turnstile) al pedir un código por mail ----------
// cfg.turnstile = clave secreta; sin clave (en la PC) no se pide.
export async function verificarHumano(cfg, token, ip) {
  if (!cfg.turnstile) return true;
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const f = new FormData();
  f.append('secret', cfg.turnstile); f.append('response', token);
  if (ip) f.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f });
    const d = await r.json();
    return !!d.success;
  } catch { return false; }
}

// ---------- Mail: pedir un código ----------
// cfg = { sal, enviarMail(mail, codigo) }
export async function pedirCodigo(db, cfg, mailCrudo) {
  const mail = limpiarMail(mailCrudo);
  if (!mail) return { error: 'mail' };
  const huella = await hmac(cfg.sal, `mail:${mail}`);
  const t = Date.now(), dia = new Date(t).toISOString().slice(0, 10);
  const previo = await db.una(`SELECT pedidos, ultimo, dia FROM codigos WHERE huella = ?`, huella);
  if (previo && t - previo.ultimo < ENTRE_PEDIDOS) return { error: 'espera', segundos: Math.ceil((ENTRE_PEDIDOS - (t - previo.ultimo)) / 1000) };
  const pedidos = previo && previo.dia === dia ? previo.pedidos + 1 : 1;
  if (pedidos > POR_DIA) return { error: 'muchos' };
  const r = await db.una(`SELECT COUNT(*) AS n FROM codigos WHERE ultimo > ?`, t - 60 * MIN);
  if (r && r.n >= TOPE_HORA) return { error: 'muchos' };
  const codigo = codigo6();
  await db.correr(`INSERT OR REPLACE INTO codigos (huella, codigo_hash, vence, intentos, pedidos, ultimo, dia) VALUES (?, ?, ?, 0, ?, ?, ?)`,
    huella, await hash(`${huella}:${codigo}`), t + VIDA_CODIGO, pedidos, t, dia);
  const enviado = await cfg.enviarMail(mail, codigo).catch(() => false);
  if (!enviado) return { error: 'envio' };
  return { ok: true };
}

async function usarCodigo(db, cfg, mailCrudo, codigo) {
  const mail = limpiarMail(mailCrudo);
  if (!mail || !/^\d{6}$/.test(String(codigo || ''))) return { error: 'codigo' };
  const huella = await hmac(cfg.sal, `mail:${mail}`);
  const c = await db.una(`SELECT codigo_hash, vence, intentos FROM codigos WHERE huella = ?`, huella);
  if (!c || c.vence < Date.now() || c.intentos >= INTENTOS) return { error: 'vencido' };
  if (c.codigo_hash !== await hash(`${huella}:${codigo}`)) {
    await db.correr(`UPDATE codigos SET intentos = intentos + 1 WHERE huella = ?`, huella);
    return { error: 'codigo', quedan: INTENTOS - c.intentos - 1 };
  }
  return { huella, gastar: () => db.correr(`UPDATE codigos SET vence = 0 WHERE huella = ?`, huella) };
}

// ---------- Entrar ----------
// cuerpo: { google } o { mail, codigo }; opcional { id, llave } (quién sos en este navegador) y { nombre }.
// - Si la cuenta ya existe: entrás como ese jugador (llave nueva para este navegador).
// - Si no existe y este navegador ya jugaba: la cuenta queda unida a ese jugador (conservás el puesto).
// - Si no existe y es la primera vez: hace falta un nombre → { necesitaNombre: true }.
export async function entrar(db, cfg, cuerpo, { verificar, crearJugador }) {
  let proveedor, huella, gastar = async () => {};
  if (cuerpo.google) {
    const sub = await (cfg.verificarGoogle || verificarGoogle)(cuerpo.google);
    if (!sub) return { error: 'google' };
    proveedor = 'google'; huella = await hmac(cfg.sal, `google:${sub}`);
  } else if (cuerpo.mail) {
    const u = await usarCodigo(db, cfg, cuerpo.mail, cuerpo.codigo);
    if (u.error) return u;
    proveedor = 'mail'; huella = u.huella; gastar = u.gastar;
  } else return { error: 'datos' };

  const cuenta = await db.una(`SELECT jugador FROM cuentas WHERE proveedor = ? AND huella = ?`, proveedor, huella);
  let jugadorId = cuenta && cuenta.jugador;
  let nuevaLlave = true;
  if (!jugadorId) {
    const actual = await verificar(db, cuerpo.id, cuerpo.llave);
    if (actual) { jugadorId = actual.id; nuevaLlave = false; }
    else {
      if (!cuerpo.nombre) return { necesitaNombre: true };
      const j = await crearJugador(db, cuerpo.nombre);
      if (j.error) return j;
      jugadorId = j.id;
    }
    await db.correr(`INSERT INTO cuentas (proveedor, huella, jugador, creado) VALUES (?, ?, ?, ?)`, proveedor, huella, jugadorId, ahora());
  }
  await gastar();
  let llave = cuerpo.llave;
  if (nuevaLlave) {
    llave = azarTexto(20);
    await db.correr(`INSERT INTO llaves (llave_hash, jugador, creado) VALUES (?, ?, ?)`, await hash(llave), jugadorId, ahora());
  }
  const j = await db.una(`SELECT id, nombre, elo FROM jugadores WHERE id = ?`, jugadorId);
  return { id: j.id, llave, nombre: j.nombre, elo: j.elo, proveedor };
}

// Con qué cuentas está unido un jugador (para mostrar "entraste con Google").
export async function cuentasDe(db, jugadorId) {
  const filas = await db.todas(`SELECT proveedor FROM cuentas WHERE jugador = ?`, String(jugadorId));
  return [...new Set(filas.map((f) => f.proveedor))];
}

// ---------- Mandar el mail (Resend, por su API) ----------
export function mailResend(clave, remitente = 'Potrero 404 <potrero@kvothesson.com>') {
  return async (mail, codigo) => {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: remitente, to: [mail], subject: `${codigo} es tu código de Potrero 404`,
        text: `Tu código para entrar a Potrero 404 es ${codigo}.\n\nVence en 15 minutos. Si no lo pediste, ignorá este mail.\n\nhttps://kvothesson.com/potrero-404/`,
        html: `<div style="font-family:system-ui,sans-serif;background:#1c1830;color:#e8e4ff;padding:24px"><p>Tu código para entrar a <b>Potrero 404</b>:</p><p style="font:700 32px ui-monospace,monospace;letter-spacing:6px;color:#fff4b0">${codigo}</p><p style="color:#8a84b0">Vence en 15 minutos. Si no lo pediste, ignorá este mail.</p></div>`,
      }),
    });
    return r.ok;
  };
}

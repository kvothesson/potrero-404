// Métricas de Potrero 404: solo contadores por día, sin nada que identifique a nadie.
// El navegador manda eventos sueltos (POST /evento) y acá se suman en la tabla metricas.
// Solo se aceptan las claves de la lista, así nadie puede llenar la base de basura.

export const ESQUEMA_METRICAS = `
CREATE TABLE IF NOT EXISTS metricas (
  dia TEXT NOT NULL,
  clave TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, clave)
);
`;

const MODOS = ['bot', 'online', 'amigo'];
const DISP = ['celu', 'compu'];
const IDIOMAS = ['es', 'en', 'pt'];
const VUELTAS = ['1', '2a7', '8a30', 'mas30'];
const DURAS = ['menos1', '1a3', '3a6', 'mas6'];

// Arma la clave a partir del evento, o null si no es válido.
export function clave(e) {
  if (!e || typeof e !== 'object') return null;
  const de = (lista, v) => (lista.includes(v) ? v : null);
  switch (e.t) {
    case 'visita': {
      const d = de(DISP, e.disp), i = de(IDIOMAS, e.idioma);
      if (!d || !i) return null;
      if (e.vuelta === 'nuevo') return `visita:nuevo:${d}:${i}`;
      const v = de(VUELTAS, e.vuelta);
      return v ? `visita:vuelve:${v}:${d}:${i}` : `visita:hoy:${d}:${i}`;   // otra vez el mismo día
    }
    case 'partida': { const m = de(MODOS, e.modo); return m ? `partida:${m}` : null; }
    case 'fin': {
      const m = de(MODOS, e.modo), r = de(['gana', 'pierde'], e.res), du = de(DURAS, e.dura);
      return m && r && du ? `fin:${m}:${r}:${du}` : null;
    }
    case 'abandono': { const m = de(MODOS, e.modo); return m ? `abandono:${m}` : null; }
    case 'cuenta': { const c = de(['invitado', 'google', 'mail'], e.con); return c ? `cuenta:${c}` : null; }
    case 'origen': {
      // marcas propias de los links (?de=yt): cortas, solo letras, números y guion
      if (typeof e.de === 'string' && /^de-[a-z0-9-]{1,12}$/.test(e.de)) return `origen:${e.de}`;
      // dominio de la página que nos embebe (en-) o que trae el link (ref-)
      if (typeof e.de === 'string' && /^(en|ref)-[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e.de) && e.de.length <= 44) return `origen:${e.de}`;
      const o = de(['directo', 'itch', 'gamejolt', 'newgrounds', 'otro'], e.de); return o ? `origen:${o}` : null;
    }
    case 'comparte': { const q = de(['sala', 'resultado', 'instalada'], e.que); return q ? `comparte:${q}` : null; }
    default: return null;
  }
}

export async function sumar(db, evento, hoy = new Date().toISOString().slice(0, 10)) {
  const k = clave(evento);
  if (!k) return false;
  await db.correr(`INSERT INTO metricas (dia, clave, n) VALUES (?, ?, 1) ON CONFLICT(dia, clave) DO UPDATE SET n = n + 1`, hoy, k);
  return true;
}

// Resumen de los últimos días para la página de métricas.
export async function resumen(db, dias = 30) {
  const desde = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);
  const filas = await db.todas(`SELECT dia, clave, n FROM metricas WHERE dia >= ? ORDER BY dia`, desde);
  const online = await db.todas(`SELECT substr(fecha, 1, 10) AS dia, COUNT(*) AS n,
      SUM(CASE WHEN azul LIKE 'ia-%' OR rojo LIKE 'ia-%' THEN 1 ELSE 0 END) AS conIA, SUM(abandono) AS abandonos
    FROM partidas WHERE fecha >= ? GROUP BY dia ORDER BY dia`, desde);
  const jugadores = await db.una(`SELECT COUNT(*) AS total, SUM(CASE WHEN partidas > 0 THEN 1 ELSE 0 END) AS jugaron FROM jugadores WHERE es_ia = 0`);
  return { desde, filas, online, jugadores };
}

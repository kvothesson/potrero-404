// Saca los datos del día para las fichas de los cortos y los deja en cortos/datos.json.
//   node cortos/datos.mjs [servidor]
// Por corredor: Elo, puesto en la tabla, partidos de la liga y partidos contra humanos
// (los que jugó en total menos los de la liga). Si la liga ya tiene más partidos de los que
// devuelve /liga, los de contra humanos quedan sin dato en vez de inventarlos.
import { writeFileSync } from 'node:fs';

const servidor = process.argv[2] || 'https://potrero-404.kvothesson.workers.dev';
const leer = async (ruta) => { const r = await fetch(servidor + ruta); if (!r.ok) throw new Error(`${ruta}: ${r.status}`); return r.json(); };
const [liga, ranking] = await Promise.all([leer('/liga?n=50'), leer('/ranking')]);

const totalLiga = liga.porDia.reduce((a, d) => a + d.partidos, 0);
const completa = totalLiga <= liga.ultimos.length;
const ias = liga.ias.map((ia) => {
  const mios = liga.ultimos.filter((p) => p.azul.nombre === ia.nombre || p.rojo.nombre === ia.nombre);
  const ganados = mios.filter((p) => (p.ganador === 0 ? p.azul : p.rojo).nombre === ia.nombre).length;
  const fila = ranking.lista.find((f) => f.nombre === ia.nombre);
  return {
    nombre: ia.nombre, elo: ia.elo, puesto: fila ? fila.puesto : null,
    liga: completa ? { partidas: mios.length, victorias: ganados } : null,
    humanos: completa ? { partidas: ia.partidas - mios.length, victorias: ia.victorias - ganados } : null,
  };
});
const datos = {
  fecha: new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }), servidor,
  humanos: ranking.lista.filter((f) => !f.ia).length,
  partidosLiga: totalLiga, ias,
};
writeFileSync(new URL('./datos.json', import.meta.url), JSON.stringify(datos, null, 2));
console.log(JSON.stringify(datos, null, 2));

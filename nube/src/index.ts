// Servidor online en Cloudflare. Cada código de sala es un Durable Object: ahí vive la partida,
// corre la simulación a 60 cuadros por segundo y les manda el estado a los jugadores.
// La lógica es la misma que usa el servidor local: server/sala.js, server/api.js y server/ranking.js.
import { DurableObject } from "cloudflare:workers";
// @ts-ignore: módulos JavaScript compartidos con el juego
import { crearSala, ESPERA_IA } from "../../server/sala.js";
// @ts-ignore
import { api, crearFila, cabecerasCors } from "../../server/api.js";
// @ts-ignore
import { preparar, verificar, elegirIA, anotar } from "../../server/ranking.js";
// @ts-ignore
import { mailResend } from "../../server/cuentas.js";

// SAL, RESEND y TURNSTILE son secretos: se suben con `cf deploy --secrets-file` (ver README).
type Env = { DB: any; SAL?: string; RESEND?: string; TURNSTILE?: string; METRICAS?: string };
const cuentas = (env: Env) => ({
	listo: !!(env.SAL && env.RESEND),
	sal: env.SAL || "",
	turnstile: env.TURNSTILE || "",
	metricas: env.METRICAS || "",
	enviarMail: env.RESEND ? mailResend(env.RESEND) : async () => false,
});

// D1 con la interfaz que espera server/ranking.js
function base(env: Env) {
	const p = (sql: string, params: unknown[]) => env.DB.prepare(sql).bind(...params);
	return {
		todas: async (sql: string, ...params: unknown[]) => (await p(sql, params).all()).results,
		una: async (sql: string, ...params: unknown[]) => await p(sql, params).first(),
		correr: async (sql: string, ...params: unknown[]) => await p(sql, params).run(),
	};
}
let preparada = false;
async function db(env: Env) {
	const d = base(env);
	if (!preparada) { await preparar(d); preparada = true; }
	return d;
}

export class Sala extends DurableObject<Env> {
	sala: any = null;
	reloj: ReturnType<typeof setInterval> | null = null;

	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const rankeada = url.searchParams.get("rank") === "1";
		const d = await db(this.env);
		// quién sos: obligatorio en la rankeada; en una sala con amigos solo sirve para el nombre
		const jugador = await verificar(d, url.searchParams.get("id"), url.searchParams.get("llave"));
		const par = new WebSocketPair();
		const [cliente, servidor] = Object.values(par);
		servidor.accept();
		if (rankeada && !jugador) {
			servidor.send(JSON.stringify({ t: "sinIdentidad" }));
			servidor.close(1008, "sin identidad");
			return new Response(null, { status: 101, webSocket: cliente });
		}
		if (!this.sala) {
			this.sala = crearSala({
				fisica: url.searchParams.get("fisica"), rankeada,
				pedirIA: (elo: number) => elegirIA(d, elo),
				alTerminar: (r: unknown) => anotar(d, r),
			});
		}
		const con = { enviar: (t: string) => servidor.send(t), jugador: jugador || null };
		this.sala.entrar(con);
		servidor.addEventListener("message", (e) => {
			if (typeof e.data === "string" && e.data.length < 512) this.sala?.mensaje(con, e.data);
		});
		const cerrar = () => {
			if (!this.sala) return;
			this.sala.salir(con);
			if (this.sala.vacia) {
				if (this.reloj) clearInterval(this.reloj);
				this.reloj = null;
				this.sala = null;
			}
		};
		servidor.addEventListener("close", cerrar);
		servidor.addEventListener("error", cerrar);
		if (!this.reloj) this.reloj = setInterval(() => this.sala?.avanzar(Date.now()), 8);
		return new Response(null, { status: 101, webSocket: cliente });
	}
}

// Una sola Fila para todo el mundo: junta a los que buscan una rankeada casi a la vez.
export class Fila extends DurableObject<Env> {
	buscar = crearFila(ESPERA_IA - 500);
	async codigo(): Promise<string> { return this.buscar(Date.now()); }
}

export default {
	async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === "/sala") {
			if (req.headers.get("Upgrade") !== "websocket") return new Response("Esperaba un WebSocket.", { status: 426 });
			const codigo = (url.searchParams.get("codigo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
			if (!codigo) return new Response("Falta el código de sala.", { status: 400 });
			const sala = ctx.exports.Sala.get(ctx.exports.Sala.idFromName(codigo));
			return sala.fetch(req);
		}
		const fila = ctx.exports.Fila.get(ctx.exports.Fila.idFromName("global"));
		if (!(env.SAL && env.RESEND) && ['/mail', '/entrar'].includes(url.pathname)) return new Response(JSON.stringify({ error: 'sinConfigurar' }), { status: 503, headers: { 'content-type': 'application/json', ...cabecerasCors(req) } });
		const r = await api(req, { db: await db(env), buscar: () => fila.codigo(), cuentas: cuentas(env) });
		if (r) return r;
		return new Response("Potrero 404: servidor de salas. El juego está en https://kvothesson.com/potrero-404/", {
			headers: { "content-type": "text/plain; charset=utf-8", ...cabecerasCors(req) },
		});
	},
};

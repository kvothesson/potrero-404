// Salas online en Cloudflare. Cada código de sala es un Durable Object: ahí vive la partida,
// corre la simulación a 60 cuadros por segundo y les manda el estado a los jugadores.
// La lógica de la sala es la misma que usa el servidor local (server/sala.js).
import { DurableObject } from "cloudflare:workers";
// @ts-ignore: módulo JavaScript compartido con el juego
import { crearSala } from "../../server/sala.js";

type Conexion = { enviar: (t: string) => void; lado?: number };

export class Sala extends DurableObject {
	sala: any = null;
	reloj: ReturnType<typeof setInterval> | null = null;

	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);
		if (!this.sala) this.sala = crearSala({ fisica: url.searchParams.get("fisica") });
		const par = new WebSocketPair();
		const [cliente, servidor] = Object.values(par);
		servidor.accept();
		const con: Conexion = { enviar: (t) => servidor.send(t) };
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

export default {
	async fetch(req: Request, _env: unknown, ctx: any): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === "/sala") {
			if (req.headers.get("Upgrade") !== "websocket") return new Response("Esperaba un WebSocket.", { status: 426 });
			const codigo = (url.searchParams.get("codigo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
			if (!codigo) return new Response("Falta el código de sala.", { status: 400 });
			const sala = ctx.exports.Sala.get(ctx.exports.Sala.idFromName(codigo));
			return sala.fetch(req);
		}
		return new Response("Potrero 404: servidor de salas. El juego está en https://kvothesson.com/potrero-404/", {
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	},
};

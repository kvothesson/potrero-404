// Servidor de salas online de Potrero 404 en Cloudflare: un Worker que recibe las conexiones
// y un Durable Object por sala que corre la partida (la misma sala de server/sala.js).
import { defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "potrero-404",
		compatibilityDate: "2026-11-13",
		compatibilityFlags: ["enable_ctx_exports"],
		entrypoint,
		exports: {
			Sala: exports.durableObject({ storage: "sqlite" }),
		},
	},
});

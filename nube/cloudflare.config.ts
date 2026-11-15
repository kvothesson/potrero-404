// Servidor online de Potrero 404 en Cloudflare:
// - un Worker con la API del ranking (registro, tabla, buscar rival),
// - un Durable Object por sala que corre la partida (la misma sala de server/sala.js),
// - un Durable Object "Fila" que junta a los que buscan una rankeada,
// - la base D1 del ranking (con restauración de los últimos 30 días incluida).
import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "potrero-404",
		compatibilityDate: "2026-11-13",
		compatibilityFlags: ["enable_ctx_exports"],
		entrypoint,
		exports: {
			Sala: exports.durableObject({ storage: "sqlite" }),
			Fila: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			DB: bindings.d1({ id: "ff95dd60-56e8-4e55-8525-e392dbcfb04a", name: "potrero-404-ranking" }),
		},
	},
});

// TapCanvas API — Vercel Serverless entry (Node runtime).
// Wraps the standalone Hono app (createTapCanvasApp) with the worker env
// (createNodeWorkerEnv, which requires DATABASE_URL) as a Vercel function.
//
// NOTE: This runs as a serverless function, NOT a long-lived server.
// Background BullMQ workers are NOT started here (Vercel has no long-running
// processes). Core REST/HTTP API works; some async job features may be limited.
//
// Routing: Vercel routes forward "/<path>" -> "/api?_path=<path>" so the
// original request path is preserved here via the _path query param.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createTapCanvasApp } from "../apps/hono-api/src/app";
import { createNodeWorkerEnv } from "../apps/hono-api/src/platform/node/node-env";

interface Bootstrap {
	app: any;
	env: any;
}

let cached: Bootstrap | null = null;
let bootErr: Error | null = null;

async function bootstrap(): Promise<Bootstrap> {
	if (cached) return cached;
	if (bootErr) throw bootErr;
	try {
		const app = await createTapCanvasApp();
		const env = await createNodeWorkerEnv();
		cached = { app, env };
		return cached;
	} catch (e) {
		bootErr = e instanceof Error ? e : new Error(String(e));
		throw bootErr;
	}
}

function readBody(req: IncomingMessage): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c as Buffer));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

export const config = {
	api: {
		external: true,
		bodyParser: false,
	},
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
	try {
		const { app, env } = await bootstrap();

		const method = (req.method || "GET").toUpperCase();
		const host = (req.headers.host as string) || "localhost";
		const proto = (req.headers["x-forwarded-proto"] as string) || "https";

		// Original path is forwarded via _path query param by vercel.json routes.
		const fullUrl = new URL(req.url || "/", `${proto}://${host}`);
		let urlPath = fullUrl.searchParams.get("_path") || fullUrl.pathname || "/";
		if (!urlPath.startsWith("/")) urlPath = "/" + urlPath;
		const url = `${proto}://${host}${urlPath}`;

		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) {
			if (value === undefined) continue;
			if (Array.isArray(value)) {
				value.forEach((v) => headers.append(key, v));
			} else {
				headers.set(key, value);
			}
		}

		let body: BodyInit | undefined;
		if (method !== "GET" && method !== "HEAD") {
			body = await readBody(req);
		}

		const request = new Request(url, { method, headers, body });
		const response = await app.fetch(request, env);

		res.statusCode = response.status;
		response.headers.forEach((value: string, key: string) => {
			res.setHeader(key, value);
		});
		const buf = Buffer.from(await response.arrayBuffer());
		res.end(buf);
	} catch (err: any) {
		// eslint-disable-next-line no-console
		console.error("[vercel-api] handler error:", err);
		if (!res.headersSent) {
			res.statusCode = 500;
			res.setHeader("content-type", "application/json");
			res.end(
				JSON.stringify({
					ok: false,
					error: "backend_bootstrap_failed",
					message: err?.message || String(err),
				}),
			);
		} else {
			res.end();
		}
	}
}

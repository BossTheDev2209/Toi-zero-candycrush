import { Hono } from "hono";

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 8787);
console.log(`TOIZero server listening on http://localhost:${port}`);
export default { fetch: app.fetch, port };

import { Hono } from "hono";
import { cors } from "hono/cors";
import { openDb } from "./db/client";
import { loadConfig } from "./config";
import { problemsRouter } from "./api/problems";
import { solutionsRouter } from "./api/solutions";
import { runsRouter } from "./api/runs";
import { toiRouter } from "./api/toi";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const cfg = loadConfig();
const root = (cfg as unknown as { _root: string })._root ?? process.cwd();
const resolveRoot = (p: string) => (isAbsolute(p) ? p : join(root, p));

const dataDir = resolveRoot(cfg.dataDir);
const dbPath = resolveRoot(cfg.dbPath);

mkdirSync(dataDir, { recursive: true });
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);

const app = new Hono();
app.use("/api/*", cors({ origin: (o) => o ?? "*", credentials: true }));
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/problems", problemsRouter(db));
app.route("/api/solutions", solutionsRouter(db));
app.route("/api/runs", runsRouter(db));
app.route("/api/toi", toiRouter(db, cfg));

const port = cfg.apiPort;
console.log(`TOIZero API listening on http://localhost:${port}`);
export default { fetch: app.fetch, port };

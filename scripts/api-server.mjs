/**
 * Local API server — runs the real Netlify Function on plain Node.
 *
 *   npm run dev:api                 → http://localhost:8899/.netlify/functions/api
 *
 * The TypeScript handler is bundled with esbuild (dependencies stay external so
 * `pg` resolves from node_modules exactly as it would on Netlify) and driven
 * with Netlify-shaped events. Storage defaults to the JSON file store so the
 * server is fast and deterministic; set STORE=postgres to try the database.
 *
 * `scripts/smoke-api.mjs` imports `startApi()` for an isolated instance with
 * its own store file.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".data", "api-handler.mjs");
const URL_PREFIX = "/.netlify/functions/api";

/** Bundle the Netlify Function to `.data/api-handler.mjs`. */
export async function bundleApi() {
  mkdirSync(path.dirname(OUT), { recursive: true });
  await build({
    entryPoints: [path.join(ROOT, "netlify", "functions", "api.ts")],
    outfile: OUT,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    packages: "external",
    logLevel: "silent"
  });
  return OUT;
}

/**
 * Start the API. Returns `{ port, close() }`.
 * @param {{ port?: number, storeFile?: string, quiet?: boolean }} opts
 */
export async function startApi(opts = {}) {
  const port = opts.port ?? (Number(process.env.PORT) || 8899);
  // File-backed storage unless the caller asks for Postgres explicitly.
  process.env.STORE = process.env.STORE || "file";
  if (opts.storeFile) process.env.STORE_FILE = opts.storeFile;

  const file = await bundleApi();
  // Cache-bust so repeated starts inside one process pick up rebuilds.
  const { handler } = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");

    const url = new URL(req.url, `http://localhost:${port}`);
    const query = {};
    for (const [k, v] of url.searchParams) query[k] = v;

    try {
      const result = await handler({
        path: url.pathname,
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: query,
        body: raw || null,
        isBase64Encoded: false
      });
      res.writeHead(result.statusCode ?? 200, result.headers ?? {});
      res.end(result.body ?? "");
    } catch (err) {
      console.error("api-server error:", err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "server_error" }));
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  if (!opts.quiet) {
    console.log(`api  → http://localhost:${port}${URL_PREFIX}  (store: ${process.env.STORE})`);
  }
  return {
    port,
    base: `http://localhost:${port}${URL_PREFIX}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { port } = await startApi();
  process.on("SIGINT", () => process.exit(0));
  void port;
}

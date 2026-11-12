// Dependency-free stand-in for the Rakhal backend, used only by the visual-regression gate.
//
// The web app reaches the backend through ONE env var (`API_BASE_URL`), for both its BFF route and its server
// code, so any HTTP server speaking the same `{ success, data, meta? }` envelope can replace it, including for
// server-side fetches that Playwright's `page.route()` cannot intercept.
//
// Node built-ins only (no install, no download). Fixtures live in `./fixtures.mts`; Node 24 strips the types.
// An unknown route returns a 404 envelope AND is logged (`[mock-api] unhandled GET /x`), so a new request made by
// the app shows up in the CI log instead of silently rendering an empty state.
import { createServer } from "node:http";
import { routes } from "./fixtures.mts";

const PORT = Number(process.env.VISUAL_MOCK_PORT ?? 4110);
const PREFIX = "/api/v1";
const FIXED_TIMESTAMP = "2026-01-15T08:00:00.000Z"; // fixed: responses must be byte-stable between runs

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/__health") return send(res, 200, { ok: true });

  const path = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : null;
  const handler = path === null ? undefined : routes[`${req.method} ${path}`];

  // Drain any request body so keep-alive sockets stay usable.
  req.on("data", () => {});
  req.on("end", () => {
    if (!handler) {
      console.warn(`[mock-api] unhandled ${req.method} ${url.pathname}${url.search}`);
      return send(res, 404, {
        success: false,
        code: "MOCK_NOT_FOUND",
        message: `mock-api has no fixture for ${req.method} ${url.pathname}`,
        requestId: "mock",
        timestamp: FIXED_TIMESTAMP,
      });
    }
    const out = typeof handler === "function" ? handler(url) : handler;
    send(res, 200, { success: true, ...out });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-api] listening on 127.0.0.1:${PORT}`);
});

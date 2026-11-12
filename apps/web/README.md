# Rakhal Consumer Frontend

Farm-facing web app for **Rakhal** — dairy-farm operations SaaS (Bangladesh, ৳, Bangla-first UI).
Next.js 16 (App Router) + React 19 + Tailwind v4, consuming `Repos/rakhal-backend` via `/api/v1`.

Start here: [`CLAUDE.md`](CLAUDE.md) → [`docs/IN_FLIGHT.md`](docs/IN_FLIGHT.md) → [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

## Quickstart

```bash
pnpm install                       # 1. install deps
cp .env.example .env.local         # 2. point at your local backend
# 3. start the backend (separate terminal): Repos/rakhal-backend → pnpm start:dev (needs Docker postgres+redis, then pnpm seed)
pnpm dev                           # 4. runs on http://localhost:3001
pnpm lint && pnpm typecheck        # 5. verify
pnpm build                         # 6. production build check
```

Demo logins (seeded on the backend): `owner@demo.rakhal.test` / `DemoPass123`,
`worker@demo.rakhal.test` / `WorkerPass123`. Backend Swagger: `http://localhost:3000/api/docs`.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, folder rules, contract, perf budgets, Definition of Done
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens, component inventory
- [`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) — ticket board (source of truth)
- [`D:\Projects\Rakhal\docs\rakhal-ui-analysis.md`](../../docs/rakhal-ui-analysis.md) — full UI screenshot analysis + design spec

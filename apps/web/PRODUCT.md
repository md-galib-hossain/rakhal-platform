# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two equally primary roles, both daily/core usage, different device and setting:
- **Farm owner/manager** — desk or laptop, office-side: finance, reports, settings, cattle/herd oversight, decision-making across the farm.
- **Field worker** — phone in hand, barn/shed-side: feeding, milking, health logging, task completion on the move. Fast entry under real field conditions is the job, not an afterthought.
A seeded third role (Worker vs Manager vs Owner) governs RBAC/permission scope, not a different persona — same two usage situations above map onto Owner/Manager (office) and Worker (field).

## Product Purpose

Rakhal is a dairy-farm operations SaaS for 20–500-animal farms in Bangladesh (currency ৳). It digitizes the farm's day-to-day operating record — cattle, feeding, health, reproduction, milk, finance, inventory, purchasing/sales — into one system of record with an immutable activity log, so an owner/manager can see true farm state and a worker can log real field events quickly. Success = the farm's real operational and financial state is captured accurately and immediately usable (reports, finance, task reminders) without separate paper/ledger tracking.

## Positioning

Purpose-built for Bangladesh smallholder-to-mid dairy operations specifically — not a generic livestock ERP ported in. Token-based multi-tenant farm model with RBAC baked into every route, an immutable hash-chained Activity Log, and cross-cutting engines (AQR, Task Hub) that other farm-management tools in this market do not offer at this granularity.

## Operating Context

- Bangla-first: `bn` is the default locale; every string also ships in `en`.
- Office workflows happen at a desk (reports, finance reconciliation, settings, bulk actions).
- Field workflows happen in the barn/shed on a phone, often one-handed, mid-task (feeding grid, milk log, health case reporting, treatment recording).
- Multi-tenant by farm; a user's role (Owner/Manager/Worker) scopes what they can see and do on every screen.
- Backed by a NestJS/Prisma/Postgres API consumed over `/api/v1` (customer surface only — a separate admin surface exists but is out of scope for this app).

## Capabilities and Constraints

- Core domains: Cattle, Feed/Feeding (incl. Feed Formulator), Health (Sick Bay + Protocols), Reproduction, Milk (log + buyers/dispatch), Finance, Inventory, Purchasing/Sales, Dashboard, Reports, Settings, Tasks/Activity.
- Cursor (keyset) pagination throughout; no `farmId` ever accepted in request bodies — farm context comes from the authenticated session/token.
- Permissions are checked via a `<Can I="resource.action">` pattern, never role-string comparisons.
- Next.js 16 (App Router) + React 19 + Tailwind v4; Server Components by default, `'use client'` only at justified interactive leaves.
- Lighthouse-100 / route JS budget / accessibility are standing engineering constraints on every surface (see `docs/ARCHITECTURE.md`).

## Brand Commitments

- Name: **Rakhal**. Existing wordmark/logo assets (`public/logo-mark.svg`, `public/rakhal-full-logo.jpg`) are binding — do not redesign the logo itself.
- `bn` (Bangla) as the default locale is binding; `en` is the required second locale, not the primary.
- No other visual element (color, typography, component style) is locked as brand — those remain open to design work and are recorded as incumbent evidence in DESIGN.md, not as binding commitments here.

## Evidence on Hand

- Live, running product with an extensive operational history (`docs/CURRENT_STATE.md`, `docs/PROJECT_PROGRESS.md`) — real backend, real demo farm data (seeded demo owner/manager/worker accounts), not a mockup.
- No testimonials, case studies, press, or external marketing proof on hand; do not fabricate any for this product context.

## Product Principles

1. Field entry must stay fast and forgiving — the worker is often one-handed, on a real barn floor, possibly with weak connectivity; never trade entry speed for office-side polish.
2. Office-side views must tell the true current state of the farm — finance, inventory, and herd data are operational truth, not approximations; stale or ambiguous numbers are a defect.
3. Bangla is not a translation layer bolted onto an English-first product — it is the default experience, and English must not become the better-maintained one.
4. Every permission-sensitive action is gated by what the role can actually do, not by hiding a button the backend will reject anyway.
5. New surfaces follow established module patterns (reference: `features/inventory/`) rather than introducing one-off conventions.

## Accessibility & Inclusion

Known product-specific requirement: users include low-literacy field workers on low-end Android devices under variable/poor rural connectivity. This biases design toward icon-forward affordances, large touch targets, resilient/forgiving forms (clear error recovery, no silent data loss on a dropped connection), and content that reads clearly even when text comprehension or network quality is limited — beyond generic WCAG compliance.

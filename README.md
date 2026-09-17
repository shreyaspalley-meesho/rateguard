# RateGuard — FMSC Rate Card Prototype

Interactive prototype of Meesho's internal rate card management tool (FR-01…FR-20 from the KRD).
All data lives in the browser via Zustand + localStorage. No backend.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the persona switcher in the top bar to change your role.

## Personas

FM Cluster Head · SC Business Team · Ops Head (FM · Tajinder) · Ops Head (SC · Soumya) · BizFin · Controllership · Legal · Admin · Zonal Head (read-only).

## Critical User Journeys (CUJs)

| CUJ | Steps | Persona sequence |
| --- | --- | --- |
| **CUJ-1** Within-band FM submission | `/submit` → step through wizard (pick SSY / FM-NEW / low tier values) → submit → switch persona to **Ops Head (FM)** → `/approvals/{id}` → Approve → switch to **Legal** → `/legal/{id}` → paste matching values → executed | FM Cluster Head → Ops FM → Legal |
| **CUJ-2** Out-of-band SC with override | `/submit` as **SC Business** → pick BLR7 / SC-01 → any rate (routes BizFin) → switch to **BizFin** → approve → switch to **Legal** → verify with a wrong tier value → Mismatch → switch to **FM/SC submitter** → `/requests` → enter override reason → Executed | SC Biz → BizFin → Legal → SC Biz |
| **CUJ-3** Approved not yet executed | Look at `RC-FM-HUB14-202608-001` in seed → `/controllership` shows it under "Provisional" | Controllership |
| **CUJ-4** TTL auto-close | `/admin/guardrails` → click "Simulate: advance 14 days" → pending requests auto-close | Admin |
| **CUJ-5** Guardrail refresh | `/admin/guardrails` → change JSON → Publish → previous version marked Superseded; pending requests retain pinned version | BizFin / Admin |
| **CUJ-6** Payouts lookup | `/lineage/HUB14` → see all rate history and executed agreement links | Any read-only role |

## Simulate / Dev buttons

Located at `/admin/guardrails`:
- **Advance clock 8 / 14 days** — moves the internal clock forward; pending requests with elapsed TTL auto-close.
- **Reset demo data** — reseeds hubs, requests, guardrails, notifications.

## Business rules implemented

- Request ID: `RC-[FM|SC]-[HUB]-[YYYYMM]-[seq]`, seq per hub × month.
- Live guardrail evaluation (fires on keystroke on wizard step 3). SC = always BizFin. FMSC/CrossDock/WAAS = BizFin. Standalone / Mall Hub use city × hub-type.
- State machine: Draft → Pending → Approved (Awaiting) → Executed (Verified / Overridden). Rejected + AutoClosed terminal.
- Concurrent-open block per hub × change type.
- Effective-date integrity vs current live rate.
- Addendum verification: partner name + city + all tier values must match; else Mismatch → mandatory override reason.
- Notifications on state transitions, persona-scoped.
- CSV export from `/controllership`.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind v4 · Zustand `persist` · date-fns · Plus Jakarta Sans + IBM Plex Mono.

## Known gaps / partial

- Design language is inspired by the mockups, not pixel-perfect ported.
- MG/incentive fields captured but not fully surfaced downstream.
- Notifications appear as a tray (no live toast animation).
- SC slab structures SC-02/SC-03 have no seeded ceilings by design (always route to BizFin per KRD).

## Deploy to GitHub Pages

The app builds as a fully static export and ships via the workflow in `.github/workflows/deploy.yml`.

1. Push this repo to GitHub (any name — the workflow reads it at runtime).
2. In the repo, open **Settings → Pages** and set **Source: GitHub Actions**.
3. Push to `main` (or `master`). The workflow builds with `NEXT_PUBLIC_BASE_PATH=/<repo>` and publishes `out/`.
4. Site URL: `https://<owner>.github.io/<repo>/`.

Notes:

- Local dev is unchanged: `npm run dev` runs at `/` (no basePath env var).
- Local static build: `NEXT_PUBLIC_BASE_PATH=/<repo> npm run build`, then serve `out/` with any static server.
- All state is localStorage-scoped per browser. Every visitor starts fresh from the seed data.
- Unknown paths (e.g. request IDs added at runtime) fall through to `404.html`, which is a copy of `index.html` and boots the SPA.


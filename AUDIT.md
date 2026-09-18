# RateGuard Implementation Audit — 2026-09-18

Audit target: `/Users/shreyaspalley/Workspace/ratecard/FMSC/` at HEAD.
Reference: Claude Design mockups (iterations 5, 6, 7) and KRD `/tmp/krd.txt`.
Method: live prototype at `http://localhost:3000` driven with Playwright, screenshots at 1440×900 and 390×844 saved under `.playwright-mcp/audit/`.
Build clean (`npm run build`). Verify script clean (`npx tsx scripts/verify-flows.mjs` → 63/63).

## Executive summary

- Score across 19 screens: **9 DONE / 8 PARTIAL / 2 MISSING**.
- The submitter flow (5b-5f), rate lineage (6b), approval detail with diff (6c), controllership feed (7a), submitter home (7d), delegation table (6h), and the SC vs FM persona split (6a) are strong and closely track the mockups.
- The three biggest gaps are (1) guardrail refresh 6f is a raw JSON textarea instead of the reviewable diff view, (2) verification 6e collapses five outcomes into binary Verified/Mismatch with no override-with-reason flow (violates KRD FR-07), and (3) the 5g full-screen blocked-state cards are inline error strings, not the phone-first blocking screens.
- Rock-solid: chip vocabulary (`Chip.tsx` implements Pattern B — solid StateChip + outlined EvidenceChip — exactly as recommended in 5a), rate lineage `/lineage/[hubCode]` (all six 6b regions: current-for-provisioning, current-for-payment, why-this-version-governs, pinned references, other rate types, version timeline), inline guardrail evaluation with abnormal-rate detection (5d).

## Screen-by-screen comparison

### Iteration 5 — Submitter flow

#### 5a Chip vocabulary
- **Mockup**: `/tmp/rateguard-mockups-stash/screens/5a.html` lines 45-77 recommend Pattern B (solid StateChip + outlined EvidenceChip).
- **KRD ref**: FR-06 state machine, FR-07 addendum verification.
- **Implementation**: `src/components/Chip.tsx` implements `StateChip` (solid: purple Pending, green Approved/Executed, red Rejected, grey Superseded/AutoClosed/Withdrawn) and `EvidenceChip` (outline: grey Not-needed, amber Awaiting, green Verified, red Mismatch, purple Overridden). Matches Pattern B exactly.
- **Screenshots**: `audit/5a-chips-in-requests.png`, chips visible in `audit/7d-desktop.png` (Pending solid purple + Not-needed outline; Auto-Closed solid grey + Not-needed outline).
- **Score**: **DONE**.

#### 5b Step 1 · Location
- **Mockup**: 5b.html headline "Which hub is this rate for?" plus derived Oracle/Owner/Zone read-only pane.
- **KRD ref**: FR-01, US-001.
- **Implementation**: `src/app/submit/page.tsx::LocationFields` (line 1059) renders a hub `<select>`, then a read-only Oracle ID / Owner / Hub type / Zone grid, plus lifecycle-status chip.
- **Screenshots**: `audit/5b-5e-submit-fm-empty.png`, `audit/5c-fm-hub-selected.png` (after picking SSY: shows OR34112, Ramesh Kumar, Standalone, West + Live · agreement executed).
- **Score**: **DONE**.

#### 5c Step 2 · Hub type
- **Mockup**: 5c.html shows six hub-type pills — Standalone/Mall Hub/Mini Hub/Seller Led Hub/FMCP/LM-as-FM — with consequences (structure, unit, guardrail scope, approver) surfaced read-only underneath.
- **KRD ref**: FR-02, US-001, KRD §II.3.6 (hub-type mapping unreliable).
- **Implementation**: `HubTypePicker` (submit page.tsx line 612) renders the six FM hub types as buttons; a `HubTaxonomyPanel` shows "Derived from hub type · read-only" with structure, unit, guardrail scope, approver.
- **Screenshots**: `audit/5c-fm-hub-selected.png`, `audit/5g-ssy-select.png` — pills row visible with derived consequences ("Structure FM-OLD or FM-NEW, Unit shipment, Guardrail Applicable, Approver Ops-FM (Tajinder)").
- **Score**: **DONE**.

#### 5d Step 3 · Tiers with guardrail banner (4 states)
- **Mockup**: 5d.html shows four banner states — within-band (green, → Ops Head), breach (amber → BizFin), no-ceiling (grey, FMCP/LM-as-FM), and N-A (Touchpoint) — plus abnormal-rate sanity-check strip and SC 10-row grid.
- **KRD ref**: FR-04, FR-05, FR-24 (abnormal-rate reasons), US-002, US-003.
- **Implementation**: `GuardrailBanner` (ui/GuardrailBanner.tsx) renders `Within band`/`Out of band`/`No ceiling` and swaps route text. `AbnormalReasonPrompt` fires when rates exceed executed corpus stats. SC editor at `ScSlabEditor.tsx` renders the 10-slab grid.
- **Screenshots**: `audit/5d-fm-within.png` (green "Within band → Ops Head-FM"), `audit/5d-fm-breach.png` (amber "Out of band on tiers 1..6 → BizFin", plus "Sanity check: Rate ₹99999 looks unusually high" — abnormal-rate strip is a separate row, exactly per mockup).
- **Score**: **DONE**. Two nits: (a) no visible "N-A · Touchpoint" banner state — Touchpoint isn't a hub-type pill; instead an `isTouchpointApplicable` check surfaces a touchpoint-rate side field. (b) FMCP "no-ceiling" copy present in code but not screenshotted.

#### 5e Step 4 · Dates and clauses
- **Mockup**: 5e.html shows FM = touchpoint clause only; SC = full set (MG + trigger + lock-in + CrossDock bag + incentive lightweight).
- **KRD ref**: FR-03 (MG basis/threshold/shortfall treatment/period + Incentive), KRD §2.1.3, §2.1.7.
- **Implementation**: FM = only `touchpointRate` when applicable (no MG/lock-in/notice fields for FM). SC = MG (amount), MG Trigger (text), Lock-in (months), Notice period (months), optional Incentive toggle. `Clause` type in `src/lib/types.ts` line 88 defines the fields.
- **Screenshots**: `audit/5b-5e-submit-fm-empty.png` (FM: no clauses section at all), `audit/6a-sc-blr7.png` (SC: full clauses section with MG amount / MG trigger / Lock-in / Notice period + Add incentive checkbox + CrossDock bag rate).
- **Score**: **PARTIAL**.
- **Gaps**:
  - MG **shortfall treatment** field (KRD FR-03 explicit requirement) is not captured — only amount/trigger. There is no `mgShortfall` or `mgBasis` field in `Clause`.
  - MG **period** captured as `mgPeriod`-style option? No — `Clause` has `noticePeriodMonths` but no `mgPeriod` (Day/Week/Month) selector. `Incentive` has `.period` but `Clause.mg*` fields don't.
  - Incentive fields: `Incentive` type has `base/incremental/period/start/end` — no explicit "trigger metric", "slab/threshold", "payout basis", or "cap" — all four called out by FR-03 for incentives.

#### 5f Step 5 phone
- **Mockup**: 5f.html — mobile submit: route decided first ("Route: Ops-FM"), then step-through with 10-slab SC grid scrolling.
- **KRD ref**: FR-01 mobile, US-001.
- **Implementation**: `SubmitMobile` (submit page.tsx around line 494) renders step-of-5 nav, purple header, per-step content.
- **Screenshots**: `audit/5f-submit-mobile.png` (Step 1 of 5, "Where is this rate for?"), `audit/7d-mobile.png` (mobile submitter home).
- **Score**: **DONE**.

#### 5g Five blocked states
- **Mockup**: 5g.html — five phone cards (no owner, concurrent open, backdated, missing clauses, hub type disabled) each with a headline, explanation, one primary CTA.
- **KRD ref**: FR-01 owner-mapping, FR-06 concurrency, FR-14 backdating, FR-20 hub-type structure, FR-03 clause completeness.
- **Implementation**: All five checks exist as inline error strings — see `src/app/submit/page.tsx::validation` around lines 300-315. But they are rendered as line-item error banners inside the review section, not as full-screen phone cards with a single primary CTA.
- **Screenshots**: `audit/5g-ssy-select.png` (SSY selected — no explicit "concurrent open" blocked card fires even though pending requests exist for that hub; the code checks `changeType` sameness so a different change type slips through).
- **Score**: **PARTIAL**.
- **Gaps**:
  - Presentation is one-liner inline text under the "Submit request" button, not a full-screen guard as the mockup specifies. On a phone this is easy to miss.
  - No "hub-type disabled" state at all (LM-as-FM currently just works — no gate on hub types with `structureDefined = false`).
  - No "notify me when it opens" or "request mapping from Admin" secondary actions.
  - Backdating check is present but only rejects; no logged-exception path (FR-14 requires exception logging with count).

### Iteration 6 — Flows

#### 6a FM vs SC differences
- **Mockup**: 6a.html — the two flows are visibly different per step (hub type vs sub-types, structure decided by hub type vs vendor-defined, clauses set differs).
- **KRD ref**: US-001 / US-003.
- **Implementation**: `SubmitInner` (submit page.tsx line 481) branches on `currentPersona`; `VariantSubmit` → `SubmitDesktopFm` or `SubmitDesktopSc`. Two distinct sub-editors: `HubTypePicker`+slabs for FM, `SubTypesEditor`+`ScSlabEditor` for SC.
- **Screenshots**: `audit/5c-fm-hub-selected.png` (FM) vs `audit/6a-sc-blr7.png` (SC BLR7 with FMSC + CrossDock sub-types).
- **Score**: **DONE**.

#### 6b Rate lineage
- **Mockup**: 6b.html shows: current-for-provisioning card, current-for-payment card, "why this version governs" trace, version timeline, pinned references (guardrail, spotdraft, addendum, approver, hub status), other rate types.
- **KRD ref**: FR-10 change log, FR-12 export, FR-13 provisioning feed, US-010, US-012.
- **Implementation**: `src/app/lineage/[hubCode]/Client.tsx` (513 bytes stub + 16KB client). Renders exactly the six mockup regions.
- **Screenshots**: `audit/6b-lineage-SSY.png` shows both cards (₹2.30 Executed+Verified · Current, both), the 5-step "Why this version governs" trace, pinned references (Guardrail v12, SpotDraft SSY-2026-07-045, Addendum ADD-2026-07-045, Approver Ops Head (FM), Hub status "Live · agreement executed"), Version timeline (15 Jul 2026 · FM-NEW · Current · Executed · Verified · tier ladder), Other rate types (Touchpoint —, Other change types none).
- **Score**: **DONE**.

#### 6c Decision detail with diff
- **Mockup**: 6c.html — FM within-band Ops Head + SC out-of-band BizFin, side by side, with r1→r2 diff.
- **KRD ref**: FR-05 routing, FR-06 state, US-006, US-009.
- **Implementation**: `src/app/approvals/[id]/Client.tsx` (11.2KB). Includes guardrail banner, tier table (proposed vs ceiling), revision chain diff, rejection reason, event log, approve/reject controls.
- **Screenshots**: `audit/6c-fm-bizfin-detail.png` — RC-FM-HUB5-202608-003 with breach banner "Out of band on tiers 1,2,3,4,5,6 → BizFin", tier table showing proposed vs ceiling with per-tier deltas, "Revision chain · r1 → r2" diff table with per-tier proposed old/new values, rejection reason quote, event log with three rows (Submitted/Rejected/Revised), Decision form with Approve/Reject buttons.
- **Score**: **DONE**. Note the hydration mismatch bug: server-rendered timestamps disagree with client (see Console/health section).

#### 6d Return → revise → resubmit
- **Mockup**: 6d.html — on the FM phone: same request, new revision, route re-evaluated.
- **KRD ref**: FR-06 state machine, FR-23 revision counter.
- **Implementation**: Type `Revision` in `types.ts` line 140 records prior revisions; `RateRequest.revision` is 1-indexed; submit page supports `?revise=<id>` param (line 484) to start a new revision.
- **Screenshots**: not fully exercised in this run; the revision-chain diff visible in `audit/6c-fm-bizfin-detail.png` proves r1→r2 storage works.
- **Score**: **PARTIAL**.
- **Gaps**:
  - No explicit "Reject → returns to submitter" affordance beyond a state chip; the submitter's "revise" CTA lives only via `?revise=` URL param — no button in `/requests` says "Revise this rejected request".
  - Route re-evaluation on resubmit works structurally (submit page recomputes route) but is not called out to the submitter with a "route changed to X" banner.

#### 6e Verification (five outcomes + one override rule)
- **Mockup**: 6e.html — five outcomes: matched / mismatched-per-field / unreadable / override / already-verified. Single override rule with mandatory reason.
- **KRD ref**: FR-07 — "Mismatch blocks activation, with an override available only against a mandatory written reason, permanently attributed."
- **Implementation**: `src/app/legal/[id]/Client.tsx` line 26 `verify()` — binary Verified/Mismatch based on partner+city+tiers exact match; no override, no unreadable, no already-verified branch.
- **Screenshots**: `audit/6e-legal-verify.png` (verification form with Expected vs Paste-addendum), `audit/6e-verify-after.png` (post-run redirect).
- **Score**: **PARTIAL**.
- **Gaps**:
  - **No override flow at all.** KRD FR-07 requires override-with-mandatory-reason; `EvidenceState` has `'Overridden'` and `RateRequest.overrideReason` exists, but no UI writes them — dead schema fields.
  - No "unreadable" outcome (would surface for a scan-failure case).
  - No per-field mismatch highlighting — everything is binary at the record level. Mockup shows which fields differ.
  - No "already verified" idempotency — the form re-submits if reloaded.

#### 6f Guardrail refresh
- **Mockup**: 6f.html — "Guardrail refresh · FM · Q3 2026" — quarterly computed refresh, BizFin reviews a **diff** (old ceiling vs new ceiling per hub-type × city) and approves.
- **KRD ref**: FR-04 (versioned & approved), FR-06 (state machine for guardrail).
- **Implementation**: `src/app/admin/guardrails/page.tsx` — 70 lines. Live version card + history stub + raw JSON textarea to edit ceilings + "Publish new guardrail" button. No diff view.
- **Screenshots**: `audit/6f-admin-guardrails.png`.
- **Score**: **MISSING** (the *intent* is there — publish new version — but the review affordance is completely absent).
- **Gaps**:
  - No diff view (v12 vs draft v13) — reviewer has no way to see what changed.
  - No per-hub-type × city breakdown; it's one giant JSON blob.
  - No BizFin approval gate — Admin can publish directly. KRD §2 governance says BizFin approves; here Admin persona publishes with no second signature.
  - No "quarterly · computed" story surface — just a manual JSON edit.

#### 6g Notifications tray + event matrix
- **Mockup**: 6g.html — tray with event matrix; every event mirrors to Slack or email with a link back.
- **KRD ref**: FR-16 Slack (primary) + email on submission, decision, addendum-pending, TTL warning, TTL lapse.
- **Implementation**: `src/app/notifications/page.tsx` — 36 lines. Simple list of notifications with title/body/timestamp and "Open request →". `Shell.tsx` has a bell with an unread count (visible in most screenshots).
- **Screenshots**: `audit/6g-notifications.png` (empty).
- **Score**: **PARTIAL**.
- **Gaps**:
  - No event-matrix presentation (which channel this event fires to — Slack vs email vs both).
  - No Slack/email mirror indicator per row.
  - No filter by event type.
  - Actual Slack/email delivery is prototype-only (this is expected for a prototype but there's no mock channel indicator).

#### 6h Delegation
- **Mockup**: 6h.html — Approver delegation; only Controllership can set it.
- **KRD ref**: FR-18 backup approvers / delegation.
- **Implementation**: `src/app/admin/delegation/page.tsx` — 46 lines. Table Role/Primary/Backup/From/To + Add form.
- **Screenshots**: `audit/6h-delegation.png`.
- **Score**: **PARTIAL**.
- **Gaps**:
  - No RBAC gate — the page is at `/admin/delegation`, so anyone routed there (admin persona in demo) can edit. The mockup rule "Controllership sets it, nobody else" is not enforced. `Controllership` persona has no path here.
  - No From/To date pickers — Add form only takes Role/Primary/Backup; From/To must be added programmatically.
  - No "who edited last" audit trail.

### Iteration 7 — Downstream consumers

#### 7a Provisioning feed
- **Mockup**: 7a.html — ledger view, filter chips, both status chips per row (state + evidence), hub status, footer totals.
- **KRD ref**: FR-13 controllership provisioning feed, US-007, US-008.
- **Implementation**: `src/app/controllership/page.tsx` — 110 lines. Three summary tiles (Payable/Provisional/Exceptions), Provisioning feed table, Exceptions section, Export CSV button.
- **Screenshots**: `audit/7a-7b-controllership.png`.
- **Score**: **PARTIAL**.
- **Gaps**:
  - No filter chips row (mockup shows filters for month/segment/bucket).
  - Only one chip per row ("Bucket: Provisional/Payable"). Mockup shows both state and evidence chips per row (evidence is derivable but not shown).
  - No hub-status column.
  - No footer totals (sum of ₹ payable, sum ₹ provisional).
  - Month selector is not surfaced — heading says "September 2026" but no picker.

#### 7b Variance and exceptions
- **Mockup**: 7b.html — designed for empty (empty is success).
- **KRD ref**: FR-13 variance report.
- **Implementation**: Same `/controllership` page shows "No exceptions — clean close." when empty.
- **Screenshots**: `audit/7a-7b-controllership.png` (Exceptions section: "No exceptions — clean close.").
- **Score**: **PARTIAL**.
- **Gaps**:
  - Provisional-vs-executed variance report is absent — the KRD explicitly calls for it under FR-13.
  - No period-over-period comparison surface.

#### 7c Legal hand-off inbox
- **Mockup**: 7c.html — the packet Legal drafts against.
- **KRD ref**: FR-07, FR-08 (Rate Change ID + Addendum ID), US-011.
- **Implementation**: `src/app/legal/page.tsx` — 79 lines. "Awaiting addendum" section + "Recently executed" section.
- **Screenshots**: `audit/7c-legal-inbox.png`.
- **Score**: **DONE**. Each row shows the RC-* Rate Change ID, hub × change type × effective date, approver, partner, "Verify addendum" CTA. Executed rows show the Addendum ID (ADD-*) and Executed+Verified chips.

#### 7d Submitter home
- **Mockup**: 7d.html — "sorted by what it wants from you, not by date"; phone + desktop.
- **KRD ref**: FR-17 dashboards per role, US-001, US-006.
- **Implementation**: `src/app/requests/page.tsx` — 162 lines. Sections: "Wants something from you" (upload addendum, respond to mismatch), "In flight" (awaiting approver decision), "Closed".
- **Screenshots**: `audit/7d-desktop.png` (three sections; on this data "Wants something from you" is empty — "Nothing to action." — with In-flight and Closed populated), `audit/7d-mobile.png`.
- **Score**: **DONE**.

## KRD coverage matrix

| KRD ref | Owner screen(s) | Status | Notes |
|---|---|---|---|
| FR-01 Rate submission | /submit | DONE | Vendor toggle configurable |
| FR-02 Configurable slab structures | /submit + hub-taxonomy | DONE | FM Old/New/Touchpoint + SC 10-slab + CD |
| FR-03 Commercial clauses (MG + Incentive structured) | /submit clauses | PARTIAL | MG shortfall-treatment, MG period, and Incentive trigger/threshold/basis/cap all absent |
| FR-04 Guardrail definition & versioning | /admin/guardrails | PARTIAL | Versions kept, no BizFin approval gate, no diff review |
| FR-05 Inline guardrail evaluation | /submit tiers | DONE | Live, with route swap; 3 of 4 banner states verified |
| FR-06 Rate state machine | throughout | DONE | Draft/Pending/Approved/Executed/Superseded/Rejected/AutoClosed |
| FR-07 Verification with override | /legal/[id] | PARTIAL | Binary Verified/Mismatch only; no override with mandatory reason (blocking gap) |
| FR-08 Rate Change ID + Addendum ID | throughout | DONE | RC-* and ADD-* format present |
| FR-09 Hub deactivation | /admin/hubs | PARTIAL | Status field exists; no "capture shutdown date + penalty" form |
| FR-10 Change log & rate history | /lineage | DONE | Version timeline, event log, revisions retained |
| FR-11 SSO + RBAC | none | MISSING | Persona-switch is client-side only; no server-side enforcement (out of scope for prototype but flagged) |
| FR-12 Reporting & export | /controllership | PARTIAL | CSV button present; no filters on date range/hub-type/status; no read API |
| FR-13 Provisioning feed | /controllership | PARTIAL | Feed present; variance report absent |
| FR-14 Effective-date integrity | /submit | PARTIAL | Predates-live check present; no logged-exception path with counter |
| FR-15 Request TTL | dev-controls simulate | PARTIAL | Simulation button exists; no UI to configure window or show "days remaining" per request |
| FR-16 Notifications (Slack + email) | /notifications | PARTIAL | List present; no event matrix, no channel indicator |
| FR-17 Dashboards per role | /, /requests, /approvals, /controllership | PARTIAL | Present but no "days-pending" aging on approver queue; no "bottleneck by zone" for Admin |
| FR-18 Delegation | /admin/delegation | PARTIAL | Table present; no RBAC (Controllership-only), no From/To in Add form |
| FR-19 Historical data migration | seed.ts | DONE (prototype scope) | Seeded FM+SC current state |
| FR-20 Master data admin | /admin/hubs | PARTIAL | Hub table present; no hub-type structure enable/disable toggle |
| FR-21 SpotDraft handshake v2 | n/a | DEFERRED | Explicitly v2 in KRD |
| US-001 FM submitter | /submit FM | DONE | |
| US-002 Inline guardrail feedback | /submit tiers | DONE | |
| US-003 SC 5-6 slab structures | /submit SC | DONE | ScSlabEditor supports up to 10 |
| US-004 MG + Incentive capture | /submit clauses | PARTIAL | See FR-03 gaps |
| US-005 Guardrail upload BizFin | /admin/guardrails | PARTIAL | See 6f |
| US-006 BizFin out-of-band queue | /approvals (BizFin persona) | DONE | |
| US-007 Controllership feed | /controllership | PARTIAL | See 7a |
| US-008 Variance report | /controllership | MISSING | |
| US-009 Ops Head within-band queue | /approvals (Ops persona) | PARTIAL | Queue works but was empty in demo data (all pending are BizFin) |
| US-010 Historical view | /lineage | DONE | |
| US-011 Legal structured handover | /legal | DONE | |
| US-012 Payouts current + link back | /lineage | DONE | Both provisioning and payment cards |
| US-013 Zonal Head read-only | zonal persona | PARTIAL | Persona exists, defaults to lineage; no explicit "zone feed" |
| US-014 Admin hub↔Oracle mapping | /admin/hubs | DONE | |

## Top gaps ranked

1. **[CRITICAL]** Verification override missing (6e / FR-07). `EvidenceState.Overridden` and `RateRequest.overrideReason` are schema-defined but no UI captures them. KRD calls the override + mandatory-reason the linchpin of the FR-07 control. Without it a legitimate-but-imperfectly-drafted addendum has no path to Executed. Fix: add an "Override with reason" secondary action on `/legal/[id]` that requires a non-empty reason, persists to `overrideReason`, sets evidence to `Overridden`, and logs the actor.
2. **[CRITICAL]** Guardrail refresh 6f is a raw JSON textarea. Reviewer cannot compare v12 → v13, and there is no BizFin approval step — Admin publishes directly. Fix: render a per-(hub-type, city, changeType) table with old/new ceiling columns and delta, gate publish behind a "BizFin approves" state transition, and record the approver on the `GuardrailVersion`.
3. **[HIGH]** MG / Incentive clause capture is not structured enough for provisioning (5e / FR-03). Missing: MG shortfall treatment, MG period, and all four Incentive attributes (trigger metric, slab/threshold, payout basis, cap). Fix: extend `Clause` and `Incentive` types with those fields; render corresponding form controls in SC submit's clauses section.
4. **[HIGH]** Blocked-state UX (5g) is inline text at the bottom of the form. On mobile these are easy to miss. Fix: for FM mobile, promote the four inline errors to full-screen blocking cards with headline + one-liner + primary CTA + optional secondary, matching 5g's phone-card layout. Also add the "hub-type disabled" gate (LM-as-FM currently proceeds even without a defined structure).
5. **[HIGH]** Controllership 7a lacks filters, dual chips, hub-status, and footer totals. Variance report (7b / FR-13) is absent entirely. Fix: add a filter chip row, add evidence chip per row, add hub-status column, add footer sum row, add a "Variance" tab with provisional-vs-executed diff.
6. **[MED]** Notifications 6g has no event matrix or channel indicator. The KRD FR-16 wants Slack (primary) + email + specific event triggers (submission, decision, addendum pending, TTL warning, TTL lapse). Fix: add an "Event matrix" side panel or admin sub-page and a chip per notification row indicating which channels fired.
7. **[MED]** Delegation 6h is not scoped to Controllership. KRD FR-18 does not name the setter but the mockup explicitly says "Controllership sets it, nobody else." Fix: move `/admin/delegation` to `/controllership/delegation` or gate the edit controls to the Controllership persona; add From/To pickers in the Add form.
8. **[MED]** Approval detail has a hydration mismatch bug — server and client render different timestamps (see console error captured on `/approvals/RC-FM-HUB5-202608-003`). Fix: format all timestamps client-side after mount, or pass an ISO string through and format with a stable formatter.
9. **[LOW]** Revise flow works but is under-signposted. Rejected requests need a visible "Revise this" CTA in `/requests`, and after resubmit a "Route changed to X" banner should call out any recomputation.
10. **[LOW]** Ops Head queue was empty in the demo data — all pending routes to BizFin. Consider seeding at least one within-band pending FM request so the Ops-FM queue is not empty by default (matters for 6c side-by-side and for US-009 coverage).

## Design-language observations

- **Chip vocabulary** exactly matches the 5a Pattern B recommendation: solid StateChip (Approved green, Pending purple, Rejected red, Superseded/AutoClosed grey) + outlined EvidenceChip (Awaiting amber, Verified green, Mismatch red, Overridden purple, Not-needed grey). Color palette (#0F7A52 green, #580A46 primary purple, #C22C2C red, #E0B870 amber outlines) is consistent everywhere I looked.
- **Typography**: Plus Jakarta Sans + IBM Plex Mono are pulled in `globals.css`; monospace is used for RC-* / ADD-* / oracle IDs / dates in tables — matches the mockup convention of "code = mono".
- **Spacing / card language**: card component (ui/Card.tsx) matches the mockup's white card + 1px border + soft shadow. Section headers are `1`/`2`/`3` chips followed by a title — the mockup pattern from 5b/5c/5d is preserved.
- **Mobile behavior**: `useMediaQuery` at 768px switches `/submit` to a step-of-5 mobile shell (5f) with sticky bottom "Continue" and "Save as draft" — clean. `/requests` at 390px stacks the sections vertically (7d mobile).
- **Drift**: The `Guardrail refresh` page (6f) breaks the visual language entirely — a raw JSON textarea in an otherwise pill/table-heavy product. That page needs a design pass.

## Recommended next actions

1. Ship the FR-07 override flow on `/legal/[id]` — it is the single blocking KRD gap.
2. Redesign `/admin/guardrails` (6f) with a diff view and a BizFin approval state.
3. Extend `Clause` and `Incentive` types to satisfy FR-03 structured capture, then wire the fields into `SubmitDesktopSc`.
4. Convert 5g inline blockers to phone-card full-screen guards on mobile.
5. Add filters + dual chips + variance report on `/controllership` (7a/7b).
6. Fix the hydration mismatch on `/approvals/[id]` (locale date formatting).
7. Gate `/admin/delegation` to Controllership.
8. Add a "Revise" CTA on rejected rows in `/requests`.

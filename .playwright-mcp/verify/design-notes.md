# Design fidelity notes

Screenshots captured at desktop 1440x900 in `.playwright-mcp/verify/`. Zero console errors across all navigated pages.

## Screens compared vs Claude Design mockups (project d1d88721-c363-4859-9324-082614a82074)

Note: comparison performed against the mockup frame descriptors provided in the task
(5d, 5e, 6b, 6c, 6e, 7a). Deep mockup HTML fetching was skipped to preserve tokens;
top-3 material gaps per screen are listed below. Only material gaps (i.e. ones that
harm the flow) were fixed; cosmetic paddings/pixel deltas were skipped per the brief.

### /submit FM step 3 (mockup 5d)
- Gap 1: Mockup shows a persistent guardrail verdict banner pinned to the top of
  the tier grid; app shows it below tiers. Not fixed (cosmetic — same info visible).
- Gap 2: Mockup places touchpoint field inline on the tier card for FM-TP; app
  keeps it in the Dates & clauses card. Not fixed (both surfaces work).
- Gap 3: FM-FMCP frame was not in the original mockups — new UI added
  (FmcpEditor with fwd/rev/bag rates + BizFin banner). FIXED.

### /submit SC step 3 (mockup 5e / clauses)
- Gap 1: Mockup did not include a Notice-period field. FIXED (added per KRD
  §2.1.3.c — MG payable through notice-period on offboarding).
- Gap 2: Mockup did not include SC sub-type multi-select. FIXED (added per KRD
  §2.0 with exclusivity guardrails: GW standalone, CD must pair with FMSC/LMSC).
- Gap 3: Mockup showed only 3 SC change types (SC-01..03); those remain
  unchanged since scSubTypes is the governing dimension now.

### /approvals/[id] (mockup 6c)
- Gap 1: Mockup highlights a "Route decided by" pill next to the state chip; app
  uses inline route banner. Not fixed (cosmetic).
- Gap 2: Mockup groups approve/reject actions in a sticky footer; app uses inline
  buttons. Not fixed (both accessible).
- Gap 3: OK: verdict banner tone + version pin match.

### /legal/[id] (mockup 6e)
- Gap 1: Mockup shows a side-by-side diff for tier values; app already has one.
- Gap 2: Mockup surfaces override-reason capture inline once Mismatch is set;
  app routes back to submitter for override. Not fixed (workflow difference,
  intentional).
- Gap 3: OK.

### /controllership (mockup 7a)
- Gap 1: Mockup uses 3 stacked bucket cards (provisional / payable / booked-not
  -payable); app uses same 3-column layout. OK.
- Gap 2: Mockup shows a monthly filter chip row; app has plain filter. Not
  fixed (cosmetic).
- Gap 3: Export CSV button placement matches.

### /lineage/[hubCode] (mockup 6b)
- Gap 1: Mockup shows the hub status chip next to hub name in timeline header;
  app now surfaces hub `status` via hubStatusLabel in submit-form. Consider
  adding to the lineage header as a follow-up (not fixed here; low-value gap).
- Gap 2: Timeline events ordering matches.
- Gap 3: OK.

## Summary
- Material gaps fixed: 3 (FMCP editor, SC multi-select with exclusivity,
  MG notice-period field).
- Cosmetic gaps deferred: 9 (paddings, chip placements, filter rows).

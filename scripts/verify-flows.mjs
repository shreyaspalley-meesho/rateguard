// End-to-end flow verification. Loads the store in Node (no React) and drives it.
import { pathToFileURL } from 'node:url';
import { register } from 'node:module';

// Register tsx loader for TS imports
try { register('tsx/esm', pathToFileURL('./')); } catch {}

const results = [];
const ok = (name, extra = '') => results.push({ pass: true, name, extra });
const fail = (name, why) => results.push({ pass: false, name, why });

// Shim minimal browser APIs zustand/persist expects
const memStorage = {
  _s: {},
  getItem(k) { return this._s[k] ?? null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};
globalThis.localStorage = memStorage;
globalThis.window = { localStorage: memStorage };

const { useApp } = await import('../src/lib/store.ts');
const { evaluate, buildRequestId, nextSeq, abnormalCheck } = await import('../src/lib/guardrail.ts');
const { validateScTypes, getSlabOptions, isTouchpointApplicable } = await import('../src/lib/hub-rules.ts');
const store = useApp;
const s = () => store.getState();

// Reset to clean seed
s().reseed();

// ------------ Guardrail unit tests ------------
{
  const gv = s().guardrails[0];
  const ssy = s().hubs.find(h => h.code === 'SSY');
  const within = evaluate(gv, ssy, 'FM-NEW', [
    { upTo: 2500, rate: 2.30 }, { upTo: 5000, rate: 2.05 }, { upTo: 7500, rate: 1.95 },
    { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.70 }, { upTo: null, rate: 1.55 },
  ], 'FM');
  within.status === 'within' && within.route === 'OpsHead-FM'
    ? ok('guardrail: within band SSY FM-NEW routes to Ops Head (FM)')
    : fail('guardrail: within band SSY FM-NEW', JSON.stringify(within));

  const breach = evaluate(gv, ssy, 'FM-NEW', [
    { upTo: 2500, rate: 2.60 }, { upTo: 5000, rate: 2.05 }, { upTo: 7500, rate: 1.95 },
    { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.70 }, { upTo: null, rate: 1.55 },
  ], 'FM');
  breach.status === 'breach' && breach.route === 'BizFin' && breach.breachedTiers[0] === 0
    ? ok('guardrail: tier-1 breach routes to BizFin')
    : fail('guardrail: tier-1 breach', JSON.stringify(breach));

  const blr7 = s().hubs.find(h => h.code === 'BLR7');
  const sc = evaluate(gv, blr7, 'SC-SLAB', [{ upTo: null, rate: 12.5 }], 'SC');
  sc.route === 'BizFin' && sc.status === 'no-ceiling' && sc.breachedTiers.length === 0
    ? ok('guardrail: SC-SLAB routes to BizFin, no tier breaches reported')
    : fail('guardrail: SC-SLAB routing', JSON.stringify(sc));

  const fmsc = s().hubs.find(h => h.code === 'FMSC1');
  const naFmsc = evaluate(gv, fmsc, 'SC-CD', [], 'SC');
  naFmsc.route === 'BizFin' && naFmsc.status === 'no-ceiling'
    ? ok('guardrail: SC-CD hub -> BizFin, no-ceiling')
    : fail('guardrail: SC-CD', JSON.stringify(naFmsc));

  // Abnormal-rate check for Touchpoint clause (KRD §1.1.3) — key off clause.touchpointRate now.
  const abn = abnormalCheck('FM-NEW', [{ upTo: 2500, rate: 50 }], { touchpointRate: 15 });
  abn && abn.includes('₹15')
    ? ok('abnormal-rate soft check fires for Touchpoint clause ₹15')
    : fail('abnormal check', String(abn));

  // Mini Hub — hub-type-only guardrail (no city dimension). Real ceiling row from xlsx: [3.20,3.00,2.73,2.55,2.38,2.20].
  const hub47 = s().hubs.find(h => h.code === 'HUB47');
  const miniWithin = evaluate(gv, hub47, 'FM-NEW', [
    { upTo: 2500, rate: 3.15 }, { upTo: 5000, rate: 2.95 }, { upTo: 7500, rate: 2.70 },
    { upTo: 10000, rate: 2.50 }, { upTo: 12500, rate: 2.30 }, { upTo: null, rate: 2.15 },
  ], 'FM');
  miniWithin.status === 'within' && miniWithin.route === 'OpsHead-FM'
    ? ok('guardrail: Mini Hub within-band uses hub-type-only ceiling (no city)')
    : fail('guardrail Mini Hub within', JSON.stringify(miniWithin));

  const miniBreach = evaluate(gv, hub47, 'FM-NEW', [
    { upTo: 2500, rate: 3.30 }, { upTo: 5000, rate: 2.95 }, { upTo: 7500, rate: 2.70 },
    { upTo: 10000, rate: 2.50 }, { upTo: 12500, rate: 2.30 }, { upTo: null, rate: 2.15 },
  ], 'FM');
  miniBreach.status === 'breach' && miniBreach.route === 'BizFin'
    ? ok('guardrail: Mini Hub breach routes to BizFin')
    : fail('guardrail Mini Hub breach', JSON.stringify(miniBreach));

  // Seller Led Hub — hub-type-only guardrail (KRD §1.0). Real ceiling row from xlsx: [1.50 × 6] flat.
  const hub22 = s().hubs.find(h => h.code === 'HUB22');
  const slhWithin = evaluate(gv, hub22, 'FM-NEW', [
    { upTo: 2500, rate: 1.50 }, { upTo: 5000, rate: 1.50 }, { upTo: 7500, rate: 1.50 },
    { upTo: 10000, rate: 1.50 }, { upTo: 12500, rate: 1.50 }, { upTo: null, rate: 1.45 },
  ], 'FM');
  slhWithin.status === 'within' && slhWithin.route === 'OpsHead-FM'
    ? ok('guardrail: Seller Led Hub within-band uses hub-type-only ceiling')
    : fail('guardrail SLH within', JSON.stringify(slhWithin));
}

// ------------ KRD §1.0 getSlabOptions helper ------------
{
  getSlabOptions('Standalone') === 'slab-old-or-new' &&
  getSlabOptions('Mall Hub') === 'slab-old-or-new' &&
  getSlabOptions('Mini Hub') === 'slab-old-or-new' &&
  getSlabOptions('Seller Led Hub') === 'slab-old-or-new'
    ? ok('getSlabOptions: 4 slab hub types → slab-old-or-new')
    : fail('getSlabOptions slab types', 'unexpected');
  getSlabOptions('FMCP') === 'flat-fmcp'
    ? ok('getSlabOptions: FMCP → flat-fmcp')
    : fail('getSlabOptions FMCP', 'unexpected');
  isTouchpointApplicable('Standalone') && isTouchpointApplicable('Seller Led Hub') && !isTouchpointApplicable('FMCP')
    ? ok('isTouchpointApplicable: applicable except FMCP')
    : fail('isTouchpointApplicable', 'unexpected');
}

// ------------ Request ID + nextSeq ------------
{
  const id = buildRequestId('FM', 'SSY', '2026-09-16', 4);
  id === 'RC-FM-SSY-202609-004' ? ok(`request ID format ${id}`) : fail('id format', id);
  const seq = nextSeq(['RC-FM-SSY-202609-003', 'RC-FM-SSY-202609-001', 'RC-FM-OTHER-202609-005'], 'SSY', '202609');
  seq === 4 ? ok('nextSeq computes 4') : fail('nextSeq', String(seq));
}

// ------------ CUJ-1: within-band FM end-to-end ------------
{
  s().reseed();
  s().setPersona('fm-cluster');
  const req = s().submitRequest({
    hubCode: 'SSY', changeType: 'FM-NEW',
    tiers: [
      { upTo: 2500, rate: 2.30 }, { upTo: 5000, rate: 2.05 }, { upTo: 7500, rate: 1.95 },
      { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.70 }, { upTo: null, rate: 1.55 },
    ],
    effectiveFrom: '2026-10-01', negotiatedOn: '2026-09-16',
    remarks: 'CUJ-1 within-band happy path',
  });
  req.route === 'OpsHead-FM' && req.state === 'Pending'
    ? ok(`CUJ-1: submitted ${req.id} routed to Ops Head (FM), Pending`)
    : fail('CUJ-1 submit', JSON.stringify({ route: req.route, state: req.state }));

  s().approve(req.id, 'Tajinder Kaur', 'Ops Head (FM)', 'Within band, cleared');
  let after = s().requests.find(r => r.id === req.id);
  after.state === 'Approved' && after.evidence === 'Awaiting'
    ? ok('CUJ-1: Ops Head approves → Approved / Awaiting addendum')
    : fail('CUJ-1 approve', JSON.stringify({ state: after.state, evidence: after.evidence }));

  s().uploadAddendum(req.id, 'spotdraft://demo/agreement-1', 'Verified');
  after = s().requests.find(r => r.id === req.id);
  after.state === 'Executed' && after.evidence === 'Verified' && after.addendumId
    ? ok(`CUJ-1: Legal verify → Executed / Verified, addendum ${after.addendumId}`)
    : fail('CUJ-1 verify', JSON.stringify({ state: after.state, evidence: after.evidence }));

  // Notifications fired at each step
  const notifCount = s().notifications.filter(n => n.requestId === req.id).length;
  notifCount >= 2
    ? ok(`CUJ-1: notifications fired (${notifCount})`)
    : fail('CUJ-1 notifications', `only ${notifCount}`);
}

// ------------ CUJ-2: out-of-band SC + mismatch + override ------------
{
  s().reseed();
  s().setPersona('sc-biz');
  const req = s().submitRequest({
    hubCode: 'BLR7', changeType: 'SC-SLAB',
    tiers: [{ upTo: null, rate: 14.0 }],
    effectiveFrom: '2026-10-05', negotiatedOn: '2026-09-15',
    remarks: 'CUJ-2 SC out-of-band',
  });
  req.route === 'BizFin' ? ok(`CUJ-2: SC ${req.id} routed to BizFin`) : fail('CUJ-2 route', req.route);
  s().approve(req.id, 'Vidhi Sharma', 'BizFin', 'Business need substantiated');
  s().uploadAddendum(req.id, 'spotdraft://demo/agreement-mismatch', 'Mismatch');
  let after = s().requests.find(r => r.id === req.id);
  after.state === 'Approved' && after.evidence === 'Mismatch'
    ? ok('CUJ-2: Legal Mismatch keeps state Approved, evidence Mismatch')
    : fail('CUJ-2 mismatch', JSON.stringify({ state: after.state, evidence: after.evidence }));

  s().override(req.id, 'Priya Menon', 'Rate ₹14.0 negotiated on 12 Sep, addendum captured ₹14.5 in error; original binding.');
  after = s().requests.find(r => r.id === req.id);
  after.state === 'Executed' && after.evidence === 'Overridden' && after.overrideReason
    ? ok('CUJ-2: submitter override → Executed / Overridden with reason')
    : fail('CUJ-2 override', JSON.stringify(after));
}

// ------------ CUJ-3: provisional shown ------------
{
  s().reseed();
  const prov = s().requests.find(r => r.id === 'RC-FM-HUB14-202608-001');
  prov && prov.state === 'Approved' && prov.evidence === 'Awaiting'
    ? ok('CUJ-3: seeded provisional request visible (Approved, Awaiting)')
    : fail('CUJ-3 provisional seed', prov ? prov.state : 'missing');
}

// ------------ CUJ-4: TTL auto-close ------------
{
  s().reseed();
  const before = s().requests.filter(r => r.state === 'Pending').length;
  s().advanceClock(20);
  const stillPending = s().requests.filter(r => r.state === 'Pending').length;
  const autoClosed = s().requests.filter(r => r.state === 'AutoClosed').length;
  stillPending < before
    ? ok(`CUJ-4: advance clock 20d flipped ${before - stillPending} pending → auto-closed (total AutoClosed: ${autoClosed})`)
    : fail('CUJ-4 TTL', `pending before ${before} / after ${stillPending}`);
}

// ------------ CUJ-5: guardrail refresh ------------
{
  s().reseed();
  const liveBefore = s().guardrails.find(g => g.state === 'Live').version;
  s().publishGuardrail({
    version: 'v13', effectiveFrom: '2026-10-01', state: 'Live',
    ceilings: [{ hubType: 'Standalone', city: 'Surat', type: 'FM-NEW', tiers: [2.50, 2.20, 2.05, 1.90, 1.78, 1.65] }],
  });
  const gs = s().guardrails;
  const nowLive = gs.find(g => g.state === 'Live');
  const oldStatus = gs.find(g => g.version === liveBefore).state;
  nowLive?.version === 'v13' && oldStatus === 'Superseded'
    ? ok(`CUJ-5: v13 published Live, ${liveBefore} → Superseded`)
    : fail('CUJ-5 publish', JSON.stringify({ nowLive: nowLive?.version, oldStatus }));
}

// ------------ CUJ-6: lineage lookup ------------
{
  s().reseed();
  const hub14reqs = s().requests.filter(r => r.hubCode === 'HUB14');
  const executed = s().requests.find(r => r.state === 'Executed');
  hub14reqs.length > 0 ? ok(`CUJ-6: HUB14 lineage has ${hub14reqs.length} record(s)`) : fail('CUJ-6 lineage', 'no HUB14');
  executed?.agreementUrl ? ok(`CUJ-6: Executed request carries agreementUrl ${executed.agreementUrl}`) : fail('CUJ-6 exec agreement', 'no url');
}

// ------------ CUJ-7: rejection ------------
{
  s().reseed();
  s().setPersona('fm-cluster');
  const req = s().submitRequest({
    hubCode: 'HUB9', changeType: 'FM-OLD',
    tiers: [{ upTo: 5000, rate: 60 }, { upTo: 10000, rate: 55 }, { upTo: 15000, rate: 50 }, { upTo: 20000, rate: 48 }, { upTo: null, rate: 45 }],
    effectiveFrom: '2026-10-10', negotiatedOn: '2026-09-16', remarks: 'CUJ-7 rejection path',
  });
  s().reject(req.id, 'Tajinder Kaur', 'Out of band; negotiate lower');
  const after = s().requests.find(r => r.id === req.id);
  after.state === 'Rejected' && after.rejections[0]?.reason
    ? ok('CUJ-7: rejection with mandatory reason terminates request')
    : fail('CUJ-7 reject', JSON.stringify(after));
}

// ------------ Effective-date integrity (5g blocked state) ------------
// Store does NOT block backdating today; the wizard should. Check whether we can catch this.
{
  s().reseed();
  const liveExec = s().requests.find(r => r.state === 'Executed' && r.hubCode === 'SSY');
  const liveDate = new Date(liveExec.effectiveFrom);
  const earlier = new Date(liveDate.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  // We expect submit to be allowed at store level (backdate guard is in UI), so record as informational
  const req = s().submitRequest({
    hubCode: 'SSY', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 2.30 }, { upTo: 5000, rate: 2.05 }, { upTo: 7500, rate: 1.95 }, { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.70 }, { upTo: null, rate: 1.55 }],
    effectiveFrom: earlier, negotiatedOn: '2026-09-16', remarks: 'backdated',
  });
  req.id ? ok('note: store allows backdated submit — UI must block on Step 4 (5g state)') : fail('backdate note', 'unexpected');
}

// ------------ Concurrent-open (one open per hub × change type) ------------
{
  s().reseed();
  s().setPersona('fm-cluster');
  const a = s().submitRequest({
    hubCode: 'HUB47', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 40 }, { upTo: 5000, rate: 38 }, { upTo: 7500, rate: 36 }, { upTo: 10000, rate: 34 }, { upTo: 12500, rate: 32 }, { upTo: null, rate: 30 }],
    effectiveFrom: '2026-10-01', negotiatedOn: '2026-09-16', remarks: 'first',
  });
  const b = s().submitRequest({
    hubCode: 'HUB47', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 41 }, { upTo: 5000, rate: 38 }, { upTo: 7500, rate: 36 }, { upTo: 10000, rate: 34 }, { upTo: 12500, rate: 32 }, { upTo: null, rate: 30 }],
    effectiveFrom: '2026-10-02', negotiatedOn: '2026-09-16', remarks: 'second (should be blocked in UI)',
  });
  a.id && b.id
    ? ok('note: store allows concurrent-open submits — UI must block on Step 1 (5g state)')
    : fail('concurrent note', 'unexpected');
}

// ------------ KRD §2.0 validateScTypes ------------
{
  const v1 = validateScTypes(['FMSC']);
  v1.ok ? ok('validateScTypes: FMSC alone valid') : fail('scTypes FMSC', v1.reason);

  const v2 = validateScTypes(['FMSC', 'LMSC']);
  v2.ok ? ok('validateScTypes: FMSC+LMSC valid (slabs merge)') : fail('scTypes FMSC+LMSC', v2.reason);

  const v3 = validateScTypes(['FMSC', 'CD']);
  v3.ok ? ok('validateScTypes: FMSC+CD valid (CD paired)') : fail('scTypes FMSC+CD', v3.reason);

  const v4 = validateScTypes(['CD']);
  !v4.ok && v4.reason.includes('CrossDock')
    ? ok('validateScTypes: CD alone rejected')
    : fail('scTypes CD alone', JSON.stringify(v4));

  const v5 = validateScTypes(['GW', 'FMSC']);
  !v5.ok && v5.reason.includes('Gateway')
    ? ok('validateScTypes: GW+FMSC rejected (GW standalone)')
    : fail('scTypes GW+FMSC', JSON.stringify(v5));

  const v6 = validateScTypes(['GW']);
  v6.ok ? ok('validateScTypes: GW alone valid') : fail('scTypes GW alone', v6.reason);

  const v7 = validateScTypes([]);
  !v7.ok ? ok('validateScTypes: empty rejected') : fail('scTypes empty', 'should reject');
}

// ------------ Fix 1: submitter hub-type override (KRD §II.3.6) ------------
{
  s().reseed();
  const gv = s().guardrails[0];
  // SSY is mapped as Standalone in Surat. If the submitter selects Mini Hub instead,
  // the guardrail must evaluate against Mini Hub (hub-type-only), NOT Standalone × Surat.
  // Real Surat Standalone (from xlsx) is roughly [3.05, 2.9, 2.68, 2.45, 2.23, 2.0].
  // Real Mini Hub flat is [3.20, 3.00, 2.73, 2.55, 2.38, 2.20] — slightly higher for tier 1.
  // Rates [3.15, 2.95, 2.70, 2.50, 2.30, 2.15]: within Mini Hub, but breach Surat tier 1 (3.15 > 3.05).
  const ssy = s().hubs.find(h => h.code === 'SSY');
  const overrideTiers = [
    { upTo: 2500, rate: 3.15 }, { upTo: 5000, rate: 2.95 }, { upTo: 7500, rate: 2.70 },
    { upTo: 10000, rate: 2.50 }, { upTo: 12500, rate: 2.30 }, { upTo: null, rate: 2.15 },
  ];
  const asMini = evaluate(gv, ssy, 'FM-NEW', overrideTiers, 'FM', 'Mini Hub');
  asMini.status === 'within' && asMini.route === 'OpsHead-FM'
    ? ok('Fix 1: submitter overrides SSY mapping (Standalone→Mini Hub); guardrail routes via Mini Hub × hub-type-only')
    : fail('Fix 1: hubType override', JSON.stringify(asMini));

  // Without override, same tiers breach Surat Standalone.
  const asStandalone = evaluate(gv, ssy, 'FM-NEW', overrideTiers, 'FM');
  asStandalone.status === 'breach' && asStandalone.route === 'BizFin'
    ? ok('Fix 1: without override, same SSY rates breach Standalone × Surat and route to BizFin')
    : fail('Fix 1: no-override baseline', JSON.stringify(asStandalone));

  // End-to-end via submitRequest with submittedHubType
  s().setPersona('fm-cluster');
  const req = s().submitRequest({
    hubCode: 'SSY', changeType: 'FM-NEW',
    submittedHubType: 'Mini Hub',
    tiers: overrideTiers,
    effectiveFrom: '2026-10-01', negotiatedOn: '2026-09-16', remarks: 'Hub type override test',
  });
  req.route === 'OpsHead-FM' && req.submittedHubType === 'Mini Hub'
    ? ok(`Fix 1: submitRequest persists submittedHubType and routes via override (${req.id})`)
    : fail('Fix 1: submitRequest override', JSON.stringify({ route: req.route, submittedHubType: req.submittedHubType }));
}

// ------------ FMCP routes to BizFin ------------
{
  s().reseed();
  const gv = s().guardrails[0];
  const fmcp = s().hubs.find(h => h.code === 'FMCP1');
  fmcp ? ok('seed: FMCP1 hub exists with hubType=FMCP') : fail('FMCP seed', 'no FMCP1 hub');
  const verdict = evaluate(gv, fmcp, 'FM-FMCP', [], 'FM');
  verdict.route === 'BizFin' && verdict.status === 'not-applicable'
    ? ok('guardrail: FMCP hub + FM-FMCP → BizFin, not-applicable')
    : fail('FMCP routing', JSON.stringify(verdict));
}

// ------------ Real FM guardrail ceilings (from FM hub city rate card xlsx) ------------
{
  s().reseed();
  const gv = s().guardrails[0];
  const rowCount = gv.ceilings.length;
  rowCount >= 400
    ? ok(`guardrail: v12 loaded ${rowCount} ceiling rows from ratecard xlsx`)
    : fail('guardrail xlsx load', `only ${rowCount} ceilings`);
  const tpCount = (gv.touchpoints ?? []).length;
  tpCount >= 400
    ? ok(`guardrail: v12 loaded ${tpCount} touchpoint ceilings`)
    : fail('guardrail xlsx touchpoints', `only ${tpCount} touchpoints`);

  const { evaluate: ev, checkTouchpoint } = await import('../src/lib/guardrail.ts');

  // Agra Standalone FM-NEW: [3.25, 3.10, 3.08, 3.05, 3.03, 3.00]
  const agraHub = { code: 'AGRA1', name: 'Test Agra', city: 'Agra', hubType: 'Standalone', segment: 'FM', active: true, oracleId: 'X', owner: 'X', zone: 'North', status: 'GoLivePending' };
  const agraWithin = ev(gv, agraHub, 'FM-NEW', [
    { upTo: 2500, rate: 3.20 }, { upTo: 5000, rate: 3.05 }, { upTo: 7500, rate: 3.05 },
    { upTo: 10000, rate: 3.00 }, { upTo: 12500, rate: 3.00 }, { upTo: null, rate: 2.95 },
  ], 'FM');
  agraWithin.status === 'within' && agraWithin.route === 'OpsHead-FM'
    ? ok('guardrail: Agra Standalone within-band → Ops Head (FM)')
    : fail('Agra within', JSON.stringify(agraWithin));
  const agraBreach = ev(gv, agraHub, 'FM-NEW', [
    { upTo: 2500, rate: 3.30 }, { upTo: 5000, rate: 3.05 }, { upTo: 7500, rate: 3.05 },
    { upTo: 10000, rate: 3.00 }, { upTo: 12500, rate: 3.00 }, { upTo: null, rate: 2.95 },
  ], 'FM');
  agraBreach.status === 'breach' && agraBreach.breachedTiers[0] === 0
    ? ok('guardrail: Agra Standalone tier-1 breach (₹3.30 > ₹3.25) → BizFin')
    : fail('Agra breach', JSON.stringify(agraBreach));

  // Ajmer Mall Hub FM-NEW: [2.55, 2.30, 2.10, 1.90, 1.70, 1.50]
  const ajmerMall = { code: 'AJMER-M', name: 'Test Ajmer Mall', city: 'Ajmer', hubType: 'Mall Hub', segment: 'FM', active: true, oracleId: 'X', owner: 'X', zone: 'North', status: 'GoLivePending' };
  const ajmerBreach = ev(gv, ajmerMall, 'FM-NEW', [
    { upTo: 2500, rate: 2.70 }, { upTo: 5000, rate: 2.20 }, { upTo: 7500, rate: 2.00 },
    { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.60 }, { upTo: null, rate: 1.40 },
  ], 'FM');
  ajmerBreach.status === 'breach'
    ? ok('guardrail: Ajmer Mall Hub tier-1 breach → BizFin')
    : fail('Ajmer Mall breach', JSON.stringify(ajmerBreach));

  // Mini Hub flat FM-NEW: [3.20, 3.00, 2.73, 2.55, 2.38, 2.20]
  const hub47 = s().hubs.find(h => h.code === 'HUB47');
  const miniOK = ev(gv, hub47, 'FM-NEW', [
    { upTo: 2500, rate: 3.10 }, { upTo: 5000, rate: 2.95 }, { upTo: 7500, rate: 2.70 },
    { upTo: 10000, rate: 2.50 }, { upTo: 12500, rate: 2.30 }, { upTo: null, rate: 2.10 },
  ], 'FM');
  miniOK.status === 'within'
    ? ok('guardrail: Mini Hub flat within-band matches sheet flat row')
    : fail('Mini Hub within', JSON.stringify(miniOK));

  // Touchpoint check: Agra Standalone touchpoint ceiling 5.0.
  const tpWithin = checkTouchpoint(gv, 'Standalone', 'Agra', 4.5);
  tpWithin.within && tpWithin.ceiling === 5.0
    ? ok('touchpoint: Agra Standalone ₹4.50 within ceiling ₹5.00')
    : fail('touchpoint within', JSON.stringify(tpWithin));
  const tpBreach = checkTouchpoint(gv, 'Standalone', 'Agra', 6.0);
  !tpBreach.within && tpBreach.ceiling === 5.0
    ? ok('touchpoint: Agra Standalone ₹6.00 breaches ceiling ₹5.00')
    : fail('touchpoint breach', JSON.stringify(tpBreach));

  // End-to-end: touchpoint breach escalates a within-band tier submission to BizFin.
  const withTpBreach = ev(gv, agraHub, 'FM-NEW', [
    { upTo: 2500, rate: 3.20 }, { upTo: 5000, rate: 3.05 }, { upTo: 7500, rate: 3.05 },
    { upTo: 10000, rate: 3.00 }, { upTo: 12500, rate: 3.00 }, { upTo: null, rate: 2.95 },
  ], 'FM', undefined, { touchpointRate: 6.0 });
  withTpBreach.route === 'BizFin' && withTpBreach.touchpoint && !withTpBreach.touchpoint.within
    ? ok('guardrail: within-band tiers + touchpoint breach → BizFin (touchpoint carries verdict)')
    : fail('touchpoint escalation', JSON.stringify(withTpBreach));

  // Seed hub cities now match the sheet — HUB14 (Bengaluru), HUB47 (Mysore).
  const hub14 = s().hubs.find(h => h.code === 'HUB14');
  hub14?.city === 'Bengaluru' ? ok('seed: HUB14 city normalized to Bengaluru') : fail('HUB14 city', hub14?.city);
  const hub47b = s().hubs.find(h => h.code === 'HUB47');
  hub47b?.city === 'Mysore' ? ok('seed: HUB47 city normalized to Mysore') : fail('HUB47 city', hub47b?.city);
}

// ------------ KRD §2.1 SC-SLAB / SC-CD ------------
{
  s().reseed();
  const gv = s().guardrails[0];
  const blr7 = s().hubs.find(h => h.code === 'BLR7');

  // Seven vendor-defined tiers, SC-SLAB — routes to BizFin, no-ceiling, no breaches.
  const sevenTiers = [
    { upTo: 5000, rate: 3.10 },
    { upTo: 12000, rate: 2.85 },
    { upTo: 25000, rate: 2.62 },
    { upTo: 40000, rate: 2.40 },
    { upTo: 60000, rate: 2.20 },
    { upTo: 80000, rate: 2.05 },
    { upTo: null, rate: 1.90 },
  ];
  const scSlab7 = evaluate(gv, blr7, 'SC-SLAB', sevenTiers, 'SC');
  scSlab7.route === 'BizFin' && scSlab7.status === 'no-ceiling' && scSlab7.breachedTiers.length === 0
    ? ok('SC §2.1: SC-SLAB with 7 vendor tiers routes to BizFin, no-ceiling, empty breachedTiers')
    : fail('SC-SLAB 7 tiers', JSON.stringify(scSlab7));

  // SC-CD flat 3.50 — routes to BizFin.
  const scCdLow = evaluate(gv, blr7, 'SC-CD', [], 'SC', undefined, { crossDockBagRate: 3.50 });
  scCdLow.route === 'BizFin' && scCdLow.status === 'no-ceiling'
    ? ok('SC §2.1.2: SC-CD @ ₹3.50/bag routes to BizFin, no-ceiling')
    : fail('SC-CD low', JSON.stringify(scCdLow));

  // SC-CD flat 4.20 — still routes to BizFin (no hard block).
  const scCdHigh = evaluate(gv, blr7, 'SC-CD', [], 'SC', undefined, { crossDockBagRate: 4.20 });
  scCdHigh.route === 'BizFin' && scCdHigh.status === 'no-ceiling'
    ? ok('SC §2.1.2: SC-CD @ ₹4.20/bag routes to BizFin (no hard block)')
    : fail('SC-CD high', JSON.stringify(scCdHigh));

  // abnormalCheck for SC-CD above ₹4 surfaces informational note.
  const abnHigh = abnormalCheck('SC-CD', [], { crossDockBagRate: 4.20 });
  abnHigh && abnHigh.includes('₹4') && abnHigh.includes('BizFin')
    ? ok('SC §2.0: SC-CD > ₹4/bag surfaces informational abnormal note')
    : fail('SC-CD abnormal above 4', String(abnHigh));

  const abnLow = abnormalCheck('SC-CD', [], { crossDockBagRate: 3.50 });
  abnLow === null
    ? ok('SC §2.0: SC-CD ≤ ₹4/bag has no abnormal note')
    : fail('SC-CD abnormal below 4', String(abnLow));
}

// ------------ Blended helper (KRD §2.1.1.c.iii) ------------
{
  const { computeBlended, tierAscendingViolations } = await import('../src/lib/blended.ts');
  const tiers = [
    { upTo: 5000, rate: 3.10 },
    { upTo: 12000, rate: 2.85 },
    { upTo: 25000, rate: 2.62 },
    { upTo: 40000, rate: 2.40 },
    { upTo: null, rate: 2.10 },
  ];
  const blended = computeBlended(tiers);
  // T1 blended: 3.10 (only slab).
  Math.abs(blended[0] - 3.10) < 0.005
    ? ok('blended T1 = ₹3.10 (single slab)')
    : fail('blended T1', String(blended[0]));
  // T2 blended: (3.10*5000 + 2.85*7000) / 12000 = 2.954166...
  Math.abs(blended[1] - 2.9542) < 0.01
    ? ok(`blended T2 ≈ ₹${blended[1].toFixed(2)} (weighted 3.10*5000 + 2.85*7000 / 12000)`)
    : fail('blended T2', String(blended[1]));
  // Last tier (upTo:null) has no blended.
  blended[4] === null
    ? ok('blended: open-ended top tier returns null')
    : fail('blended open-ended', String(blended[4]));

  // Ascending violation — descending upTo in middle triggers flag on that tier.
  const bad = [
    { upTo: 5000, rate: 3.10 },
    { upTo: 3000, rate: 2.85 }, // ← violation
    { upTo: null, rate: 2.50 },
  ];
  const flags = tierAscendingViolations(bad);
  flags[0] === false && flags[1] === true && flags[2] === false
    ? ok('ascending: descending middle upTo flagged; open-ended top never flagged')
    : fail('ascending violations', JSON.stringify(flags));

  // Last-tier upTo:null never violates.
  const okTiers = [
    { upTo: 5000, rate: 3.10 },
    { upTo: 10000, rate: 2.85 },
    { upTo: null, rate: 2.50 },
  ];
  const flagsOk = tierAscendingViolations(okTiers);
  flagsOk.every(f => !f)
    ? ok('ascending: valid ascending sequence has no flags')
    : fail('ascending ok', JSON.stringify(flagsOk));
}

// ------------ SC seed migration ------------
{
  s().reseed();
  const scSlabSeed = s().requests.find(r => r.id === 'RC-SC-BLR7-202609-001');
  scSlabSeed && scSlabSeed.changeType === 'SC-SLAB' && scSlabSeed.tiers.length === 3
    ? ok(`seed: BLR7 SC-SLAB migrated (3 vendor tiers, changeType=SC-SLAB)`)
    : fail('seed SC-SLAB', JSON.stringify(scSlabSeed));
  const scCdSeed = s().requests.find(r => r.changeType === 'SC-CD');
  scCdSeed && scCdSeed.clause?.crossDockBagRate === 14.0
    ? ok(`seed: SC-CD request present with crossDockBagRate ₹14.00`)
    : fail('seed SC-CD', JSON.stringify(scCdSeed));
}

// ------------ Report ------------
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass);
console.log(`\n=== FLOW VERIFICATION ===`);
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.pass && r.extra ? ' — ' + r.extra : ''}${!r.pass ? ' — ' + r.why : ''}`);
}
console.log(`\n${passed}/${results.length} passed`);
if (failed.length) process.exit(1);

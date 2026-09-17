import type { GuardrailVersion, Hub, HubType, Tier, ChangeType, ApprovalRoute, Segment, Clause } from './types';

export interface GuardrailVerdict {
  route: ApprovalRoute;
  status: 'within' | 'breach' | 'no-ceiling' | 'not-applicable';
  ceiling?: number[];
  breachedTiers: number[];
  reason: string;
  version: string;
  /** Populated only when a touchpoint clause was checked. */
  touchpoint?: TouchpointVerdict;
}

export interface TouchpointVerdict {
  within: boolean;
  ceiling: number | null;
  rate: number;
  reason: string;
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

/** KRD §1.1.3 — check a touchpoint rate against the guardrail's touchpoint ceilings. */
export function checkTouchpoint(
  guardrail: GuardrailVersion,
  hubType: HubType | undefined,
  city: string | undefined,
  rate: number,
): TouchpointVerdict {
  if (!hubType) {
    return { within: false, ceiling: null, rate, reason: 'No hub type — cannot resolve touchpoint ceiling' };
  }
  const rows = guardrail.touchpoints ?? [];
  const perCity = hubType === 'Standalone' || hubType === 'Mall Hub';
  const match = rows.find(r =>
    r.hubType === hubType &&
    (!perCity || norm(r.city) === norm(city))
  );
  if (!match) {
    return { within: false, ceiling: null, rate, reason: `No touchpoint ceiling for ${hubType}${perCity ? ` × ${city ?? '?'}` : ''}` };
  }
  const within = rate <= match.ceiling;
  return {
    within,
    ceiling: match.ceiling,
    rate,
    reason: within
      ? `Within touchpoint ceiling ₹${match.ceiling.toFixed(2)}`
      : `₹${rate.toFixed(2)} exceeds touchpoint ceiling ₹${match.ceiling.toFixed(2)} — routes to BizFin`,
  };
}

export function evaluate(
  guardrail: GuardrailVersion,
  hub: Hub,
  changeType: ChangeType,
  tiers: Tier[],
  segment: Segment,
  /** Optional explicit hub-type override (KRD §II.3.6). When provided, wins over `hub.hubType`. */
  hubTypeOverride?: HubType,
  /** Optional clause bundle — when a touchpoint rate is included, we also check it. */
  clause?: Clause,
): GuardrailVerdict {
  const route: ApprovalRoute = segment === 'FM' ? 'OpsHead-FM' : 'OpsHead-SC';
  const effectiveHubType: HubType | undefined = hubTypeOverride ?? hub.hubType;

  // Touchpoint side-check (only applicable for the 4 slabbed FM hub types).
  let touchpoint: TouchpointVerdict | undefined;
  if (clause?.touchpointRate !== undefined && effectiveHubType && effectiveHubType !== 'FMCP') {
    touchpoint = checkTouchpoint(guardrail, effectiveHubType, hub.city, clause.touchpointRate);
  }

  if (changeType === 'SC-SLAB' || changeType === 'SC-CD') {
    // KRD OQ-06 — SC has no published ceilings. Every SC submission routes to BizFin.
    // The tier iteration below is skipped intentionally — no breach flags for SC.
    return {
      route: 'BizFin',
      status: 'no-ceiling',
      breachedTiers: [],
      reason: 'SC has no published ceilings — routes to BizFin by rule',
      version: guardrail.version,
      touchpoint,
    };
  }
  if (changeType === 'FM-FMCP' || effectiveHubType === 'FMCP') {
    return { route: 'BizFin', status: 'not-applicable', breachedTiers: [], reason: 'FMCP: no guardrail applies — routes to BizFin', version: guardrail.version, touchpoint };
  }
  if (!effectiveHubType) {
    return { route: 'BizFin', status: 'not-applicable', breachedTiers: [], reason: 'No FM hub type — routes to BizFin', version: guardrail.version, touchpoint };
  }

  // KRD §1.0 — Standalone + Mall Hub are guardrailed by hub-type × city.
  // Mini Hub + Seller Led Hub are hub-type-only.
  const perCity = effectiveHubType === 'Standalone' || effectiveHubType === 'Mall Hub';
  const match = guardrail.ceilings.find(c =>
    c.type === changeType &&
    c.hubType === effectiveHubType &&
    (!perCity || norm(c.city) === norm(hub.city))
  );

  if (!match) {
    return { route: 'BizFin', status: 'no-ceiling', breachedTiers: [], reason: `No ceiling row for ${effectiveHubType}${perCity ? ` × ${hub.city}` : ''} → BizFin`, version: guardrail.version, touchpoint };
  }

  const breached: number[] = [];
  tiers.forEach((t, i) => {
    const ceil = match.tiers[i];
    if (ceil !== undefined && t.rate > ceil) breached.push(i);
  });

  const touchpointOver = touchpoint && !touchpoint.within;
  if (breached.length === 0 && !touchpointOver) {
    return { route, status: 'within', ceiling: match.tiers, breachedTiers: [], reason: `Within band → ${route === 'OpsHead-FM' ? 'Ops Head (FM)' : 'Ops Head (SC)'}`, version: guardrail.version, touchpoint };
  }
  const reasons: string[] = [];
  if (breached.length) reasons.push(`Out of band on tier${breached.length > 1 ? 's' : ''} ${breached.map(i => i + 1).join(', ')}`);
  if (touchpointOver) reasons.push('Touchpoint over ceiling');
  return { route: 'BizFin', status: 'breach', ceiling: match.tiers, breachedTiers: breached, reason: `${reasons.join(' · ')} → BizFin`, version: guardrail.version, touchpoint };
}

export function abnormalCheck(changeType: ChangeType, tiers: Tier[], clause?: Clause): string | null {
  if (clause?.touchpointRate !== undefined) {
    const r = clause.touchpointRate;
    if (r > 8 || r < 1) return `Touchpoint typically ₹2–6/shipment. Entered ₹${r} looks abnormal.`;
  }
  if (changeType === 'FM-NEW' || changeType === 'FM-OLD') {
    const maxRate = Math.max(...tiers.map(t => t.rate));
    if (maxRate > 200) return `Rate ₹${maxRate} looks unusually high — please verify.`;
  }
  // KRD §2.0 — SC-CD flat rate: BizFin approval only needed above ₹4/bag. Below that, informational only.
  if (changeType === 'SC-CD' && clause?.crossDockBagRate !== undefined && clause.crossDockBagRate > 4) {
    return `KRD §2.0: CrossDock rate ₹${clause.crossDockBagRate.toFixed(2)}/bag is above ₹4 — routes to BizFin (expected).`;
  }
  return null;
}

/**
 * FR-24 — abnormal-rate second banner.
 *
 * Compare tier values against ±25% of the median of executed rates for the
 * same (hubType, changeType, tierIndex) across a corpus of prior requests.
 * Returns per-tier flags with a reason string; empty when fewer than 3 samples.
 * Never influences `route` — that stays with the guardrail verdict.
 */
export interface AbnormalFlag {
  tierIndex: number;
  rate: number;
  median: number;
  lower: number;
  upper: number;
  reason: string;
}

const ABN_BAND = 0.25;

export function computeAbnormal(
  hubType: HubType | undefined,
  changeType: ChangeType,
  tiers: Tier[],
  corpus: Array<{ submittedHubType?: HubType; changeType: ChangeType; tiers: Tier[]; state: string }>,
): AbnormalFlag[] {
  if (!hubType) return [];
  const flags: AbnormalFlag[] = [];
  tiers.forEach((t, i) => {
    if (!t.rate || t.rate <= 0) return;
    const samples = corpus
      .filter(r => r.state === 'Executed' && r.changeType === changeType && r.submittedHubType === hubType && r.tiers[i]?.rate)
      .map(r => r.tiers[i].rate);
    if (samples.length < 3) return;
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const lower = median * (1 - ABN_BAND);
    const upper = median * (1 + ABN_BAND);
    if (t.rate < lower || t.rate > upper) {
      flags.push({
        tierIndex: i,
        rate: t.rate,
        median,
        lower,
        upper,
        reason: `T${i + 1} ₹${t.rate.toFixed(2)} is outside typical band ₹${lower.toFixed(2)}–₹${upper.toFixed(2)} (median ₹${median.toFixed(2)} across ${samples.length} executed).`,
      });
    }
  });
  return flags;
}

export function nextSeq(existingIds: string[], hubCode: string, yyyymm: string): number {
  const prefix = `-${hubCode}-${yyyymm}-`;
  const seqs = existingIds
    .filter(id => id.includes(prefix))
    .map(id => parseInt(id.split(prefix)[1] ?? '0', 10))
    .filter(n => !isNaN(n));
  return (seqs.length ? Math.max(...seqs) : 0) + 1;
}

export function buildRequestId(segment: Segment, hubCode: string, dateISO: string, seq: number): string {
  const d = new Date(dateISO);
  const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `RC-${segment}-${hubCode}-${yyyymm}-${String(seq).padStart(3, '0')}`;
}

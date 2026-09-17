import type { Tier } from './types';

/**
 * KRD §2.1.1.c.iii — cumulative weighted-average rate at the top of each SC slab.
 *
 * Weight for tier i is the slab width: `tier[i].upTo - tier[i-1].upTo`
 * (tier 1's previous upper limit is 0). Blended[i] = Σ(rate_k * width_k) / upTo_i
 * for k ∈ [0..i].
 *
 * The open-ended top tier (`upTo === null`) has no width and no ceiling,
 * so it has no blended value — returned as `null`. Callers render `—`.
 *
 * Returns an array of length `tiers.length`, one blended per tier (or null).
 */
export function computeBlended(tiers: Tier[]): Array<number | null> {
  const out: Array<number | null> = [];
  let prevUpTo = 0;
  let cumulative = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.upTo === null) {
      out.push(null);
      continue;
    }
    const width = t.upTo - prevUpTo;
    if (width <= 0) {
      // Non-ascending — blended is undefined. Return null and let the row-level
      // validator surface the ascending-order violation.
      out.push(null);
      prevUpTo = t.upTo;
      continue;
    }
    cumulative += (t.rate || 0) * width;
    out.push(cumulative / t.upTo);
    prevUpTo = t.upTo;
  }
  return out;
}

/**
 * KRD §2.1.1.c.i — upper-limit ascending rule.
 * Returns an array of booleans: `true` when tier i's upTo is NOT greater than tier i-1's upTo.
 * The last tier (upTo === null) is always considered valid (open-ended).
 */
export function tierAscendingViolations(tiers: Tier[]): boolean[] {
  return tiers.map((t, i) => {
    if (t.upTo === null) return false;
    if (i === 0) return false;
    const prev = tiers[i - 1];
    if (prev.upTo === null) return false; // shouldn't happen but be defensive
    return t.upTo <= prev.upTo;
  });
}

/**
 * Vendor SC slabs usually descend in rate as volume rises. When a tier's rate is
 * higher than the previous tier's, flag it as a soft "rising rate" warning
 * (does not block submit — mockup 5f rule 3).
 */
export function tierRisingRateFlags(tiers: Tier[]): boolean[] {
  return tiers.map((t, i) => {
    if (i === 0) return false;
    const prev = tiers[i - 1];
    if (!prev.rate || !t.rate) return false;
    return t.rate > prev.rate;
  });
}

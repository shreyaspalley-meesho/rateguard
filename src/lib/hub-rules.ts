import type { HubType, ScSubType } from './types';

/**
 * KRD §1.0 — decides the slab structure a given FM hub type supports.
 *  - FMCP: flat rates only (Fwd + Rev + Bag), no slabs.
 *  - Everything else: Old (5 tiers × 5,000 wide) or New (6 tiers × 2,500 wide).
 */
export function getSlabOptions(hubType: HubType): 'flat-fmcp' | 'slab-old-or-new' | 'undefined' {
  if (hubType === 'FMCP') return 'flat-fmcp';
  if (hubType === 'LM-as-FM') return 'undefined';
  return 'slab-old-or-new';
}

/**
 * KRD §1.1.3 — Touchpoint is applicable on all FM hub types except FMCP.
 */
export function isTouchpointApplicable(hubType: HubType | undefined): boolean {
  return !!hubType && hubType !== 'FMCP';
}

export type ScValidation = { ok: true } | { ok: false; reason: string };

/**
 * Enforce KRD §2.0 exclusivity rules for SC hub sub-types.
 *
 * Rules:
 *  - GW is standalone: never combined with any other type.
 *  - CD must be paired with FMSC or LMSC (CD alone is invalid).
 *  - FMSC + LMSC may co-exist (slabs merge into one structure).
 */
export function validateScTypes(types: ScSubType[]): ScValidation {
  if (types.length === 0) return { ok: false, reason: 'Select at least one SC sub-type.' };
  const set = new Set(types);
  if (set.has('GW') && set.size > 1) {
    return { ok: false, reason: 'Gateway (GW) is always standalone — it cannot be combined with FMSC, LMSC or CD.' };
  }
  if (set.has('CD') && !set.has('FMSC') && !set.has('LMSC')) {
    return { ok: false, reason: 'CrossDock (CD) must be paired with FMSC or LMSC — it does not exist standalone.' };
  }
  return { ok: true };
}

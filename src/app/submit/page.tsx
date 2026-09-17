'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp, useCurrentGuardrail } from '@/lib/store';
import { evaluate, abnormalCheck, computeAbnormal } from '@/lib/guardrail';
import type { ChangeType, Tier, Hub, HubType, Vendor, PersonaId, Incentive, ScSubType, RateRequest } from '@/lib/types';
import { validateScTypes, getSlabOptions, isTouchpointApplicable } from '@/lib/hub-rules';
import { taxonomyFor } from '@/lib/hub-taxonomy';
import { useIsMobile } from '@/lib/useMediaQuery';
import { getConfig } from '@/lib/config';
import { SectionHeader } from '@/components/ui';
import { ScSlabEditor } from '@/components/ScSlabEditor';
import { tierAscendingViolations } from '@/lib/blended';

// ------------- Constants -------------

const FM_NEW_TIERS = [2500, 5000, 7500, 10000, 12500, null];
const FM_OLD_TIERS = [5000, 10000, 15000, 20000, null];

// KRD §1.1.1 — explicit range strings for the two FM slab structures.
const FM_OLD_RANGES = ['< 5,000', '5,000–10,000', '10,000–15,000', '15,000–20,000', '> 20,000'];
const FM_NEW_RANGES = ['< 2,500', '2,500–5,000', '5,000–7,500', '7,500–10,000', '10,000–12,500', '> 12,500'];
const FM_HUB_TYPES: HubType[] = ['Standalone', 'Mall Hub', 'Mini Hub', 'Seller Led Hub', 'FMCP', 'LM-as-FM'];
const SC_SUB_TYPE_OPTIONS: Array<{ value: ScSubType; label: string; description: string }> = [
  { value: 'FMSC', label: 'FMSC', description: 'Slab rate/shipment · MG applicable · may co-exist with LMSC' },
  { value: 'LMSC', label: 'LMSC', description: 'Slab rate/shipment · MG applicable · may co-exist with FMSC' },
  { value: 'CD', label: 'CrossDock (CD)', description: 'Flat rate/bag · must be paired with FMSC or LMSC' },
  { value: 'GW', label: 'Gateway (GW)', description: 'Slab rate/bag · standalone — cannot combine with FMSC/LMSC/CD' },
];

type Variant = 'FM' | 'SC';

function tiersFor(ct: ChangeType): Tier[] {
  if (ct === 'FM-FMCP') return []; // FMCP has no tiers — flat rates only
  if (ct === 'SC-CD') return []; // SC CrossDock — flat ₹/bag rate only
  if (ct === 'SC-SLAB') return [{ upTo: null, rate: 0 }]; // start with one open-ended tier — vendors define the rest (KRD §2.1.1)
  const widths = ct === 'FM-NEW' ? FM_NEW_TIERS : FM_OLD_TIERS;
  return widths.map(w => ({ upTo: w, rate: 0 }));
}

function defaultChangeType(variant: Variant): ChangeType {
  return variant === 'FM' ? 'FM-NEW' : 'SC-SLAB';
}

/**
 * Derive the SC change type from the picked sub-types (KRD §2.0/§2.1).
 *  - Only CD picked → SC-CD (flat ₹/bag)
 *  - Anything with FMSC/LMSC/GW → SC-SLAB (vendor-defined slabs)
 */
function scChangeTypeFor(subTypes: ScSubType[]): ChangeType {
  const only = new Set(subTypes);
  if (only.size === 1 && only.has('CD')) return 'SC-CD';
  return 'SC-SLAB';
}

/**
 * Derive the SC unit (KRD §2.1) — FMSC/LMSC are ₹/shipment; GW and CD are ₹/bag.
 * When mixed FMSC/LMSC + GW is present (validateScTypes rejects this), fall back to shipment.
 */
function scUnitFor(subTypes: ScSubType[]): 'shipment' | 'bag' {
  const set = new Set(subTypes);
  if (set.has('FMSC') || set.has('LMSC')) return 'shipment';
  return 'bag';
}

// ------------- Shared form-state hook -------------

function useSubmitForm(variant: Variant, reviseId?: string) {
  const allHubs = useApp(s => s.hubs);
  const requests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const gv = useCurrentGuardrail();
  const submit = useApp(s => s.submitRequest);
  const revise = useApp(s => s.revise);
  const currentPersona = useApp(s => s.currentPersona);
  const router = useRouter();
  const reviseOriginal = useMemo(
    () => (reviseId ? requests.find(r => r.id === reviseId) : undefined),
    [reviseId, requests],
  );

  const hubs = useMemo(
    () => allHubs.filter(h => h.active && h.segment === variant),
    [allHubs, variant],
  );

  const [hubCode, setHubCode] = useState('');
  const hub = hubs.find(h => h.code === hubCode);
  // KRD §II.3.6 — user must explicitly confirm the hub type; mapping file spelling is unreliable.
  const [selectedHubType, setSelectedHubType] = useState<HubType | undefined>(undefined);
  const [changeType, setChangeType] = useState<ChangeType>(defaultChangeType(variant));
  const [tiers, setTiers] = useState<Tier[]>(tiersFor(defaultChangeType(variant)));
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [negotiatedOn, setNegotiatedOn] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');

  // SC-only clause fields
  const [mg, setMg] = useState('');
  const [mgTrigger, setMgTrigger] = useState('');
  const [lockIn, setLockIn] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [crossDockBagRate, setCrossDockBagRate] = useState('');

  // SC multi-select of sub-types (KRD §2.0)
  const [scSubTypes, setScSubTypes] = useState<ScSubType[]>([]);

  // FM touchpoint (optional, non-FMCP)
  const [touchpointRate, setTouchpointRate] = useState('');

  // FMCP flat rates (KRD §1.1.2)
  const [fwdRate, setFwdRate] = useState('');
  const [revRate, setRevRate] = useState('');
  const [bagRate, setBagRate] = useState('');

  // SC-only incentive
  const [incentiveOn, setIncentiveOn] = useState(false);
  const [incIncremental, setIncIncremental] = useState('');
  const [incPeriod, setIncPeriod] = useState<Incentive['period']>('Month');
  const [incStart, setIncStart] = useState('');
  const [incEnd, setIncEnd] = useState('');

  const [vendorInput, setVendorInput] = useState('');

  // FR-24 — per-tier abnormal-rate explanations. Keyed by tier index.
  const [abnormalReasons, setAbnormalReasons] = useState<Record<number, string>>({});

  // Prefill from `?revise=<id>` — populate once when the target request loads.
  const [prefilled, setPrefilled] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!reviseOriginal || prefilled === reviseOriginal.id) return;
    setHubCode(reviseOriginal.hubCode);
    setSelectedHubType(reviseOriginal.submittedHubType);
    setChangeType(reviseOriginal.changeType);
    setTiers(reviseOriginal.tiers.length ? reviseOriginal.tiers : tiersFor(reviseOriginal.changeType));
    setEffectiveFrom(reviseOriginal.effectiveFrom);
    setNegotiatedOn(reviseOriginal.negotiatedOn);
    setRemarks(reviseOriginal.remarks);
    if (reviseOriginal.vendorSupplierNumber) {
      const v = vendors.find(x => x.supplierNumber === reviseOriginal.vendorSupplierNumber);
      if (v) setVendorInput(`${v.name} #${v.supplierNumber}`);
    }
    if (reviseOriginal.clause) {
      const c = reviseOriginal.clause;
      if (c.mg !== undefined) setMg(String(c.mg));
      if (c.mgTrigger) setMgTrigger(c.mgTrigger);
      if (c.lockInMonths !== undefined) setLockIn(String(c.lockInMonths));
      if (c.noticePeriodMonths !== undefined) setNoticePeriod(String(c.noticePeriodMonths));
      if (c.crossDockBagRate !== undefined) setCrossDockBagRate(String(c.crossDockBagRate));
      if (c.touchpointRate !== undefined) setTouchpointRate(String(c.touchpointRate));
      if (c.fwdRate !== undefined) setFwdRate(String(c.fwdRate));
      if (c.revRate !== undefined) setRevRate(String(c.revRate));
      if (c.bagRate !== undefined) setBagRate(String(c.bagRate));
    }
    setPrefilled(reviseOriginal.id);
  }, [reviseOriginal, prefilled, vendors]);

  // If persona changes mid-flow (variant changes), reset all state.
  useEffect(() => {
    setHubCode('');
    setSelectedHubType(undefined);
    setChangeType(defaultChangeType(variant));
    setTiers(tiersFor(defaultChangeType(variant)));
    setRemarks('');
    setMg(''); setMgTrigger(''); setLockIn(''); setNoticePeriod(''); setCrossDockBagRate('');
    setScSubTypes([]); setTouchpointRate(''); setFwdRate(''); setRevRate(''); setBagRate('');
    setIncentiveOn(false); setIncIncremental(''); setIncPeriod('Month'); setIncStart(''); setIncEnd('');
    setVendorInput('');
  }, [variant, currentPersona]);

  // Pre-select the mapping's hub type as a hint whenever a new FM hub is picked.
  // The user must still actively confirm/change it (KRD §II.3.6).
  // In revise mode the prefill effect owns hub-type — don't clobber it here.
  useEffect(() => {
    if (variant !== 'FM') return;
    if (reviseId && prefilled === reviseId) return;
    setSelectedHubType(hub?.hubType);
  }, [hub, variant, reviseId, prefilled]);

  // When the *selected* hub type is FMCP, force FM-FMCP; snap back otherwise.
  useEffect(() => {
    if (variant !== 'FM' || !hub) return;
    if (selectedHubType === 'FMCP' && changeType !== 'FM-FMCP') {
      setChangeType('FM-FMCP');
      setTiers([]);
    } else if (selectedHubType && selectedHubType !== 'FMCP' && changeType === 'FM-FMCP') {
      setChangeType('FM-NEW');
      setTiers(tiersFor('FM-NEW'));
    }
  }, [hub, variant, changeType, selectedHubType]);

  // Preload scSubTypes from the selected hub for SC variant.
  useEffect(() => {
    if (variant !== 'SC' || !hub) return;
    if (hub.scSubTypes && hub.scSubTypes.length && scSubTypes.length === 0) {
      setScSubTypes(hub.scSubTypes);
    }
  }, [hub, variant, scSubTypes.length]);

  // KRD §2.0/§2.1 — SC change type is derived from the picked sub-types.
  // Only CD → SC-CD (flat ₹/bag). Anything with FMSC/LMSC/GW → SC-SLAB (vendor-defined slabs).
  useEffect(() => {
    if (variant !== 'SC') return;
    if (reviseId && prefilled === reviseId) return; // revise mode owns changeType
    if (scSubTypes.length === 0) return;
    const derived = scChangeTypeFor(scSubTypes);
    if (derived !== changeType) {
      setChangeType(derived);
      setTiers(tiersFor(derived));
    }
  }, [variant, scSubTypes, changeType, reviseId, prefilled]);

  const scValidation = useMemo(() => variant === 'SC' ? validateScTypes(scSubTypes) : { ok: true } as const, [variant, scSubTypes]);

  const selectedVendor = useMemo(() => {
    if (!vendorInput) return undefined;
    const m = vendorInput.match(/#(\d+)/);
    if (m) return vendors.find(v => v.supplierNumber === m[1]);
    return vendors.find(v => v.name.toLowerCase() === vendorInput.trim().toLowerCase());
  }, [vendorInput, vendors]);

  const verdict = useMemo(() => {
    if (!hub) return null;
    const clauseForCheck = touchpointRate ? { touchpointRate: Number(touchpointRate) } : undefined;
    return evaluate(gv, hub, changeType, tiers, hub.segment, selectedHubType, clauseForCheck);
  }, [hub, changeType, tiers, gv, selectedHubType, touchpointRate]);
  const abnormal = useMemo(
    () => abnormalCheck(changeType, tiers, touchpointRate ? { touchpointRate: Number(touchpointRate) } : undefined),
    [changeType, tiers, touchpointRate],
  );

  // FR-24 — band-based abnormal flags. Uses executed corpus of same (hubType, changeType).
  const abnormalFlags = useMemo(
    () => computeAbnormal(selectedHubType, changeType, tiers, requests as unknown as Array<{ submittedHubType?: HubType; changeType: ChangeType; tiers: Tier[]; state: string }>),
    [selectedHubType, changeType, tiers, requests],
  );
  const abnormalUnresolved = abnormalFlags.filter(f => !(abnormalReasons[f.tierIndex]?.trim()));

  // CrossDock bag rate is captured whenever the picked sub-types include CD (KRD §2.0/§2.1.2).
  const showCrossDockBag = variant === 'SC' && scSubTypes.includes('CD');
  // Slab editor only shown when at least one slab sub-type (FMSC/LMSC/GW) is picked.
  const showSlabEditor = variant === 'SC' && scSubTypes.some(t => t === 'FMSC' || t === 'LMSC' || t === 'GW');
  const scUnit: 'shipment' | 'bag' = variant === 'SC' ? scUnitFor(scSubTypes) : 'shipment';

  // Currently-executed rate on this hub × change type, for diffing on the review card.
  const previousExecuted = useMemo(
    () => (hub ? requests.find(r => r.hubCode === hub.code && r.changeType === changeType && r.state === 'Executed') : undefined),
    [requests, hub, changeType]
  );

  const blocked = useMemo(() => {
    if (!hub) return null;
    // FM-07 case e — LM-as-FM: hub-type structure not yet defined.
    if (variant === 'FM' && selectedHubType === 'LM-as-FM') {
      return 'Structure not yet defined — cannot submit until Admin configures it.';
    }
    if (!hub.oracleId || !hub.owner)
      return 'No owner mapped for this hub — Admin must map an Oracle ID and cluster owner before a rate can be submitted.';
    // When revising, the original open request is expected — skip concurrent-open check for it.
    const openSame = requests.find(r => r.hubCode === hub.code && r.changeType === changeType && r.id !== reviseId && (r.state === 'Pending' || r.state === 'Approved'));
    if (openSame) return `Concurrent open request exists: ${openSame.id} (${openSame.state}). Only one open request per hub × change type.`;
    const live = requests.find(r => r.hubCode === hub.code && r.changeType === changeType && r.state === 'Executed');
    if (live && effectiveFrom < live.effectiveFrom)
      return `Effective date ${effectiveFrom} predates the current live rate (${live.effectiveFrom}). Backdating past that requires a Controllership exception.`;
    return null;
  }, [hub, changeType, requests, effectiveFrom, variant, selectedHubType, reviseId]);

  const isFmcp = changeType === 'FM-FMCP';
  const isScSlab = changeType === 'SC-SLAB';
  const isScCd = changeType === 'SC-CD';
  const missing: string[] = [];
  if (!hubCode) missing.push('hub');
  if (variant === 'FM' && !selectedHubType) missing.push('hub type');
  if (variant === 'SC' && scSubTypes.length === 0) missing.push('SC sub-type');
  if (isFmcp) {
    if (!fwdRate) missing.push('fwd rate');
    if (!revRate) missing.push('rev rate');
    if (!bagRate) missing.push('bag rate');
  } else if (variant === 'SC') {
    if (showSlabEditor && tiers.some(t => !t.rate || t.rate <= 0)) missing.push('all tier rates');
    if (showCrossDockBag && !crossDockBagRate) missing.push('CrossDock bag rate');
  } else if (tiers.some(t => !t.rate || t.rate <= 0)) {
    missing.push('all tier rates');
  }
  // KRD §2.1.1.c.i — SC slab upper limits must ascend.
  const scAscendingViolations = variant === 'SC' && showSlabEditor
    ? tierAscendingViolations(tiers).some(Boolean)
    : false;
  if (scAscendingViolations) missing.push('valid tier upper limits');
  if (!effectiveFrom) missing.push('effective date');
  if (!negotiatedOn) missing.push('negotiated date');
  if (incentiveOn) {
    if (!incIncremental) missing.push('incentive incremental');
    if (!incStart) missing.push('incentive start');
    if (!incEnd) missing.push('incentive end');
  }

  const canSubmit = missing.length === 0 && !blocked && !!verdict && (variant !== 'SC' || scValidation.ok) && abnormalUnresolved.length === 0;

  function onCtChange(ct: ChangeType) {
    setChangeType(ct);
    setTiers(tiersFor(ct));
  }

  function handleSubmit() {
    if (!hub || !canSubmit) return;
    const clause = variant === 'SC'
      ? (mg || mgTrigger || lockIn || noticePeriod || (showCrossDockBag && crossDockBagRate)
        ? {
            mg: mg ? Number(mg) : undefined,
            mgTrigger: mgTrigger || undefined,
            lockInMonths: lockIn ? Number(lockIn) : undefined,
            noticePeriodMonths: noticePeriod ? Number(noticePeriod) : undefined,
            crossDockBagRate: showCrossDockBag && crossDockBagRate ? Number(crossDockBagRate) : undefined,
          }
        : undefined)
      : isFmcp
        ? {
            fwdRate: Number(fwdRate),
            revRate: Number(revRate),
            bagRate: Number(bagRate),
          }
        : (touchpointRate
          ? {
              touchpointRate: Number(touchpointRate),
              touchpointBasis: 'Per unique supplier an FE visits per day',
            }
          : undefined);

    const incentive: Incentive | undefined = variant === 'SC' && incentiveOn
      ? {
          base: tiers[0]?.rate ?? 0,
          incremental: Number(incIncremental),
          period: incPeriod,
          start: incStart,
          end: incEnd,
        }
      : undefined;

    const draft = {
      hubCode: hub.code,
      submittedHubType: variant === 'FM' ? selectedHubType : undefined,
      changeType, tiers,
      effectiveFrom, negotiatedOn,
      vendorSupplierNumber: selectedVendor?.supplierNumber,
      clause,
      incentive,
      remarks,
      abnormalReasons: Object.keys(abnormalReasons).length ? abnormalReasons : undefined,
    };
    const req = reviseId
      ? revise(reviseId, draft, remarks)
      : submit(draft);
    router.push(`/requests?justSubmitted=${req.id}`);
  }

  return {
    variant,
    hubs, hub, hubCode, setHubCode,
    selectedHubType, setSelectedHubType,
    vendors, vendorInput, setVendorInput, selectedVendor,
    changeType, onCtChange,
    tiers, setTiers,
    effectiveFrom, setEffectiveFrom, negotiatedOn, setNegotiatedOn,
    remarks, setRemarks,
    // SC clauses
    mg, setMg, mgTrigger, setMgTrigger, lockIn, setLockIn,
    noticePeriod, setNoticePeriod,
    crossDockBagRate, setCrossDockBagRate, showCrossDockBag,
    showSlabEditor, scUnit,
    isScSlab, isScCd,
    // SC sub-types + validation
    scSubTypes, setScSubTypes, scValidation,
    // FM touchpoint (non-FMCP)
    touchpointRate, setTouchpointRate,
    // FMCP flat rates
    isFmcp, fwdRate, setFwdRate, revRate, setRevRate, bagRate, setBagRate,
    // SC incentive
    incentiveOn, setIncentiveOn,
    incIncremental, setIncIncremental,
    incPeriod, setIncPeriod,
    incStart, setIncStart, incEnd, setIncEnd,
    // computed
    verdict, abnormal, abnormalFlags, abnormalReasons, setAbnormalReasons, abnormalUnresolved,
    blocked, missing, canSubmit, handleSubmit,
    // revise mode
    reviseId, reviseOriginal,
    // review-only extras
    previousExecuted,
  };
}

type FormApi = ReturnType<typeof useSubmitForm>;

// ------------- Top-level dispatch -------------

export default function Submit() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-black/50">Loading…</div>}>
      <SubmitInner />
    </Suspense>
  );
}

function SubmitInner() {
  const persona = useApp(s => s.currentPersona);
  const search = useSearchParams();
  const reviseId = search?.get('revise') ?? undefined;
  if (persona === 'fm-cluster') return <VariantSubmit variant="FM" reviseId={reviseId} />;
  if (persona === 'sc-biz') return <VariantSubmit variant="SC" reviseId={reviseId} />;
  return <NoSubmitAccess persona={persona} />;
}

function VariantSubmit({ variant, reviseId }: { variant: Variant; reviseId?: string }) {
  const isMobile = useIsMobile();
  const form = useSubmitForm(variant, reviseId);
  return isMobile ? <SubmitMobile form={form} /> : <SubmitDesktop form={form} />;
}

// ------------- No-access card -------------

function NoSubmitAccess({ persona }: { persona: PersonaId }) {
  const target: { label: string; href: string } = (() => {
    switch (persona) {
      case 'ops-fm':
      case 'ops-sc':
      case 'bizfin':
        return { label: 'Go to approvals queue', href: '/approvals' };
      case 'legal':
        return { label: 'Go to legal inbox', href: '/legal' };
      case 'controllership':
        return { label: 'Go to controllership', href: '/controllership' };
      case 'admin':
        return { label: 'Go to admin', href: '/admin/hubs' };
      case 'zonal':
        return { label: 'Go to lineage (read-only)', href: '/lineage' };
      default:
        return { label: 'Go home', href: '/' };
    }
  })();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Submit rate</h1>
      <p className="text-sm text-black/60 mb-6">Structured capture at the point of commitment.</p>

      <div className="card p-6 banner-purple banner">
        <div>
          <div className="font-semibold text-[15px] mb-1">You don&apos;t submit rate cards in this role.</div>
          <p className="text-sm text-black/70">
            Approvers, Controllership and Legal act on requests submitted by FM Cluster Heads
            and SC Business Team. Switch persona from the top bar to try the submitter flow.
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href={target.href} className="btn btn-primary">{target.label}</Link>
            <Link href="/requests" className="btn btn-ghost">View all requests</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------- Desktop -------------

function SubmitDesktop({ form }: { form: FormApi }) {
  const { variant } = form;
  return (
    <div className="max-w-5xl">
      <SubmitHeader form={form} />
      <p className="text-sm text-black/60 mb-6">
        {variant === 'FM'
          ? 'FM Cluster Head flow — Old/New slab or Touchpoint. Guardrail evaluates as you type; route is decided before you submit.'
          : 'SC Business Team flow — vendor-defined slab structure per KRD §2.1. Routes to BizFin (no SC ceilings published).'}
      </p>
      {variant === 'FM' ? <SubmitDesktopFm form={form} /> : <SubmitDesktopSc form={form} />}
    </div>
  );
}

function SubmitHeader({ form }: { form: FormApi }) {
  const { variant } = form;
  return (
    <>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold">{form.reviseId ? 'Revise & resubmit' : 'Submit rate'}</h1>
        <span className="chip chip-outline-purple">{variant}</span>
      </div>
      {form.reviseId && form.reviseOriginal && (
        <div className="banner banner-purple mb-4" data-testid="revise-banner">
          <div>
            <div className="font-semibold">Revising {form.reviseOriginal.id} · r{form.reviseOriginal.revision} → r{form.reviseOriginal.revision + 1}</div>
            <div className="text-xs mt-1 opacity-80">
              Previous state: <strong>{form.reviseOriginal.state}</strong>
              {form.reviseOriginal.rejections[0] ? ` · Rejected: ${form.reviseOriginal.rejections[0].reason}` : ''}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SubmitDesktopFm({ form }: { form: FormApi }) {
  const {
    variant, hubs, hub, hubCode, setHubCode,
    vendors, vendorInput, setVendorInput, selectedVendor,
    changeType, onCtChange,
    tiers, setTiers,
    effectiveFrom, negotiatedOn,
    verdict, abnormal, blocked, missing, canSubmit, handleSubmit,
  } = form;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <SectionHeader n="1" title="Location" />
        <LocationFields
          hubs={hubs} hub={hub} hubCode={hubCode} setHubCode={setHubCode}
          vendors={vendors} vendorInput={vendorInput} setVendorInput={setVendorInput}
          selectedVendor={selectedVendor} variant={variant} selectedHubType={form.selectedHubType}
        />
        {hub && (
          <>
            <HubTypePicker value={form.selectedHubType} onChange={form.setSelectedHubType} mappingHubType={hub.hubType} />
            {form.selectedHubType && <HubTaxonomyPanel hubType={form.selectedHubType} />}
            {form.selectedHubType === 'LM-as-FM' && (
              <div className="banner banner-red mt-3" data-testid="lm-as-fm-blocked">
                <div>
                  <div className="font-semibold">LM-as-FM: structure not yet defined</div>
                  <div className="text-xs mt-1 opacity-80">Cannot submit until Admin configures it (FM-07 case e).</div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card p-6">
        <SectionHeader n="2" title="Slab structure" hint="Old vs New — decided by the hub type" />
        <SlabStructurePicker hub={hub} selectedHubType={form.selectedHubType} changeType={changeType} onCtChange={onCtChange} />
      </section>

      <section className="card p-6">
        <SectionHeader n="3" title={form.isFmcp ? 'FMCP flat rates' : 'Tier values'} hint={form.isFmcp ? 'FMCP has no tiers — flat rates per KRD §1.1.2' : 'Guardrail evaluates on every keystroke'} />
        {form.isFmcp ? <FmcpEditor form={form} /> : <TierEditor tiers={tiers} setTiers={setTiers} verdict={verdict} abnormal={abnormal} />}
        {!form.isFmcp && (
          <AbnormalBanner flags={form.abnormalFlags} reasons={form.abnormalReasons} setReasons={form.setAbnormalReasons} />
        )}
      </section>

      <section className="card p-6">
        <SectionHeader n="4" title="Dates & remarks" />
        <DatesFields form={form} />
        {hub && isTouchpointApplicable(form.selectedHubType) && <FmTouchpointField form={form} />}
      </section>

      <section className="card p-6">
        <SectionHeader n="5" title="Review & submit" />
        <ReviewBlock hub={hub} selectedHubType={form.selectedHubType} verdict={verdict} changeType={changeType} effectiveFrom={effectiveFrom} negotiatedOn={negotiatedOn} vendor={selectedVendor} variant={variant} touchpointRate={form.touchpointRate} tierCount={tiers.length} tiers={tiers} previousExecuted={form.previousExecuted} scSubTypes={form.scSubTypes} scUnit={form.scUnit} mg={form.mg} lockIn={form.lockIn} noticePeriod={form.noticePeriod} showCrossDockBag={form.showCrossDockBag} crossDockBagRate={form.crossDockBagRate} incentiveOn={form.incentiveOn} incIncremental={form.incIncremental} incPeriod={form.incPeriod} incStart={form.incStart} incEnd={form.incEnd} />
        {blocked && <div className="banner banner-red mb-4">{blocked}</div>}
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
            Submit request
          </button>
          {!canSubmit && !blocked && (
            <span className="text-xs text-black/50">Fill in {missing.join(', ')} to submit.</span>
          )}
        </div>
      </section>
    </div>
  );
}

function SubmitDesktopSc({ form }: { form: FormApi }) {
  const {
    variant, hubs, hub, hubCode, setHubCode,
    vendors, vendorInput, setVendorInput, selectedVendor,
    changeType, tiers, setTiers,
    effectiveFrom, negotiatedOn,
    verdict, abnormal, blocked, missing, canSubmit, handleSubmit,
    showSlabEditor, showCrossDockBag, scUnit,
  } = form;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <SectionHeader n="1" title="Location" />
        <LocationFields
          hubs={hubs} hub={hub} hubCode={hubCode} setHubCode={setHubCode}
          vendors={vendors} vendorInput={vendorInput} setVendorInput={setVendorInput}
          selectedVendor={selectedVendor} variant={variant} selectedHubType={form.selectedHubType}
        />
      </section>

      <section className="card p-6">
        <SectionHeader n="2" title="Sub-types & derived structure" hint="KRD §2.0 — pick the SC sub-types; the rate structure follows" />
        {hub ? (
          <>
            <ScSubTypePicker value={form.scSubTypes} onChange={form.setScSubTypes} validation={form.scValidation} />
            {form.scSubTypes.length > 0 && form.scValidation.ok && (
              <ScDerivedPanel subTypes={form.scSubTypes} unit={scUnit} showCd={showCrossDockBag} showSlab={showSlabEditor} />
            )}
          </>
        ) : (
          <p className="text-sm text-black/50">Pick a hub above — the sub-types depend on the hub.</p>
        )}
      </section>

      {showSlabEditor && (
        <section className="card p-6">
          <SectionHeader n="3" title="Slab structure" hint="Vendor-defined · up to 10 slabs (KRD §2.1.1)" />
          <ScSlabEditor tiers={tiers} onChange={setTiers} unit={scUnit} />
        </section>
      )}

      {showCrossDockBag && (
        <section className="card p-6">
          <SectionHeader n={showSlabEditor ? '4' : '3'} title="CrossDock bag rate" hint="KRD §2.1.2 — flat ₹/bag captured separately" />
          <ScCrossDockRateField form={form} />
          {abnormal && changeType === 'SC-CD' && (
            <div className="banner banner-purple mt-3 text-[12.5px]">
              <div>{abnormal}</div>
            </div>
          )}
        </section>
      )}

      <section className="card p-6">
        <SectionHeader n={String(3 + (showSlabEditor ? 1 : 0) + (showCrossDockBag ? 1 : 0))} title="Commercial clauses" hint="MG, lock-in, notice period — all optional (KRD §2.1.3)" />
        <ClausesCardSC form={form} />
        <IncentiveBlock form={form} />
      </section>

      <section className="card p-6">
        <SectionHeader n={String(4 + (showSlabEditor ? 1 : 0) + (showCrossDockBag ? 1 : 0))} title="Dates & remarks" />
        <DatesFields form={form} />
      </section>

      <section className="card p-6">
        <SectionHeader n={String(5 + (showSlabEditor ? 1 : 0) + (showCrossDockBag ? 1 : 0))} title="Review & submit" />
        <ReviewBlock hub={hub} selectedHubType={form.selectedHubType} verdict={verdict} changeType={changeType} effectiveFrom={effectiveFrom} negotiatedOn={negotiatedOn} vendor={selectedVendor} variant={variant} touchpointRate={form.touchpointRate} tierCount={tiers.length} tiers={tiers} previousExecuted={form.previousExecuted} scSubTypes={form.scSubTypes} scUnit={form.scUnit} mg={form.mg} lockIn={form.lockIn} noticePeriod={form.noticePeriod} showCrossDockBag={form.showCrossDockBag} crossDockBagRate={form.crossDockBagRate} incentiveOn={form.incentiveOn} incIncremental={form.incIncremental} incPeriod={form.incPeriod} incStart={form.incStart} incEnd={form.incEnd} />
        <ScRouteCard />
        {blocked && <div className="banner banner-red mb-4">{blocked}</div>}
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit} data-testid="sc-submit-btn">
            Submit request
          </button>
          {!canSubmit && !blocked && (
            <span className="text-xs text-black/50">Fill in {missing.join(', ')} to submit.</span>
          )}
        </div>
      </section>
    </div>
  );
}

// ------------- Mobile -------------

function SubmitMobile({ form }: { form: FormApi }) {
  return form.variant === 'FM' ? <SubmitMobileFm form={form} /> : <SubmitMobileSc form={form} />;
}

function SubmitMobileFm({ form }: { form: FormApi }) {
  const {
    variant, hubs, hub, hubCode, setHubCode,
    vendors, vendorInput, setVendorInput, selectedVendor,
    changeType, onCtChange,
    tiers, setTiers,
    effectiveFrom, negotiatedOn,
    verdict, abnormal, blocked, canSubmit, handleSubmit,
  } = form;
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const stepValid =
    step === 1 ? !!hubCode :
    step === 2 ? !!changeType && !!hub :
    step === 3 ? (form.isFmcp ? !!form.fwdRate && !!form.revRate && !!form.bagRate : tiers.every(t => t.rate > 0)) :
    step === 4 ? !!effectiveFrom && !!negotiatedOn :
    canSubmit;

  return (
    <div className="-m-3 min-h-screen bg-white flex flex-col">
      <div className="bg-[#580A46] text-white">
        <div className="h-[26px]" />
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            className="text-white/90 text-lg -ml-1 min-w-[44px] min-h-[44px] flex items-center"
            onClick={() => (step > 1 ? setStep(step - 1) : window.history.back())}
            aria-label="Back"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Submit rate · {variant}</div>
            <div className="text-sm font-semibold truncate">{hub ? `${hub.code} · ${hub.name}` : 'New request'}</div>
          </div>
          <div className="text-[11px] mono opacity-80">Step {step} of {totalSteps}</div>
        </div>
        <div className="h-1 flex gap-1 px-2 pb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i < step ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 pb-32 space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">Where is this rate for?</h2>
            <LocationFields
              hubs={hubs} hub={hub} hubCode={hubCode} setHubCode={setHubCode}
              vendors={vendors} vendorInput={vendorInput} setVendorInput={setVendorInput}
              selectedVendor={selectedVendor} variant={variant} selectedHubType={form.selectedHubType}
            />
            {hub && (
              <>
                <HubTypePicker value={form.selectedHubType} onChange={form.setSelectedHubType} mappingHubType={hub.hubType} />
                {form.selectedHubType && <HubTaxonomyPanel hubType={form.selectedHubType} />}
                {form.selectedHubType === 'LM-as-FM' && (
                  <div className="banner banner-red mt-3" data-testid="lm-as-fm-blocked">
                    <div>
                      <div className="font-semibold">LM-as-FM: structure not yet defined</div>
                      <div className="text-xs mt-1 opacity-80">Cannot submit until Admin configures it.</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">Slab structure</h2>
            <SlabStructurePicker hub={hub} selectedHubType={form.selectedHubType} changeType={changeType} onCtChange={onCtChange} mobile />
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold">{form.isFmcp ? 'FMCP flat rates' : 'Tier values'}</h2>
            {form.isFmcp ? <FmcpEditor form={form} mobile /> : <TierEditor tiers={tiers} setTiers={setTiers} verdict={verdict} abnormal={abnormal} mobile />}
            {!form.isFmcp && (
              <AbnormalBanner flags={form.abnormalFlags} reasons={form.abnormalReasons} setReasons={form.setAbnormalReasons} />
            )}
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold">Dates & remarks</h2>
            <DatesFields form={form} mobile />
            {hub && isTouchpointApplicable(hub.hubType) && <FmTouchpointField form={form} mobile />}
          </>
        )}
        {step === 5 && (
          <>
            <h2 className="text-lg font-bold">Review & submit</h2>
            <ReviewBlock hub={hub} selectedHubType={form.selectedHubType} verdict={verdict} changeType={changeType} effectiveFrom={effectiveFrom} negotiatedOn={negotiatedOn} vendor={selectedVendor} variant={variant} mobile touchpointRate={form.touchpointRate} tierCount={tiers.length} />
            {blocked && (
              <div className="banner banner-red text-[13px]">
                <div>
                  <div className="font-semibold mb-1">Cannot submit</div>
                  <div>{blocked}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/8 p-4 z-40">
        <button
          type="button"
          className="btn btn-primary w-full justify-center py-3 text-[15px]"
          disabled={!stepValid || (step === 5 && !canSubmit)}
          onClick={() => {
            if (step < totalSteps) setStep(step + 1);
            else handleSubmit();
          }}
        >
          {step < totalSteps ? 'Continue' : 'Submit request'}
        </button>
      </div>
    </div>
  );
}

function SubmitMobileSc({ form }: { form: FormApi }) {
  const {
    variant, hubs, hub, hubCode, setHubCode,
    vendors, vendorInput, setVendorInput, selectedVendor,
    changeType, tiers, setTiers,
    effectiveFrom, negotiatedOn,
    verdict, blocked, canSubmit, handleSubmit,
    showSlabEditor, showCrossDockBag, scUnit,
  } = form;
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const step2Valid = form.scSubTypes.length > 0 && form.scValidation.ok;
  const step3Valid =
    (!showSlabEditor || tiers.every(t => t.rate > 0) && !tierAscendingViolations(tiers).some(Boolean)) &&
    (!showCrossDockBag || !!form.crossDockBagRate);
  const stepValid =
    step === 1 ? !!hubCode :
    step === 2 ? step2Valid :
    step === 3 ? step3Valid :
    step === 4 ? !!effectiveFrom && !!negotiatedOn :
    canSubmit;

  return (
    <div className="-m-3 min-h-screen bg-white flex flex-col">
      <div className="bg-[#580A46] text-white">
        <div className="h-[26px]" />
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            className="text-white/90 text-lg -ml-1 min-w-[44px] min-h-[44px] flex items-center"
            onClick={() => (step > 1 ? setStep(step - 1) : window.history.back())}
            aria-label="Back"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Submit rate · {variant}</div>
            <div className="text-sm font-semibold truncate">{hub ? `${hub.code} · ${hub.name}` : 'New request'}</div>
          </div>
          <div className="text-[11px] mono opacity-80">Step {step} of {totalSteps}</div>
        </div>
        <div className="h-1 flex gap-1 px-2 pb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i < step ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 pb-32 space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">Where is this rate for?</h2>
            <LocationFields
              hubs={hubs} hub={hub} hubCode={hubCode} setHubCode={setHubCode}
              vendors={vendors} vendorInput={vendorInput} setVendorInput={setVendorInput}
              selectedVendor={selectedVendor} variant={variant} selectedHubType={form.selectedHubType}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">Sub-types & structure</h2>
            {hub ? (
              <>
                <ScSubTypePicker value={form.scSubTypes} onChange={form.setScSubTypes} validation={form.scValidation} />
                {form.scSubTypes.length > 0 && form.scValidation.ok && (
                  <ScDerivedPanel subTypes={form.scSubTypes} unit={scUnit} showCd={showCrossDockBag} showSlab={showSlabEditor} />
                )}
              </>
            ) : (
              <p className="text-sm text-black/50">Pick a hub in step 1.</p>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold">Rate values</h2>
            {showSlabEditor && (
              <div>
                <div className="mono text-[11px] uppercase tracking-wider text-black/55 mb-2">Slab structure · vendor-defined (KRD §2.1.1)</div>
                <ScSlabEditor tiers={tiers} onChange={setTiers} unit={scUnit} mobile />
              </div>
            )}
            {showCrossDockBag && (
              <div className={showSlabEditor ? 'mt-4' : ''}>
                <div className="mono text-[11px] uppercase tracking-wider text-black/55 mb-2">CrossDock bag rate (KRD §2.1.2)</div>
                <ScCrossDockRateField form={form} mobile />
              </div>
            )}
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold">Clauses & dates</h2>
            <ClausesCardSC form={form} mobile />
            <IncentiveBlock form={form} mobile />
            <DatesFields form={form} mobile />
          </>
        )}
        {step === 5 && (
          <>
            <h2 className="text-lg font-bold">Review & submit</h2>
            <ReviewBlock hub={hub} selectedHubType={form.selectedHubType} verdict={verdict} changeType={changeType} effectiveFrom={effectiveFrom} negotiatedOn={negotiatedOn} vendor={selectedVendor} variant={variant} mobile touchpointRate={form.touchpointRate} tierCount={tiers.length} />
            <ScRouteCard />
            {blocked && (
              <div className="banner banner-red text-[13px]">
                <div>
                  <div className="font-semibold mb-1">Cannot submit</div>
                  <div>{blocked}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/8 p-4 z-40">
        <button
          type="button"
          className="btn btn-primary w-full justify-center py-3 text-[15px]"
          disabled={!stepValid || (step === 5 && !canSubmit)}
          onClick={() => {
            if (step < totalSteps) setStep(step + 1);
            else handleSubmit();
          }}
          data-testid="sc-mobile-submit-btn"
        >
          {step < totalSteps ? 'Continue' : 'Submit request'}
        </button>
      </div>
    </div>
  );
}

// ------------- Shared sub-components -------------

function LocationFields({ hubs, hub, hubCode, setHubCode, vendors, vendorInput, setVendorInput, selectedVendor, variant, selectedHubType }: {
  hubs: Hub[]; hub: Hub | undefined; hubCode: string; setHubCode: (v: string) => void;
  vendors: Vendor[]; vendorInput: string; setVendorInput: (v: string) => void; selectedVendor: Vendor | undefined;
  variant: Variant; selectedHubType?: HubType;
}) {
  const showVendorPicker = getConfig().showVendorPicker;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="field-label">Hub <span className="text-black/40 font-normal">({variant} only)</span></label>
          <select value={hubCode} onChange={e => setHubCode(e.target.value)} className="field-input">
            <option value="">Select a hub…</option>
            {hubs.map(h => <option key={h.code} value={h.code}>{h.code} · {h.name} · {h.city} · {h.hubType ?? h.scSubTypes?.join('+') ?? '—'}</option>)}
          </select>
          {hubs.length === 0 && (
            <div className="text-xs text-[#B76900] mt-1">No active {variant} hubs. Ask Admin to activate one.</div>
          )}
        </div>
        {hub && (
          <div className="text-xs text-black/60 flex items-center gap-2 flex-wrap">
            <span className="chip chip-outline-purple">{hub.segment}</span>
            {hub.status && <span className="chip chip-outline-purple" title="Hub lifecycle status (KRD §1.2.13 / §2.2.14)">{hubStatusLabel(hub.status)}</span>}
          </div>
        )}
      </div>
      {hub && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm bg-black/[.03] p-3 rounded-md">
            <Field label="Oracle ID" value={hub.oracleId ?? '—'} mono />
            <Field label="Owner" value={hub.owner ?? '—'} />
            <Field label="Hub type" value={variant === 'FM' ? (selectedHubType ?? hub.hubType ?? '— pick below') : (hub.scSubTypes?.length ? `SC · ${hub.scSubTypes.join(' + ')}` : '—')} />
            <Field label="Zone" value={hub.zone} />
          </div>
          {variant === 'FM' && selectedHubType && (
            <div className="text-[11px] text-black/55 mt-2 mono">
              {selectedHubType === 'FMCP'
                ? 'Unit: ₹/shipment (Fwd + Rev) + ₹/bag · flat rates · Guardrail: not applicable · Approval: BizFin'
                : `Unit: ₹/shipment · slabbed · Guardrail dimension: ${selectedHubType === 'Standalone' || selectedHubType === 'Mall Hub' ? `Hub type × city (${hub.city})` : 'Hub type'} · Touchpoint: applicable`}
            </div>
          )}
        </>
      )}
      {showVendorPicker && (
        <div className="mt-4">
          <label className="field-label">Transport partner (vendor)</label>
          <input
            className="field-input"
            list="vendor-list"
            value={vendorInput}
            onChange={e => setVendorInput(e.target.value)}
            placeholder="Search partner by name or #supplierNumber…"
          />
          <datalist id="vendor-list">
            {vendors.slice(0, 200).map(v => (
              <option key={v.supplierNumber} value={`${v.name} #${v.supplierNumber}`}>{v.state}</option>
            ))}
          </datalist>
          {selectedVendor ? (
            <div className="mt-2 text-xs text-black/70">
              Selected: <span className="font-semibold">{selectedVendor.name}</span>{' '}
              <span className="mono text-black/50">#{selectedVendor.supplierNumber}</span>{' '}
              <span className="text-black/50">· {selectedVendor.state}</span>
            </div>
          ) : vendorInput ? (
            <div className="mt-2 text-xs text-[#B76900]">No matching partner. Pick one from the list.</div>
          ) : null}
        </div>
      )}
    </>
  );
}

function SlabStructurePicker({ hub, selectedHubType, changeType, onCtChange, mobile }: {
  hub: Hub | undefined; selectedHubType?: HubType; changeType: ChangeType; onCtChange: (ct: ChangeType) => void; mobile?: boolean;
}) {
  if (!hub) {
    return <p className="text-sm text-black/50">Pick a hub above — the slab structure depends on the hub type.</p>;
  }
  if (!selectedHubType) {
    return <p className="text-sm text-black/50">Confirm the hub type in Section 1 — the slab structure follows.</p>;
  }
  if (selectedHubType === 'FMCP') {
    return (
      <div className="banner banner-purple">
        <div>
          <div className="font-semibold">FMCP uses flat rates — no slab structure</div>
          <div className="text-xs mt-1 opacity-80">
            KRD §1.1.2: Fwd + Rev + Bag rates are captured in step 3. Every FMCP submission routes to BizFin.
          </div>
        </div>
      </div>
    );
  }
  // KRD §1.1.1 — the four slab hub types choose Old vs New.
  const options: Array<{
    ct: ChangeType;
    title: string;
    subtitle: string;
    ranges: string[];
  }> = [
    { ct: 'FM-OLD', title: 'Old rate card', subtitle: '5 tiers · 5,000-shipment width · ₹/shipment', ranges: FM_OLD_RANGES },
    { ct: 'FM-NEW', title: 'New rate card', subtitle: '6 tiers · 2,500-shipment width · ₹/shipment', ranges: FM_NEW_RANGES },
  ];
  return (
    <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
      {options.map(opt => {
        const on = changeType === opt.ct;
        return (
          <button
            key={opt.ct}
            type="button"
            onClick={() => onCtChange(opt.ct)}
            className={`p-4 rounded-lg border text-left transition ${on ? 'border-[#580A46] bg-[#F5E8F0]' : 'border-black/10 bg-white hover:border-black/25'}`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="font-semibold text-sm">{opt.title}</div>
              <div className="mono text-[10px] text-black/50">{opt.ct}</div>
            </div>
            <div className="text-[11px] text-black/55 mb-3">{opt.subtitle}</div>
            <div className="mono text-[11px] text-black/70 space-y-0.5">
              {opt.ranges.map((r, i) => (
                <div key={i}>T{i + 1}. {r}</div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * KRD §2.0/§2.1 — read-only panel showing the structure derived from the picked SC sub-types.
 * Replaces the old fixed SC change-type grid (which was never in the KRD).
 */
function ScDerivedPanel({ subTypes, unit, showSlab, showCd }: {
  subTypes: ScSubType[]; unit: 'shipment' | 'bag'; showSlab: boolean; showCd: boolean;
}) {
  return (
    <div className="mt-4 p-3 border border-black/10 rounded-md bg-black/[.02]" data-testid="sc-derived-panel">
      <div className="mono text-[10px] uppercase tracking-wider text-black/55 mb-2">Derived from sub-types · read-only</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
        <Field label="Sub-types" value={subTypes.join(' + ')} />
        <Field label="Unit" value={`₹/${unit}`} />
        <Field label="Structure" value={showSlab ? 'Vendor-defined · up to 10 slabs' : (showCd ? 'Flat ₹/bag (CrossDock)' : '—')} />
      </div>
      {showCd && showSlab && (
        <div className="mt-2 text-[11px] text-black/60">
          Flat CrossDock ₹/bag captured separately below (KRD §2.1.2).
        </div>
      )}
    </div>
  );
}

/** KRD §2.1.2 — flat ₹/bag input for CrossDock. */
function ScCrossDockRateField({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const inputCls = mobile ? 'field-input !text-[16px] !py-3' : 'field-input';
  return (
    <div className={mobile ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
      <div>
        <label className="field-label">CrossDock bag rate (₹/bag)</label>
        <input
          type="number" inputMode="decimal" step="0.01"
          className={`${inputCls} num text-right`}
          value={form.crossDockBagRate}
          onChange={e => form.setCrossDockBagRate(e.target.value)}
          placeholder="e.g. 14.00"
          data-testid="sc-cd-rate"
        />
        <div className="text-[11px] text-black/50 mt-1">Flat rate per bag · KRD §2.1.2</div>
      </div>
    </div>
  );
}

/** Simple SC routing summary — replaces the FM-style guardrail card on the SC review step. */
function ScRouteCard() {
  return (
    <div className="banner banner-purple mb-4" data-testid="sc-route-card">
      <div>
        <div className="font-semibold">Route: BizFin</div>
        <div className="text-xs mt-1 opacity-80">
          SC ratecards route here by default — no city guardrails are published (KRD OQ-06). Approvers see the deal and clauses in full.
        </div>
      </div>
    </div>
  );
}

function TierEditor({ tiers, setTiers, verdict, abnormal, mobile }: {
  tiers: Tier[]; setTiers: React.Dispatch<React.SetStateAction<Tier[]>>;
  verdict: FormApi['verdict']; abnormal: FormApi['abnormal']; mobile?: boolean;
}) {
  const noCeiling = verdict?.status === 'no-ceiling' || verdict?.status === 'not-applicable';
  return (
    <>
      {!mobile && (
        <div className="grid grid-cols-[1fr_140px_180px] gap-3 items-center text-[10px] uppercase tracking-wider text-black/50 pb-2 border-b border-black/8">
          <div>Slab</div>
          <div className="text-right">Rate ₹</div>
          <div>Ceiling {verdict?.version ? `(${verdict.version})` : ''}</div>
        </div>
      )}
      <div className={mobile ? 'space-y-3' : 'divide-y divide-black/5'}>
        {tiers.map((t, i) => {
          const ceil = verdict?.ceiling?.[i];
          const over = ceil !== undefined && t.rate > ceil;
          const slab = t.upTo === null ? `> ${tiers[i - 1]?.upTo ?? 0}` : `≤ ${t.upTo}`;
          return mobile ? (
            <div key={i} className="border border-black/8 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm mono text-black/70">Tier {i + 1} · {slab}</div>
                <div className="text-[11px] mono text-black/50">
                  {ceil !== undefined ? `ceil ₹${ceil.toFixed(2)}` : noCeiling ? 'no ceiling' : ''}
                </div>
              </div>
              <input
                type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={t.rate || ''}
                onChange={e => {
                  const v = Number(e.target.value);
                  setTiers(prev => prev.map((tt, ii) => ii === i ? { ...tt, rate: v } : tt));
                }}
                className={`field-input num text-right !text-[16px] !py-3 ${over ? 'border-[#B87500] bg-[#FFF7E8]' : ''}`}
              />
            </div>
          ) : (
            <div key={i} className="grid grid-cols-[1fr_140px_180px] items-center gap-3 py-2">
              <div className="text-sm mono text-black/70">Tier {i + 1} · {slab} shipments</div>
              <input
                type="number" step="0.01" placeholder="0.00" value={t.rate || ''}
                onChange={e => {
                  const v = Number(e.target.value);
                  setTiers(prev => prev.map((tt, ii) => ii === i ? { ...tt, rate: v } : tt));
                }}
                className={`field-input num text-right ${over ? 'border-[#B87500] bg-[#FFF7E8]' : ''}`}
              />
              <div className="text-xs mono text-black/60">
                {ceil !== undefined ? (
                  <span className={over ? 'text-[#8A5800] font-semibold' : ''}>
                    ₹{ceil.toFixed(2)}{over ? ` · +${((t.rate - ceil) / ceil * 100).toFixed(1)}%` : ''}
                  </span>
                ) : noCeiling ? <span className="text-black/40">no ceiling</span> : ''}
              </div>
            </div>
          );
        })}
      </div>
      {verdict && (
        <div className={`banner mt-4 ${verdict.status === 'within' ? 'banner-green' : verdict.status === 'breach' ? 'banner-amber' : 'banner-purple'}`}>
          <div>
            <div className="font-semibold">
              {noCeiling ? 'No ceiling set — routes to BizFin' : verdict.reason}
            </div>
            <div className="text-xs mt-1 opacity-80">Guardrail {verdict.version} · Route on submit: <strong>{verdict.route}</strong></div>
          </div>
        </div>
      )}
      {abnormal && <div className="banner banner-amber mt-3">Sanity check: {abnormal}. This does not change your approver — add context in remarks.</div>}
    </>
  );
}

function DatesFields({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const { effectiveFrom, setEffectiveFrom, negotiatedOn, setNegotiatedOn, remarks, setRemarks } = form;
  const inputCls = mobile ? 'field-input !text-[16px] !py-3' : 'field-input';
  return (
    <>
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
        <div>
          <label className="field-label">Effective from</label>
          <input type="date" className={inputCls} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Negotiated on</label>
          <input type="date" className={inputCls} value={negotiatedOn} onChange={e => setNegotiatedOn(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <label className="field-label">Remarks <span className="text-black/40 font-normal">approver reads this first</span></label>
        <textarea rows={mobile ? 4 : 3} className={inputCls} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Context, negotiation notes, why this rate…" />
      </div>
    </>
  );
}

function ClausesCardSC({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const {
    mg, setMg, mgTrigger, setMgTrigger, lockIn, setLockIn,
    noticePeriod, setNoticePeriod, hub,
  } = form;
  const inputCls = mobile ? 'field-input !text-[16px] !py-3' : 'field-input';
  const cols = mobile ? 'grid-cols-1' : 'grid-cols-4';

  return (
    <div className="mt-4 p-4 border border-black/8 rounded-md bg-black/[.02]">
      <div className="mono text-[10px] uppercase tracking-wider text-black/55 mb-3">
        Clauses for SC
        {hub && <span className="text-black/40 normal-case tracking-normal font-normal"> · {hub.scSubTypes?.join(' + ') ?? '—'}</span>}
      </div>
      <div className={`grid ${cols} gap-3`}>
        <div>
          <label className="field-label">Minimum Guarantee (₹) <span className="text-black/40 font-normal">optional</span></label>
          <input type="number" inputMode="numeric" className={inputCls} value={mg} onChange={e => setMg(e.target.value)} placeholder="Monthly amount" />
          <div className="text-[11px] text-black/50 mt-1">Monthly amount</div>
        </div>
        <div>
          <label className="field-label">MG trigger</label>
          <input type="text" className={inputCls} value={mgTrigger} onChange={e => setMgTrigger(e.target.value)} placeholder="e.g. Below 1,20,000 shipments" />
          <div className="text-[11px] text-black/50 mt-1">When MG becomes payable</div>
        </div>
        <div>
          <label className="field-label">Lock-in (months)</label>
          <input type="number" inputMode="numeric" className={inputCls} value={lockIn} onChange={e => setLockIn(e.target.value)} placeholder="e.g. 12" />
          <div className="text-[11px] text-black/50 mt-1">MG stays payable through</div>
        </div>
        <div>
          <label className="field-label">Notice period (months)</label>
          <input type="number" inputMode="numeric" className={inputCls} value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} placeholder="e.g. 3" />
          <div className="text-[11px] text-black/50 mt-1">MG payable through notice on offboarding</div>
        </div>
      </div>
    </div>
  );
}

function IncentiveBlock({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const {
    incentiveOn, setIncentiveOn,
    incIncremental, setIncIncremental,
    incPeriod, setIncPeriod,
    incStart, setIncStart, incEnd, setIncEnd,
    tiers,
  } = form;
  const inputCls = mobile ? 'field-input !text-[16px] !py-3' : 'field-input';
  const baseRate = tiers[0]?.rate ?? 0;

  return (
    <div className="mt-4 p-4 border border-black/8 rounded-md">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={incentiveOn} onChange={e => setIncentiveOn(e.target.checked)} className="h-4 w-4 accent-[#580A46]" />
        <span className="text-sm font-medium">Add an incentive to this rate card</span>
        <span className="text-[11px] text-black/50">— or raise it later as its own submission</span>
      </label>
      {incentiveOn && (
        <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-5'} gap-3 mt-4`}>
          <div>
            <label className="field-label">Base rate</label>
            <input type="text" readOnly className={`${inputCls} bg-black/[.05] text-black/60 num`} value={baseRate ? baseRate.toFixed(2) : '—'} />
            <div className="text-[11px] text-black/50 mt-1">Read-only from tier 1</div>
          </div>
          <div>
            <label className="field-label">Incremental</label>
            <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={incIncremental} onChange={e => setIncIncremental(e.target.value)} placeholder="0.20" />
            <div className="text-[11px] text-black/50 mt-1">Per shipment</div>
          </div>
          <div>
            <label className="field-label">Period</label>
            <select className={inputCls} value={incPeriod} onChange={e => setIncPeriod(e.target.value as Incentive['period'])}>
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="field-label">Start</label>
            <input type="date" className={inputCls} value={incStart} onChange={e => setIncStart(e.target.value)} />
          </div>
          <div>
            <label className="field-label">End</label>
            <input type="date" className={inputCls} value={incEnd} onChange={e => setIncEnd(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewBlock({
  hub, selectedHubType, verdict, changeType, effectiveFrom, negotiatedOn, vendor, variant, mobile, touchpointRate, tierCount,
  tiers, previousExecuted, scSubTypes, scUnit,
  mg, lockIn, noticePeriod, showCrossDockBag, crossDockBagRate,
  incentiveOn, incIncremental, incPeriod, incStart, incEnd,
}: {
  hub: Hub | undefined; selectedHubType?: HubType; verdict: FormApi['verdict']; changeType: ChangeType;
  effectiveFrom: string; negotiatedOn: string;
  vendor: Vendor | undefined; variant: Variant; mobile?: boolean;
  touchpointRate?: string;
  tierCount?: number;
  tiers?: Tier[];
  previousExecuted?: RateRequest;
  scSubTypes?: ScSubType[];
  scUnit?: 'shipment' | 'bag';
  mg?: string; lockIn?: string; noticePeriod?: string;
  showCrossDockBag?: boolean; crossDockBagRate?: string;
  incentiveOn?: boolean; incIncremental?: string; incPeriod?: Incentive['period']; incStart?: string; incEnd?: string;
}) {
  if (!hub || !verdict) return <p className="text-sm text-black/50">Complete the previous steps to see the review.</p>;
  const effectiveType = selectedHubType ?? hub.hubType;
  const unit = effectiveType === 'FMCP' ? '₹/shipment + ₹/bag (flat)' : '₹/shipment (slabbed)';
  const slabDesc = changeType === 'FM-FMCP'
    ? 'Flat (FMCP)'
    : changeType === 'FM-OLD' ? 'Old · 5 tiers'
    : changeType === 'FM-NEW' ? 'New · 6 tiers'
    : changeType === 'SC-CD' ? 'Flat ₹/bag (CrossDock)'
    : changeType === 'SC-SLAB' ? `Vendor-defined · ${tierCount ?? 0} slab${(tierCount ?? 0) === 1 ? '' : 's'}`
    : `${tierCount ?? 0} tiers`;

  if (variant === 'SC') {
    const hubTypeLabel = scSubTypes && scSubTypes.length ? scSubTypes.join(' + ') : '—';
    const unitLabel = scUnit === 'bag' ? '₹/bag' : '₹/shipment';
    return (
      <>
        <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-4`}>
          <ReviewRow label="Hub" value={`${hub.code} · ${hub.name}`} />
          <ReviewRow label="Oracle ID" value={hub.oracleId ?? '—'} />
          <ReviewRow label="Hub type" value={hubTypeLabel} />
          <ReviewRow label="Structure" value={slabDesc} />
          <ReviewRow label="Unit" value={unitLabel} />
          <ReviewRow label="Effective from" value={effectiveFrom} />
          <ReviewRow label="Negotiated" value={negotiatedOn} />
          {vendor && <ReviewRow label="Partner" value={`${vendor.name} #${vendor.supplierNumber}`} />}
        </div>

        {tiers && tiers.length > 0 && (
          <div className="mb-4 border border-black/8 rounded-md overflow-hidden">
            <div className="px-3 py-2 border-b border-black/8 text-[11px] uppercase tracking-wider text-black/55 flex items-center justify-between">
              <span>Slab rate change</span>
              <span className="mono text-[10.5px] text-black/45">
                {previousExecuted ? `vs ${previousExecuted.id}` : 'no prior executed rate'}
              </span>
            </div>
            <table className="data w-full text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left">Slab</th>
                  <th className="num">Previous</th>
                  <th className="num">Proposed</th>
                  <th className="num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const prev = previousExecuted?.tiers?.[i]?.rate;
                  const delta = prev !== undefined ? t.rate - prev : undefined;
                  const upToLabel = t.upTo === null ? 'No upper limit' : `≤ ${t.upTo.toLocaleString()}`;
                  return (
                    <tr key={i}>
                      <td>{`Slab ${i + 1} · ${upToLabel}`}</td>
                      <td className="num">{prev !== undefined ? `₹${prev.toFixed(2)}` : '—'}</td>
                      <td className="num"><strong>₹{t.rate.toFixed(2)}</strong></td>
                      <td className={`num ${delta === undefined ? 'text-black/40' : delta > 0 ? 'text-[#B00020]' : delta < 0 ? 'text-[#0F7B3F]' : 'text-black/50'}`}>
                        {delta === undefined ? '—' : delta === 0 ? '—' : `${delta > 0 ? '+' : ''}₹${delta.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(mg || lockIn || noticePeriod || (showCrossDockBag && crossDockBagRate)) && (
          <div className="mb-4 border border-black/8 rounded-md p-3">
            <div className="text-[10px] uppercase text-black/50 tracking-wider mb-2">Commercial clauses</div>
            <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>
              {mg && <ReviewRow label="Minimum guarantee" value={`₹${Number(mg).toLocaleString()}`} />}
              {lockIn && <ReviewRow label="Lock-in" value={`${lockIn} month${lockIn === '1' ? '' : 's'}`} />}
              {noticePeriod && <ReviewRow label="Notice period" value={`${noticePeriod} month${noticePeriod === '1' ? '' : 's'}`} />}
              {showCrossDockBag && crossDockBagRate && <ReviewRow label="CrossDock ₹/bag" value={`₹${crossDockBagRate}`} />}
            </div>
          </div>
        )}

        {incentiveOn && (
          <div className="mb-4 border border-black/8 rounded-md p-3 bg-[#FBF6FA]">
            <div className="text-[10px] uppercase text-black/50 tracking-wider mb-2 flex items-center gap-2">
              <span>Incentive</span>
              <span className="mono text-[9px] px-1.5 py-0.5 bg-[#580A46] text-white rounded">time-bound</span>
            </div>
            <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-4'} gap-3`}>
              <ReviewRow label="Base slab-1 rate" value={tiers && tiers[0] ? `₹${tiers[0].rate.toFixed(2)}` : '—'} />
              <ReviewRow label="Incremental" value={incIncremental ? `+₹${incIncremental}` : '—'} />
              <ReviewRow label="Period" value={incPeriod ?? '—'} />
              <ReviewRow label="Window" value={incStart && incEnd ? `${incStart} → ${incEnd}` : '—'} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-4`}>
        <ReviewRow label="Hub" value={`${hub.code} · ${hub.name}`} />
        <ReviewRow label="Oracle ID" value={hub.oracleId ?? '—'} />
        <ReviewRow label="Change type" value={changeType} />
        <ReviewRow label="Hub type (confirmed)" value={effectiveType ?? '—'} />
        <ReviewRow label="Unit" value={unit} />
        <ReviewRow label="Structure" value={slabDesc} />
        {touchpointRate && <ReviewRow label="Touchpoint" value={`₹${touchpointRate}/shipment`} />}
        <ReviewRow label="Effective from" value={effectiveFrom} />
        <ReviewRow label="Negotiated" value={negotiatedOn} />
        <ReviewRow label="Guardrail" value={`${verdict.version} · ${verdict.status}`} />
        {vendor && <ReviewRow label="Partner" value={`${vendor.name} #${vendor.supplierNumber}`} />}
      </div>
      <div className={`banner ${verdict.status === 'within' ? 'banner-green' : 'banner-amber'} mb-4`}>
        On submit: routed to <strong>{verdict.route}</strong> · TTL 14 days · Rate stays Draft-equivalent until the approver decides.
      </div>
    </>
  );
}

// SectionHeader now imported from '@/components/ui'

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-black/50 mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/8 rounded-md p-2.5">
      <div className="text-[10px] uppercase text-black/50 mb-0.5">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

// -------- new KRD helpers --------

export function hubStatusLabel(s: NonNullable<Hub['status']>): string {
  switch (s) {
    case 'GoLivePending': return 'Go-live pending';
    case 'LiveAgreementPending': return 'Live · agreement pending';
    case 'LiveAgreementExecuted': return 'Live · agreement executed';
    case 'PendingDeactivation': return 'Pending deactivation';
    case 'Deactivated': return 'Deactivated';
  }
}

function FmcpEditor({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const inputCls = mobile ? 'field-input !text-[16px] !py-3 num text-right' : 'field-input num text-right';
  return (
    <div className="space-y-4">
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>
        <div>
          <label className="field-label">Fwd rate (₹/shipment)</label>
          <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={form.fwdRate} onChange={e => form.setFwdRate(e.target.value)} placeholder="e.g. 0.20" />
          <div className="text-[11px] text-black/50 mt-1">FM hub → FMCP</div>
        </div>
        <div>
          <label className="field-label">Rev rate (₹/shipment)</label>
          <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={form.revRate} onChange={e => form.setRevRate(e.target.value)} placeholder="e.g. 0.30" />
          <div className="text-[11px] text-black/50 mt-1">Seller-to-SC → FMCP</div>
        </div>
        <div>
          <label className="field-label">Bag rate (₹/bag)</label>
          <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={form.bagRate} onChange={e => form.setBagRate(e.target.value)} placeholder="e.g. 14.00" />
          <div className="text-[11px] text-black/50 mt-1">Per bag flat</div>
        </div>
      </div>
      <div className="banner banner-purple">
        <div>
          <div className="font-semibold">FMCP: no guardrail applies — routes to BizFin</div>
          <div className="text-xs mt-1 opacity-80">Consolidation rate per KRD §1.1.2 · flat structure, no tier slabs.</div>
        </div>
      </div>
    </div>
  );
}

function FmTouchpointField({ form, mobile }: { form: FormApi; mobile?: boolean }) {
  const inputCls = mobile ? 'field-input !text-[16px] !py-3' : 'field-input';
  const tp = form.verdict?.touchpoint;
  const banner = !form.touchpointRate ? null
    : tp && tp.ceiling !== null
      ? tp.within
        ? { tone: 'green', text: `Within touchpoint ceiling ₹${tp.ceiling.toFixed(2)}` }
        : { tone: 'amber', text: `₹${tp.rate.toFixed(2)} exceeds ceiling ₹${tp.ceiling.toFixed(2)} — escalates to BizFin` }
      : { tone: 'grey', text: 'No touchpoint ceiling for this hub type/city — escalates to BizFin' };
  return (
    <div className="mt-4 p-4 border border-black/8 rounded-md bg-black/[.02]">
      <div className="mono text-[10px] uppercase tracking-wider text-black/55 mb-3">Touchpoint (optional · KRD §1.1.3)</div>
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3 items-start`}>
        <div>
          <label className="field-label">Touchpoint rate (₹/shipment) <span className="text-black/40 font-normal">optional</span></label>
          <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={form.touchpointRate} onChange={e => form.setTouchpointRate(e.target.value)} placeholder="e.g. 3.50" />
          <div className="text-[11px] text-black/50 mt-1">Per unique supplier an FE visits per day</div>
        </div>
        {banner && (
          <div className={`text-[12px] px-3 py-2 rounded-md border ${
            banner.tone === 'green' ? 'bg-[#E7F5EF] border-[#8FCBAF] text-[#0B5C3E]' :
            banner.tone === 'amber' ? 'bg-[#FFF4E0] border-[#E0B870] text-[#7A4A00]' :
            'bg-black/[.03] border-black/10 text-black/60'
          }`}>{banner.text}</div>
        )}
      </div>
    </div>
  );
}

function HubTaxonomyPanel({ hubType }: { hubType: HubType }) {
  const tx = taxonomyFor(hubType);
  if (!tx) return null;
  const structuresLabel = tx.structures.filter(s => s !== 'UNDEFINED').join(' or ') || 'not yet defined';
  const guardrailLabel = tx.guardrailPolicy === 'applicable' ? 'Applicable' : tx.guardrailPolicy === 'not-applicable' ? 'Not applicable' : 'Not yet published';
  const clauseLabel = tx.clauseFields.length ? tx.clauseFields.join(', ') : '—';
  return (
    <div className="mt-3 p-3 border border-black/10 rounded-md bg-black/[.02]" data-testid="hub-taxonomy-panel">
      <div className="mono text-[10px] uppercase tracking-wider text-black/55 mb-2">
        Derived from hub type · read-only
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
        <Field label="Structure" value={structuresLabel} />
        <Field label="Unit" value={tx.unit} />
        <Field label="Guardrail" value={guardrailLabel} />
        <Field label="Approver" value={tx.approverName} />
      </div>
      {tx.clauseFields.length > 0 && (
        <div className="mt-2 text-[11px] text-black/55">
          Clause fields: <span className="mono">{clauseLabel}</span>
        </div>
      )}
    </div>
  );
}

function AbnormalBanner({ flags, reasons, setReasons }: {
  flags: ReturnType<typeof computeAbnormal>;
  reasons: Record<number, string>;
  setReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}) {
  if (!flags.length) return null;
  return (
    <div
      className="mt-3 border border-[#B87500] rounded-md p-3 bg-transparent"
      data-testid="abnormal-banner"
    >
      <div className="text-[12px] font-semibold text-[#8A5800] mb-2">
        Sanity check: rate is outside typical band
      </div>
      <div className="text-[11px] text-black/60 mb-2">
        Route is unchanged — but add a written reason for each flagged tier before submit (FR-24).
      </div>
      <div className="space-y-2">
        {flags.map(f => (
          <div key={f.tierIndex} className="text-[11.5px]">
            <div className="text-black/70 mb-1">{f.reason}</div>
            <input
              className="field-input !py-1.5 !text-[12px]"
              placeholder={`Reason for T${f.tierIndex + 1} (mandatory)`}
              value={reasons[f.tierIndex] ?? ''}
              onChange={e => setReasons(prev => ({ ...prev, [f.tierIndex]: e.target.value }))}
              data-testid={`abnormal-reason-${f.tierIndex}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function HubTypePicker({ value, onChange, mappingHubType }: {
  value: HubType | undefined;
  onChange: (v: HubType) => void;
  mappingHubType: HubType | undefined;
}) {
  return (
    <div className="mt-4">
      <label className="field-label">Hub type <span className="text-red-600 font-semibold">*</span> <span className="text-black/40 font-normal">confirm the mapping</span></label>
      <div className="flex flex-wrap gap-2">
        {FM_HUB_TYPES.map(t => {
          const on = value === t;
          const isHint = !value && mappingHubType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={`px-3 py-2 rounded-md border text-[12.5px] transition ${on ? 'border-[#580A46] bg-[#F5E8F0] text-[#580A46] font-semibold' : isHint ? 'border-dashed border-[#580A46]/50 text-[#580A46]/70 bg-white' : 'border-black/10 bg-white hover:border-black/25'}`}
            >
              {t}
              {mappingHubType === t && <span className="ml-1 text-[10px] mono text-black/40">mapping</span>}
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-black/55 mt-2">
        Confirm the hub type — the mapping file has known spelling issues (KRD §II.3.6).
        {mappingHubType && <> Mapping suggests <span className="mono font-semibold">{mappingHubType}</span>.</>}
      </div>
    </div>
  );
}

function ScSubTypePicker({ value, onChange, validation }: {
  value: ScSubType[];
  onChange: (v: ScSubType[]) => void;
  validation: { ok: true } | { ok: false; reason: string };
}) {
  function toggle(t: ScSubType) {
    if (value.includes(t)) onChange(value.filter(x => x !== t));
    else onChange([...value, t]);
  }
  return (
    <div className="mt-4">
      <label className="field-label">SC sub-types (KRD §2.0) <span className="text-black/40 font-normal">multi-select</span></label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {SC_SUB_TYPE_OPTIONS.map(opt => {
          const on = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`text-left p-3 rounded-md border transition ${on ? 'border-[#580A46] bg-[#F5E8F0]' : 'border-black/10 hover:border-black/25'}`}
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={on} readOnly className="h-4 w-4 accent-[#580A46] pointer-events-none" />
                <span className="font-semibold text-sm">{opt.label}</span>
              </div>
              <div className="text-[11px] text-black/60 mt-1 ml-6">{opt.description}</div>
            </button>
          );
        })}
      </div>
      {!validation.ok && (
        <div className="banner banner-red mt-3 text-[13px]">
          <div><div className="font-semibold mb-0.5">SC sub-type rule violated</div><div>{validation.reason}</div></div>
        </div>
      )}
    </div>
  );
}


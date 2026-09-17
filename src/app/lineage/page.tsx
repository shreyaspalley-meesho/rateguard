'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useApp } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StateChip } from '@/components/Chip';
import type { HubType, Segment } from '@/lib/types';

const FM_HUB_TYPES: HubType[] = ['Standalone', 'Mall Hub', 'Mini Hub', 'Seller Led Hub', 'FMCP'];

export default function LineageIndexPage() {
  return (
    <Suspense fallback={<div className="text-sm text-black/50">Loading…</div>}>
      <LineageIndex />
    </Suspense>
  );
}

function LineageIndex() {
  const allHubs = useApp(s => s.hubs);
  const requests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const sp = useSearchParams();
  const qParam = sp.get('q') ?? '';

  const [query, setQuery] = useState(qParam);
  useEffect(() => { setQuery(qParam); }, [qParam]);

  const [segment, setSegment] = useState<Segment | 'ALL'>('ALL');
  const [hubType, setHubType] = useState<HubType | 'ALL'>('ALL');
  const [zone, setZone] = useState<string>('ALL');
  const [openOnly, setOpenOnly] = useState(false);

  const vendorByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of requests) {
      if (r.vendorSupplierNumber && !m.has(r.hubCode)) m.set(r.hubCode, r.vendorSupplierNumber);
    }
    return m;
  }, [requests]);
  const vendorNumToName = useMemo(() => new Map(vendors.map(v => [v.supplierNumber, v.name])), [vendors]);

  const zones = useMemo(() => Array.from(new Set(allHubs.map(h => h.zone))).sort(), [allHubs]);

  const hubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allHubs
      .filter(h => h.active)
      .filter(h => {
        if (segment !== 'ALL' && h.segment !== segment) return false;
        if (hubType !== 'ALL' && h.hubType !== hubType) return false;
        if (zone !== 'ALL' && h.zone !== zone) return false;
        if (openOnly) {
          const hasOpen = requests.some(r => r.hubCode === h.code && (r.state === 'Pending' || r.state === 'Approved'));
          if (!hasOpen) return false;
        }
        if (!q) return true;
        const vendorNo = vendorByCode.get(h.code) ?? '';
        const vendorName = vendorNumToName.get(vendorNo) ?? '';
        const hay = [h.code, h.name, h.oracleId ?? '', vendorNo, vendorName].join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [allHubs, query, segment, hubType, zone, openOnly, requests, vendorByCode, vendorNumToName]);

  function clear() {
    setQuery(''); setSegment('ALL'); setHubType('ALL'); setZone('ALL'); setOpenOnly(false);
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">Rate lineage</h1>
      <p className="text-sm text-black/60 mb-5">Search hubs by code, name, Oracle ID, or vendor supplier number.</p>

      <div className="card p-3 md:p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-black/40 text-lg mono">⌕</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search hub, Oracle ID, vendor…"
            className="field-input !py-2.5 flex-1 min-w-0"
          />
          {(query || segment !== 'ALL' || hubType !== 'ALL' || zone !== 'ALL' || openOnly) && (
            <button type="button" onClick={clear} className="btn btn-ghost !py-2 shrink-0">Clear</button>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2.5 text-[12px]">
          <div className="-mx-3 md:mx-0 px-3 md:px-0 flex md:flex-wrap gap-3 md:gap-2 items-center overflow-x-auto md:overflow-visible pb-1 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ChipGroup label="Segment" value={segment} options={[{v: 'ALL', l: 'All'}, {v: 'FM', l: 'FM'}, {v: 'SC', l: 'SC'}]} onChange={v => setSegment(v as Segment | 'ALL')} />
            <ChipGroup label="Hub type" value={hubType} options={[{v: 'ALL', l: 'All'}, ...FM_HUB_TYPES.map(t => ({v: t, l: t}))]} onChange={v => setHubType(v as HubType | 'ALL')} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold tracking-wide text-black/55 uppercase mr-1">Zone</span>
              <select value={zone} onChange={e => setZone(e.target.value)} className="field-input !py-1 !px-2 !text-[12px] w-auto">
                <option value="ALL">All zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[#580A46]" />
              <span className="text-[12px]">Has open requests</span>
            </label>
            <div className="ml-auto text-[11px] text-black/50 mono">{hubs.length} hub{hubs.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {hubs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-sm font-semibold mb-2">No hubs match your search</div>
          <button onClick={clear} className="btn btn-ghost">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {hubs.map(h => {
            const hubReqs = requests.filter(r => r.hubCode === h.code);
            const openReq = hubReqs.find(r => r.state === 'Pending' || r.state === 'Approved');
            const executed = hubReqs.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find(r => r.state === 'Executed');
            const currentRate = executed?.tiers[0]?.rate;
            const chipTone = h.segment === 'FM' ? 'FM · ' + (h.hubType ?? '—') : 'SC · ' + (h.scSubTypes?.join('+') ?? '—');
            return (
              <Link key={h.code} href={`/lineage/${h.code}`} className="card p-4 hover:border-[#580A46] transition block">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="mono font-bold text-[15px]">{h.code}</div>
                  <span className="mono text-[10px] px-2 py-[2px] rounded bg-[#F6EDF3] text-[#580A46] font-semibold uppercase">{chipTone}</span>
                </div>
                <div className="text-[13px] mb-1 truncate">{h.name}</div>
                <div className="text-[11px] text-black/55 mb-3">{h.city} · {h.zone}</div>
                <div className="flex items-center justify-between border-t border-black/8 pt-3">
                  <div>
                    <div className="text-[10px] uppercase text-black/50 tracking-wide">Tier 1</div>
                    <div className="mono font-bold text-[13px]">{currentRate !== undefined ? `₹${currentRate.toFixed(2)}` : '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-black/50 tracking-wide">Versions</div>
                    <div className="mono font-bold text-[13px] text-[#580A46]">{hubReqs.length}</div>
                  </div>
                  {openReq ? <StateChip state={openReq.state} /> : <span className="chip chip-outline-grey">Live</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ v: T; l: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10.5px] font-semibold tracking-wide text-black/55 uppercase mr-1">{label}</span>
      <div className="flex gap-1">
        {options.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`px-2 py-[3px] rounded text-[11.5px] border transition ${value === o.v ? 'border-[#580A46] bg-[#F5E8F0] text-[#580A46] font-semibold' : 'border-black/10 bg-white hover:border-black/25 text-black/65'}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

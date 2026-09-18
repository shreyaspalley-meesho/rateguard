'use client';

import { useApp } from '@/lib/store';
import { StateChip } from '@/components/Chip';
import { format } from 'date-fns';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { RateRequest } from '@/lib/types';

export default function LineageClient({ hubCode }: { hubCode: string }) {
  const allHubs = useApp(s => s.hubs);
  const allRequests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);

  const hub = useMemo(() => allHubs.find(h => h.code === hubCode), [allHubs, hubCode]);
  const requests = useMemo(
    () => allRequests.filter(r => r.hubCode === hubCode).slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    [allRequests, hubCode],
  );
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.supplierNumber, v])), [vendors]);
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState<string>(today);

  const primary = useMemo(() => {
    const changeTypes = requests.map(r => r.changeType);
    return changeTypes.find(c => c.startsWith('FM') || c.startsWith('SC')) ?? '—';
  }, [requests]);

  const primaryRequests = useMemo(
    () => requests.filter(r => r.changeType === primary),
    [requests, primary],
  );

  // "Current for provisioning": newest Approved (or Executed) with effectiveFrom <= asOf
  const provisioning = useMemo(
    () => primaryRequests.find(r => (r.state === 'Approved' || r.state === 'Executed') && r.effectiveFrom <= asOf),
    [primaryRequests, asOf],
  );
  // "Current for payment": newest Executed with effectiveFrom <= asOf
  const payment = useMemo(
    () => primaryRequests.find(r => r.state === 'Executed' && r.effectiveFrom <= asOf),
    [primaryRequests, asOf],
  );
  const sameProjection = provisioning && payment && provisioning.id === payment.id;
  const primaryVendor = provisioning?.vendorSupplierNumber ? vendorMap.get(provisioning.vendorSupplierNumber) : undefined;
  const currentGuardrail = provisioning?.guardrailVersion ?? requests[0]?.guardrailVersion ?? '—';

  if (!hub) return <div className="max-w-4xl">Hub not found</div>;

  const hubTypeLabel = hub.segment === 'FM'
    ? `FM · ${(hub.hubType ?? 'UNKNOWN').toUpperCase()}`
    : `SC · ${(hub.scSubTypes ?? []).join('+') || 'UNKNOWN'}`;

  return (
    <div className="max-w-6xl">
      <div className="text-[11.5px] text-black/60 mb-1.5">
        <Link href="/lineage" className="hover:text-[#580A46]">Search</Link>
        <span className="mx-1.5">›</span>
        <span className="text-black/80">Rate lineage</span>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 md:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[19px] md:text-[22px] font-bold break-words">{hub.code} · {hub.name}</h1>
            <span className="mono text-[10px] px-2 py-[3px] rounded bg-[#F6EDF3] text-[#580A46] font-semibold uppercase tracking-wide">
              {hubTypeLabel}
            </span>
          </div>
          <div className="text-[12.5px] text-black/60 mt-1">
            Oracle {hub.oracleId ?? '—'} · {primaryVendor?.name ?? '—'} · {hub.city} · {hub.zone} · rate type {primary}
          </div>
        </div>
        <div className="flex items-end gap-2.5">
          <div className="flex-1 md:flex-none">
            <div className="text-[9.5px] font-semibold mono tracking-wide text-black/55 mb-1">AS OF</div>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="field-input !py-1.5 !text-[12px] w-full md:w-auto" />
          </div>
          <button type="button" className="btn btn-ghost !py-2 shrink-0">Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
        <ProjectionCard title="CURRENT FOR PROVISIONING" subtitle="what Finance books" req={provisioning} sameAsOther={!!sameProjection} tone="green" />
        <ProjectionCard title="CURRENT FOR PAYMENT" subtitle="what the vendor is paid" req={payment} sameAsOther={!!sameProjection} tone={sameProjection ? 'green' : 'purple'} />
      </div>

      <div className="border border-black/8 rounded-md bg-white p-3 mb-4 text-[11.5px] leading-relaxed text-black/65">
        {sameProjection
          ? <>Today the two projections agree. If a newer Approved-but-unsigned version exists, provisioning will move first — advance the as-of date to preview.</>
          : provisioning && payment
            ? <>Projections diverge. Provisioning uses <strong className="text-black">{provisioning.id}</strong> (Approved) while Payment stays on <strong className="text-black">{payment.id}</strong> (Executed) until the addendum lands.</>
            : <>No version governs at this as-of date yet.</>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-4 items-start">
        <div className="border border-black/8 rounded-md bg-white overflow-hidden order-2 lg:order-1">
          <div className="px-4 py-3 border-b border-black/8 flex items-center gap-2.5">
            <span className="font-semibold text-[12.5px]">Version timeline</span>
            <span className="text-[11px] text-black/55">newest first · nothing is edited in place</span>
          </div>
          {requests.length === 0 ? (
            <div className="p-8 text-center text-black/50 text-sm">No rate history yet.</div>
          ) : (
            <ol>
              {requests.map((r, i) => (
                <TimelineRow key={r.id} req={r} vendorName={r.vendorSupplierNumber ? vendorMap.get(r.vendorSupplierNumber)?.name : undefined} vendorNo={r.vendorSupplierNumber} asOf={asOf} isLast={i === requests.length - 1} />
              ))}
            </ol>
          )}
          <div className="px-4 py-2.5 bg-[#FAFAFA] text-[11px] text-black/55">
            {requests.length} version{requests.length === 1 ? '' : 's'}.
          </div>
        </div>

        <div className="flex flex-col gap-3.5 order-1 lg:order-2">
          <div className="border border-black/8 rounded-md bg-white p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="font-semibold text-[12px]">Why this version governs</span>
              <span className="mono text-[9px] px-1.5 py-[1px] rounded bg-black/5 text-black/60 font-bold">TRACE</span>
            </div>
            <ol className="flex flex-col gap-2">
              {[
                `As-of date ${format(new Date(asOf), 'dd MMM yyyy')} · rate type ${primary}`,
                `${primaryRequests.filter(r => r.effectiveFrom <= asOf).length} version(s) have an effective date on or before it`,
                provisioning ? `The later one — ${format(new Date(provisioning.effectiveFrom), 'dd MMM yyyy')} — wins on effective date` : 'No version has an effective date within range',
                provisioning ? (provisioning.state === 'Approved' || provisioning.state === 'Executed' ? 'It is Approved, so it is provisionable' : `Provisioning gate: ${provisioning.state}`) : '—',
                payment && sameProjection ? 'It is Verified, so it is also payable — both projections resolve to the same version' : payment ? 'Payment resolves to the newest Executed version' : 'No Executed version yet — payment stays on the previous rate',
              ].map((step, idx) => (
                <li key={idx} className="flex gap-2.5">
                  <span className={`w-[14px] h-[14px] flex-none text-center font-bold rounded-[3px] text-[8.5px] leading-[14px] ${idx === 4 && sameProjection ? 'bg-[#E7F5EF] text-[#0B5C3E]' : 'bg-black/5 text-black/60'}`}>{idx + 1}</span>
                  <span className="text-[11px] leading-snug text-black/65">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border border-black/8 rounded-md bg-white p-4">
            <div className="font-semibold text-[12px] mb-2.5">Pinned references</div>
            <div className="flex flex-col gap-2 text-[11.5px] text-black/60">
              <RefRow label="Guardrail" value={currentGuardrail} mono />
              <RefRow label="SpotDraft" value={provisioning?.agreementUrl ? extractSpotDraft(provisioning.agreementUrl) : '—'} mono purple />
              <RefRow label="Addendum" value={provisioning?.addendumId ?? '—'} mono purple />
              <RefRow label="Approver of record" value={provisioning?.approvals[0]?.role ?? '—'} />
              <RefRow label="Hub status" value={hubStatusText(hub.status)} />
            </div>
          </div>

          <div className="border border-black/8 rounded-md bg-white p-4">
            <div className="font-semibold text-[12px] mb-2">Other rate types on this hub</div>
            <OtherRateTypes requests={requests} primary={primary} />
            <div className="text-[10.5px] leading-snug text-black/55 mt-2.5">
              Lineage is per hub <em>and</em> rate type — each has its own timeline.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({ title, subtitle, req, sameAsOther, tone }: {
  title: string; subtitle: string; req: RateRequest | undefined; sameAsOther: boolean; tone: 'green' | 'purple';
}) {
  const isGreen = tone === 'green';
  const bg = isGreen ? 'bg-[#F4FBF8] border-[#8FCBAF]' : 'bg-[#F6EDF3] border-[#D9C2D2]';
  const fg = isGreen ? 'text-[#0B5C3E]' : 'text-[#580A46]';
  return (
    <div className={`border rounded-md ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`mono text-[9.5px] font-bold tracking-wide ${fg}`}>{title}</span>
        <span className={`text-[10.5px] ${fg} opacity-80`}>{subtitle}</span>
      </div>
      {req ? (
        <>
          <div className="mono font-bold text-[17px] text-black">
            ₹{req.tiers[0]?.rate.toFixed(2) ?? '—'} <span className="font-normal text-[12px] text-black/60">tier 1 · {req.tiers.length}-tier card</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <StateChip state={req.state} />
            <span className={`mono text-[10px] ${fg}`}>{sameAsOther ? 'Current' : 'Different'}</span>
          </div>
        </>
      ) : (
        <div className="text-[12px] text-black/50">No governing version</div>
      )}
    </div>
  );
}

function TimelineRow({ req, vendorName, vendorNo, asOf, isLast }: {
  req: RateRequest; vendorName?: string; vendorNo?: string; asOf: string; isLast: boolean;
}) {
  const dot =
    req.state === 'Executed' ? { bg: '#0F7A52', ring: '#0F7A52' } :
    req.state === 'Approved' ? { bg: '#580A46', ring: '#580A46' } :
    req.state === 'Rejected' ? { bg: '#C22C2C', ring: '#C22C2C' } :
    req.state === 'AutoClosed' ? { bg: '#A1A1AA', ring: '#A1A1AA' } :
    { bg: '#fff', ring: '#71717A' };
  const temporal =
    req.effectiveFrom > asOf ? 'Scheduled' :
    req.state === 'Executed' ? 'Current' :
    req.state === 'Approved' ? 'Provisionable' :
    req.state === 'Superseded' ? 'Superseded' :
    req.state === 'Rejected' ? 'Rejected' :
    req.state === 'AutoClosed' ? 'Auto-closed' :
    req.state === 'Pending' ? 'Pending' : 'Historical';

  const tier1 = req.tiers[0]?.rate;
  return (
    <li>
      <Link href={`/approvals/${req.id}`} className="flex gap-3 px-3 md:px-4 py-3.5 border-b border-black/5 hover:bg-black/[.02] transition">
        <div className="flex flex-col items-center w-3 flex-none">
          <div className="w-[10px] h-[10px] rounded-full mt-1" style={{ background: dot.bg, border: `2px solid ${dot.ring}` }} />
          {!isLast && <div className="flex-1 w-px bg-black/8 mt-1" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-[13px] md:text-[12.5px]">{format(new Date(req.effectiveFrom), 'dd MMM yyyy')}</span>
            <span className="text-[11.5px] text-black/60">{req.changeType}</span>
            <span className="mono text-[10px] text-black/55 ml-auto md:ml-0">{temporal}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <StateChip state={req.state} />
            {tier1 !== undefined && (
              <span className="ml-auto mono font-bold text-[14px] text-black md:hidden">₹{tier1.toFixed(2)}<span className="text-[9.5px] text-black/50 font-normal ml-1">T1</span></span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 md:hidden gap-1.5">
            {req.tiers.length === 0
              ? <span className="mono text-[11px] text-black/50 col-span-3">(flat)</span>
              : req.tiers.map((t, i) => (
                <div key={i} className="px-2 py-1 bg-black/[.03] rounded text-center">
                  <div className="text-[9px] text-black/50 uppercase tracking-wide">T{i + 1}</div>
                  <div className="mono text-[11.5px] font-semibold">₹{t.rate.toFixed(2)}</div>
                </div>
              ))}
          </div>
          <div className="mt-1.5 mono text-[12.5px] text-black/70 hidden md:block">
            {req.tiers.map((t, i) => `T${i + 1} ₹${t.rate.toFixed(2)}`).join(' · ') || '(flat)'}
          </div>
          <div className="mt-2 md:mt-1 mono text-[10.5px] text-black/55 leading-relaxed">
            <span className="block md:inline">{req.id}</span>
            <span className="hidden md:inline"> · </span>
            <span className="block md:inline">Submitted {format(new Date(req.submittedAt), 'dd MMM yyyy')} by {req.submittedBy}</span>
            <span className="hidden md:inline"> · </span>
            <span className="block md:inline">Guardrail {req.guardrailVersion}</span>
            {vendorName && (<>
              <span className="hidden md:inline"> · </span>
              <span className="block md:inline">Vendor {vendorName} #{vendorNo}</span>
            </>)}
          </div>
        </div>
      </Link>
    </li>
  );
}

function RefRow({ label, value, mono, purple }: { label: string; value: string; mono?: boolean; purple?: boolean }) {
  return (
    <div className="flex">
      <span className="flex-1">{label}</span>
      <span className={`font-semibold ${mono ? 'mono' : ''} ${purple ? 'text-[#580A46]' : 'text-black'}`}>{value}</span>
    </div>
  );
}

function OtherRateTypes({ requests, primary }: { requests: RateRequest[]; primary: string }) {
  const touchpoint = requests.find(r => r.clause?.touchpointRate !== undefined)?.clause?.touchpointRate;
  const otherTypes = Array.from(new Set(requests.map(r => r.changeType))).filter(t => t !== primary);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11.5px] text-black/70">Touchpoint</span>
        <span className="mono font-semibold text-[11.5px] text-black">{touchpoint !== undefined ? `₹${touchpoint.toFixed(2)}` : '—'}</span>
      </div>
      {otherTypes.length === 0 ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11.5px] text-black/55">Other change types</span>
          <span className="text-[11.5px] text-black/55">none</span>
        </div>
      ) : otherTypes.map(t => {
        const rec = requests.find(r => r.changeType === t);
        const label = rec?.state === 'Executed' ? 'active' : rec?.state === 'Superseded' ? 'superseded' : rec?.state.toLowerCase();
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="flex-1 text-[11.5px] text-black/55">{t}</span>
            <span className="text-[11.5px] text-black/55">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function extractSpotDraft(url: string): string {
  const m = url.match(/SD-\d+/);
  if (m) return m[0];
  const parts = url.split('/');
  return parts[parts.length - 1] || url;
}

function hubStatusText(s?: string): string {
  switch (s) {
    case 'GoLivePending': return 'Go-live pending';
    case 'LiveAgreementPending': return 'Live · agreement pending';
    case 'LiveAgreementExecuted': return 'Live · agreement executed';
    case 'PendingDeactivation': return 'Pending deactivation';
    case 'Deactivated': return 'Deactivated';
    default: return '—';
  }
}

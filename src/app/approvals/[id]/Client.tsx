'use client';

import { useApp, useCurrentGuardrail } from '@/lib/store';
import { personaById } from '@/lib/personas';
import { StateChip, EvidenceChip, Chip } from '@/components/Chip';
import { evaluate } from '@/lib/guardrail';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DecisionClient({ id }: { id: string }) {
  const requests = useApp(s => s.requests);
  const hubs = useApp(s => s.hubs);
  const vendors = useApp(s => s.vendors);
  const approve = useApp(s => s.approve);
  const reject = useApp(s => s.reject);
  const persona = useApp(s => personaById(s.currentPersona));
  const gv = useCurrentGuardrail();
  const router = useRouter();

  const [reason, setReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const req = requests.find(r => r.id === id);
  if (!req) return <div className="p-6">Request not found. <Link href="/approvals" className="text-[#580A46]">Back</Link></div>;
  const hub = hubs.find(h => h.code === req.hubCode);
  const vendor = req.vendorSupplierNumber ? vendors.find(v => v.supplierNumber === req.vendorSupplierNumber) : undefined;
  const verdict = hub ? evaluate(gv, hub, req.changeType, req.tiers, hub.segment) : null;

  const canDecide = req.state === 'Pending';

  return (
    <div className="max-w-4xl">
      <Link href="/approvals" className="text-xs text-[#580A46] mono mb-4 inline-block">← queue</Link>

      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-bold mono">{req.id}</h1>
        <div className="flex gap-2"><StateChip state={req.state} /><EvidenceChip evidence={req.evidence} /></div>
      </div>
      <p className="text-sm text-black/60 mb-6">{hub?.name} · {req.changeType} · submitted by {req.submittedBy}</p>

      {verdict && (
        <div className={`banner ${verdict.status === 'within' ? 'banner-green' : verdict.status === 'breach' ? 'banner-amber' : 'banner-purple'} mb-6`}>
          <div>
            <div className="font-semibold">Guardrail {verdict.version}: {verdict.reason}</div>
            <div className="text-xs mt-1 opacity-80">Route: {verdict.route}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Tiers</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase text-black/50 border-b border-black/8"><th className="text-left py-1.5">Tier</th><th className="text-right">Proposed</th><th className="text-right">Ceiling</th></tr></thead>
            <tbody>
              {req.tiers.map((t, i) => {
                const ceil = verdict?.ceiling?.[i];
                const breached = ceil !== undefined && t.rate > ceil;
                return (
                  <tr key={i} className="border-b border-black/5">
                    <td className="py-1.5">T{i + 1} · {t.upTo === null ? '>' + (req.tiers[i - 1]?.upTo ?? '') : '≤' + t.upTo}</td>
                    <td className={`text-right num ${breached ? 'text-[#C42B1C] font-semibold' : ''}`}>₹{t.rate.toFixed(2)}</td>
                    <td className="text-right num text-black/60">{ceil !== undefined ? `₹${ceil}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Details</h3>
          <dl className="text-sm space-y-2">
            <Row k="Effective from" v={req.effectiveFrom} />
            <Row k="Negotiated on" v={req.negotiatedOn} />
            <Row k="Guardrail version" v={req.guardrailVersion} />
            <Row k="Oracle ID" v={hub?.oracleId ?? '—'} />
            <Row k="Owner" v={hub?.owner ?? '—'} />
            {vendor && <Row k="Partner" v={`${vendor.name} #${vendor.supplierNumber}`} />}
            {req.clause?.mg !== undefined && <Row k="Minimum Guarantee" v={`₹${req.clause.mg.toLocaleString('en-IN')}`} />}
            {req.clause?.mgTrigger && <Row k="MG trigger" v={req.clause.mgTrigger} />}
            {req.clause?.lockInMonths !== undefined && <Row k="Lock-in" v={`${req.clause.lockInMonths} months`} />}
            {req.clause?.crossDockBagRate !== undefined && <Row k="CrossDock bag rate" v={`₹${req.clause.crossDockBagRate.toFixed(2)}`} />}
          </dl>
        </div>
      </div>

      {req.incentive && (
        <div className="card p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3">Incentive attached</h3>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Row k="Base rate" v={`₹${req.incentive.base.toFixed(2)}`} />
            <Row k="Incremental" v={`₹${req.incentive.incremental.toFixed(2)}`} />
            <Row k="Period" v={req.incentive.period} />
            <Row k="Start" v={req.incentive.start} />
            <Row k="End" v={req.incentive.end} />
          </dl>
        </div>
      )}

      {req.remarks && (
        <div className="card p-4 mb-6">
          <h3 className="font-semibold text-sm mb-2">Submitter remarks</h3>
          <p className="text-sm text-black/70">{req.remarks}</p>
        </div>
      )}

      {req.revisions.length > 0 && (
        <div className="card p-4 mb-6" data-testid="revision-chain">
          <h3 className="font-semibold text-sm mb-3">Revision chain · {req.revisions.map(rv => `r${rv.revision}`).concat(`r${req.revision}`).join(' → ')}</h3>
          <div className="space-y-3">
            {req.revisions.map((prev, idx) => {
              const nextTiers = (req.revisions[idx + 1]?.tiers) ?? req.tiers;
              const nextEff = (req.revisions[idx + 1]?.effectiveFrom) ?? req.effectiveFrom;
              return (
                <div key={prev.revision} className="border border-black/10 rounded-md p-3 text-[12.5px]">
                  <div className="mono text-[11px] text-black/55 mb-2">r{prev.revision} → r{prev.revision + 1} · {format(new Date(prev.at), 'PP')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase text-black/50 mb-1">Effective from</div>
                      <div className={prev.effectiveFrom !== nextEff ? 'text-[#8A5800] mono' : 'mono'}>
                        {prev.effectiveFrom}
                        {prev.effectiveFrom !== nextEff && <span className="ml-2 text-black/50">→ {nextEff}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-black/50 mb-1">Route</div>
                      <div className="mono">{prev.route}</div>
                    </div>
                  </div>
                  <table className="w-full mt-3 text-[12px]">
                    <thead>
                      <tr className="text-[10px] uppercase text-black/50 border-b border-black/8">
                        <th className="text-left py-1">Tier</th>
                        <th className="text-right">r{prev.revision}</th>
                        <th className="text-right">r{prev.revision + 1}</th>
                        <th className="text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prev.tiers.map((t, i) => {
                        const nT = nextTiers[i]?.rate ?? 0;
                        const changed = nT !== t.rate;
                        const delta = nT - t.rate;
                        return (
                          <tr key={i} className="border-b border-black/5">
                            <td className="py-1">T{i + 1}</td>
                            <td className={`text-right num ${changed ? 'text-black/50 line-through' : ''}`}>₹{t.rate.toFixed(2)}</td>
                            <td className={`text-right num ${changed ? 'text-[#8A5800] font-semibold' : ''}`}>₹{nT.toFixed(2)}</td>
                            <td className={`text-right num ${changed ? 'text-[#8A5800]' : 'text-black/30'}`}>
                              {changed ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {prev.reason && <div className="mt-2 text-[11px] text-black/60">Reason: {prev.reason}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {req.rejections.length > 0 && (
        <div className="card p-4 mb-6 border border-[#B00020]/30 bg-[#FFF3F5]">
          <h3 className="font-semibold text-sm text-[#B00020] mb-2">Rejection reason</h3>
          <ul className="space-y-2">
            {req.rejections.map((rej, i) => (
              <li key={i} className="text-sm text-[#B00020]">
                <div className="font-medium">“{rej.reason}”</div>
                <div className="text-[11px] text-black/60 mt-0.5 mono">
                  — {rej.by} · {format(new Date(rej.at), 'PPp')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4 mb-6">
        <h3 className="font-semibold text-sm mb-2">Event log</h3>
        <ul className="text-sm space-y-1.5">
          {req.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="mono text-[11px] text-black/50 min-w-32">{format(new Date(e.at), 'PPp')}</span>
              <Chip tone="grey" variant="outline">{e.kind}</Chip>
              <span>{e.actor}{e.note ? ' — ' + e.note : ''}</span>
            </li>
          ))}
        </ul>
      </div>

      {canDecide && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Decision</h3>
          {!showReject ? (
            <div className="space-y-3">
              <input className="field-input" placeholder="Approval reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => { approve(req.id, persona.name, persona.role, reason); router.push('/approvals'); }}>Approve</button>
                <button className="btn btn-ghost" onClick={() => setShowReject(true)}>Reject…</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input className="field-input" placeholder="Rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-danger" disabled={!rejectReason} onClick={() => { reject(req.id, persona.name, rejectReason); router.push('/approvals'); }}>Confirm reject</button>
                <button className="btn btn-ghost" onClick={() => setShowReject(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-black/55">{k}</dt><dd className="mono text-[12px]">{v}</dd></div>;
}

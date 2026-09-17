'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/store';
import { StateChip, EvidenceChip } from '@/components/Chip';
import Link from 'next/link';
import { format } from 'date-fns';

export default function LegalInbox() {
  const allRequests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const reqs = useMemo(() => allRequests.filter(r => r.state === 'Approved' && r.evidence === 'Awaiting'), [allRequests]);
  const executed = useMemo(() => allRequests.filter(r => r.state === 'Executed').slice(0, 10), [allRequests]);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.supplierNumber, v])), [vendors]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Legal handover inbox</h1>
      <p className="text-sm text-black/60 mb-6">Structured packets with a Rate Change ID for SpotDraft drafting.</p>

      <section className="card mb-6">
        <div className="p-4 border-b border-black/8">
          <h2 className="font-semibold text-sm">Awaiting addendum · {reqs.length}</h2>
        </div>
        {reqs.length === 0 ? (
          <div className="p-8 text-center text-black/50 text-sm">Nothing to draft.</div>
        ) : (
          <ul className="divide-y divide-black/8">
            {reqs.map(r => (
              <li key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="mono text-[11.5px]">{r.id}</div>
                  <div className="text-sm font-semibold">{r.hubCode} · {r.changeType} · effective {r.effectiveFrom}</div>
                  <div className="text-[11px] text-black/55 mt-1">Approved {format(new Date(r.approvals[0]?.at ?? r.submittedAt), 'PP')} by {r.approvals[0]?.by}</div>
                  {r.vendorSupplierNumber && vendorMap.get(r.vendorSupplierNumber) && (
                    <div className="text-[11px] mt-1">Partner: <span className="font-semibold">{vendorMap.get(r.vendorSupplierNumber)!.name}</span> <span className="mono text-black/50">#{r.vendorSupplierNumber}</span></div>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  <EvidenceChip evidence={r.evidence} />
                  <Link href={`/legal/${r.id}`} className="btn btn-primary text-xs">Verify addendum →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="p-4 border-b border-black/8"><h2 className="font-semibold text-sm">Recently executed</h2></div>
        <ul className="divide-y divide-black/8">
          {executed.map(r => (
            <li key={r.id} className="p-3 flex items-center justify-between">
              <div className="mono text-[11.5px]">{r.id} · {r.addendumId ?? '—'}</div>
              <div className="flex gap-2"><StateChip state={r.state} /><EvidenceChip evidence={r.evidence} /></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

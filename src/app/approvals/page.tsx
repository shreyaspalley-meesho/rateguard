'use client';

import { useApp } from '@/lib/store';
import { StateChip } from '@/components/Chip';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import Link from 'next/link';

export default function ApprovalsPage() {
  const currentId = useApp(s => s.currentPersona);
  const requests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const clockOffset = useApp(s => s.clockOffsetDays);
  const vendorMap = new Map(vendors.map(v => [v.supplierNumber, v]));

  const route = currentId === 'ops-fm' ? 'OpsHead-FM' : currentId === 'ops-sc' ? 'OpsHead-SC' : currentId === 'bizfin' ? 'BizFin' : null;

  const queue = route
    ? requests.filter(r => r.state === 'Pending' && r.route === route)
    : requests.filter(r => r.state === 'Pending');

  const sorted = [...queue].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Approvals queue</h1>
          <p className="text-sm text-black/60 mt-1">Oldest first · {sorted.length} pending{route ? ` for ${route}` : ''}</p>
        </div>
        {clockOffset > 0 && <div className="text-xs text-black/50">Clock advanced by {clockOffset}d</div>}
      </div>

      {sorted.length === 0 ? (
        <div className="card p-8 text-center text-black/50">Queue is empty.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data">
            <thead><tr><th>ID</th><th>Hub</th><th>Partner</th><th>Type</th><th>Submitter</th><th>Submitted</th><th>Aging</th><th>TTL</th><th></th></tr></thead>
            <tbody>
              {sorted.map(r => {
                const age = differenceInDays(new Date(Date.now() + clockOffset * 86400000), new Date(r.submittedAt));
                const ttlRemaining = r.ttlDays - age;
                const v = r.vendorSupplierNumber ? vendorMap.get(r.vendorSupplierNumber) : undefined;
                return (
                  <tr key={r.id}>
                    <td className="mono text-[11.5px]">{r.id}</td>
                    <td>{r.hubCode}</td>
                    <td className="text-[12px]">{v ? <>{v.name} <span className="mono text-black/50">#{v.supplierNumber}</span></> : <span className="text-black/40">—</span>}</td>
                    <td>{r.changeType}</td>
                    <td className="text-[12px]">{r.submittedBy}</td>
                    <td className="text-[11.5px]">{format(new Date(r.submittedAt), 'PP')}</td>
                    <td className="num">{age}d</td>
                    <td className={`num ${ttlRemaining <= 3 ? 'text-[#C42B1C] font-semibold' : ''}`}>{ttlRemaining}d</td>
                    <td><Link className="text-[#580A46] font-semibold text-xs" href={`/approvals/${r.id}`}>Decide →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

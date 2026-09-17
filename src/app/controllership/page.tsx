'use client';

import { useApp } from '@/lib/store';
import { Chip } from '@/components/Chip';
import { format } from 'date-fns';

export default function Controllership() {
  const reqs = useApp(s => s.requests);
  const hubs = useApp(s => s.hubs);
  const vendors = useApp(s => s.vendors);

  const feed = reqs
    .filter(r => r.state === 'Executed' || (r.state === 'Approved' && r.evidence === 'Awaiting'))
    .map(r => {
      const h = hubs.find(hb => hb.code === r.hubCode);
      const vendor = r.vendorSupplierNumber ? vendors.find(v => v.supplierNumber === r.vendorSupplierNumber) : undefined;
      const bucket = r.state === 'Executed' ? 'Payable' : 'Provisional';
      const rate = r.tiers[0]?.rate ?? 0;
      return { ...r, hub: h, vendor, bucket, rate };
    });

  const variance = feed.filter(f => f.bucket === 'Provisional');
  const mismatches = reqs.filter(r => r.evidence === 'Mismatch' || r.evidence === 'Overridden');

  function exportCsv() {
    const rows = [
      ['ID', 'Oracle ID', 'Hub', 'Type', 'Rate T1', 'Effective', 'Bucket', 'State', 'Vendor', 'Supplier #'].join(','),
      ...feed.map(f => [f.id, f.hub?.oracleId ?? '', f.hubCode, f.changeType, f.rate, f.effectiveFrom, f.bucket, f.state, f.vendor?.name ?? '', f.vendor?.supplierNumber ?? ''].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rateguard-provisioning-${format(new Date(), 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Controllership</h1>
          <p className="text-sm text-black/60 mt-1">Provisioning feed for {format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <button className="btn btn-primary" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Payable" value={feed.filter(f => f.bucket === 'Payable').length} tone="green" />
        <Stat label="Provisional (booked, not payable)" value={variance.length} tone="amber" />
        <Stat label="Exceptions" value={mismatches.length} tone="red" />
      </div>

      <section className="card mb-6 overflow-hidden">
        <div className="p-4 border-b border-black/8"><h2 className="font-semibold text-sm">Provisioning feed</h2></div>
        <table className="data">
          <thead><tr><th>Rate Change ID</th><th>Oracle</th><th>Hub</th><th>Type</th><th>Partner</th><th className="text-right">Rate</th><th>Effective</th><th>Bucket</th></tr></thead>
          <tbody>
            {feed.map(f => (
              <tr key={f.id}>
                <td className="mono text-[11.5px]">{f.id}</td>
                <td className="mono text-[11.5px]">{f.hub?.oracleId ?? '—'}</td>
                <td>{f.hubCode}</td>
                <td>{f.changeType}</td>
                <td className="text-[12px]">{f.vendor ? <>{f.vendor.name} <span className="mono text-black/50">#{f.vendor.supplierNumber}</span></> : <span className="text-black/40">—</span>}</td>
                <td className="text-right num">₹{f.rate.toFixed(2)}</td>
                <td className="text-[11.5px]">{f.effectiveFrom}</td>
                <td>
                  {f.bucket === 'Payable' ? <Chip tone="green" variant="filled">Payable</Chip> : <Chip tone="amber" variant="outline">Provisional</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="p-4 border-b border-black/8"><h2 className="font-semibold text-sm">Exceptions</h2></div>
        {mismatches.length === 0 ? (
          <div className="p-8 text-center text-black/50 text-sm">No exceptions — clean close.</div>
        ) : (
          <table className="data">
            <thead><tr><th>ID</th><th>Hub</th><th>Evidence</th><th>Override reason</th></tr></thead>
            <tbody>
              {mismatches.map(m => (
                <tr key={m.id}>
                  <td className="mono text-[11.5px]">{m.id}</td>
                  <td>{m.hubCode}</td>
                  <td>{m.evidence}</td>
                  <td className="text-[12px] text-black/70">{m.overrideReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'red' }) {
  const bg = tone === 'green' ? 'bg-[#E8F5EE]' : tone === 'amber' ? 'bg-[#FFF6E5]' : 'bg-[#FDECEA]';
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-md ${bg} mb-3`} />
      <div className="text-3xl font-bold num">{value}</div>
      <div className="text-xs text-black/55 mt-1">{label}</div>
    </div>
  );
}

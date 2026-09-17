'use client';

import Link from 'next/link';
import { useApp } from '@/lib/store';
import { personaById } from '@/lib/personas';
import { StateChip, EvidenceChip } from '@/components/Chip';
import { format, formatDistanceToNow } from 'date-fns';

export default function Home() {
  const persona = useApp(s => personaById(s.currentPersona));
  const currentId = useApp(s => s.currentPersona);
  const requests = useApp(s => s.requests);

  const mine = requests.filter(r => r.submittedBy === persona.name);
  const isApprover = currentId === 'ops-fm' || currentId === 'ops-sc' || currentId === 'bizfin';
  const queueRoute = currentId === 'ops-fm' ? 'OpsHead-FM' : currentId === 'ops-sc' ? 'OpsHead-SC' : 'BizFin';
  const queue = requests.filter(r => r.state === 'Pending' && r.route === queueRoute);

  const executed = requests.filter(r => r.state === 'Executed').length;
  const pending = requests.filter(r => r.state === 'Pending').length;
  const awaiting = requests.filter(r => r.state === 'Approved' && r.evidence === 'Awaiting').length;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1C161A]">Welcome, {persona.name.split(' ')[0]}</h1>
        <p className="text-sm text-black/60 mt-1">{persona.role} · {format(new Date(), 'PPPP')}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Executed rates" value={executed} tint="green" />
        <StatCard label="Pending decisions" value={pending} tint="amber" />
        <StatCard label="Awaiting addendum" value={awaiting} tint="purple" />
        <StatCard label="Total requests" value={requests.length} tint="grey" />
      </div>

      {isApprover && (
        <section className="card mb-6">
          <div className="p-4 border-b border-black/8 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[15px]">Your queue · {queue.length} pending</h2>
              <p className="text-xs text-black/55 mt-0.5">Sorted by aging — oldest first</p>
            </div>
            <Link href="/approvals" className="btn btn-primary">Open queue</Link>
          </div>
          {queue.length === 0 ? <div className="p-6 text-sm text-black/50">Queue is empty.</div> : (
            <table className="data">
              <thead><tr><th>ID</th><th>Hub</th><th>Type</th><th>Submitted</th><th>Aging</th><th></th></tr></thead>
              <tbody>
                {queue.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td className="mono text-[11.5px]">{r.id}</td>
                    <td>{r.hubCode}</td>
                    <td>{r.changeType}</td>
                    <td>{format(new Date(r.submittedAt), 'PP')}</td>
                    <td className="num">{formatDistanceToNow(new Date(r.submittedAt))} ago</td>
                    <td><Link className="text-[#580A46] font-semibold" href={`/approvals/${r.id}`}>Decide →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {(currentId === 'fm-cluster' || currentId === 'sc-biz') && (
        <section className="card mb-6">
          <div className="p-4 border-b border-black/8 flex items-center justify-between">
            <h2 className="font-semibold text-[15px]">My recent requests</h2>
            <Link href="/submit" className="btn btn-primary">+ New rate</Link>
          </div>
          {mine.length === 0 ? <div className="p-6 text-sm text-black/50">No requests yet. Start with <Link href="/submit" className="text-[#580A46] underline">Submit rate</Link>.</div> : (
            <table className="data">
              <thead><tr><th>ID</th><th>Hub</th><th>Type</th><th>State</th><th>Evidence</th><th></th></tr></thead>
              <tbody>
                {mine.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td className="mono text-[11.5px]">{r.id}</td>
                    <td>{r.hubCode}</td>
                    <td>{r.changeType}</td>
                    <td><StateChip state={r.state} /></td>
                    <td><EvidenceChip evidence={r.evidence} /></td>
                    <td><Link className="text-[#580A46] font-semibold" href={`/requests`}>Open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {currentId === 'controllership' && (
        <section className="card">
          <div className="p-4 border-b border-black/8 flex items-center justify-between">
            <h2 className="font-semibold text-[15px]">Provisioning summary — this month</h2>
            <Link href="/controllership" className="btn btn-primary">Open feed</Link>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-black/55 text-xs uppercase tracking-wider mb-1">Payable</div><div className="text-2xl font-bold num">{requests.filter(r => r.state === 'Executed').length}</div></div>
            <div><div className="text-black/55 text-xs uppercase tracking-wider mb-1">Provisional</div><div className="text-2xl font-bold num">{awaiting}</div></div>
            <div><div className="text-black/55 text-xs uppercase tracking-wider mb-1">Exceptions</div><div className="text-2xl font-bold num text-[#C42B1C]">{requests.filter(r => r.evidence === 'Mismatch').length}</div></div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: 'green' | 'amber' | 'purple' | 'grey' }) {
  const bg = tint === 'green' ? 'bg-[#E8F5EE]' : tint === 'amber' ? 'bg-[#FFF6E5]' : tint === 'purple' ? 'bg-[#F5E8F0]' : 'bg-black/5';
  return (
    <div className={`card p-4`}>
      <div className={`w-8 h-8 rounded-md ${bg} mb-3`} />
      <div className="text-3xl font-bold num text-[#1C161A]">{value}</div>
      <div className="text-xs text-black/55 mt-1">{label}</div>
    </div>
  );
}

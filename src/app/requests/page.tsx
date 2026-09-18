'use client';

import { useApp } from '@/lib/store';
import { personaById } from '@/lib/personas';
import { StateChip } from '@/components/Chip';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import React from 'react';

export default function RequestsPage() {
  const persona = useApp(s => personaById(s.currentPersona));
  const requests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const drafts = useApp(s => s.drafts);
  const discardDraft = useApp(s => s.discardDraft);
  const hubs = useApp(s => s.hubs);

  const vendorMap = new Map(vendors.map(v => [v.supplierNumber, v]));
  const hubMap = new Map(hubs.map(h => [h.code, h]));
  const mine = requests.filter(r => r.submittedBy === persona.name);
  const myDrafts = drafts.filter(d => d.submittedBy === persona.name);

  const inFlight = mine.filter(r => r.state === 'Pending' || r.state === 'Approved');
  const closed = mine.filter(r => r.state === 'Executed' || r.state === 'Rejected' || r.state === 'AutoClosed' || r.state === 'Superseded');

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">My requests</h1>

      {myDrafts.length > 0 && (
        <Section title="Drafts" hint="Not submitted yet — resume, update or discard">
          <DraftList drafts={myDrafts} hubMap={hubMap} vendorMap={vendorMap} onDiscard={discardDraft} />
        </Section>
      )}

      <Section title="In flight" hint="Awaiting approver decision or Legal handover">
        {inFlight.length === 0 ? <Empty>Nothing pending.</Empty> : <RequestList reqs={inFlight} vendorMap={vendorMap} />}
      </Section>

      <Section title="Closed">
        {closed.length === 0 ? <Empty>No closed items yet.</Empty> : <RequestList reqs={closed} vendorMap={vendorMap} />}
      </Section>
    </div>
  );
}

function DraftList({ drafts, hubMap, vendorMap, onDiscard }: {
  drafts: ReturnType<typeof useApp.getState>['drafts'];
  hubMap: Map<string, { code: string; name: string }>;
  vendorMap: Map<string, { name: string; supplierNumber: string }>;
  onDiscard: (id: string) => void;
}) {
  return (
    <table className="data" data-testid="drafts-table">
      <thead><tr><th>Draft ID</th><th>Hub</th><th>Partner</th><th>Type</th><th>Updated</th><th></th></tr></thead>
      <tbody>
        {drafts.map(d => {
          const hub = hubMap.get(d.hubCode);
          const v = d.vendorSupplierNumber ? vendorMap.get(d.vendorSupplierNumber) : undefined;
          return (
            <tr key={d.id}>
              <td className="mono text-[11.5px]">{d.id}</td>
              <td>{d.hubCode}{hub ? ` · ${hub.name}` : ''}</td>
              <td className="text-[12px]">{v ? <>{v.name} <span className="mono text-black/50">#{v.supplierNumber}</span></> : <span className="text-black/40">—</span>}</td>
              <td>{d.changeType}</td>
              <td className="num text-[11.5px]">{formatDistanceToNow(new Date(d.updatedAt))} ago</td>
              <td className="whitespace-nowrap">
                <Link
                  className="text-[#580A46] text-xs font-semibold mr-3"
                  href={`/submit?draft=${d.id}`}
                  data-testid={`edit-draft-${d.id}`}
                >
                  Edit →
                </Link>
                <button
                  type="button"
                  className="text-[#B00020] text-xs font-semibold"
                  onClick={() => { if (confirm('Discard this draft? This cannot be undone.')) onDiscard(d.id); }}
                  data-testid={`discard-draft-${d.id}`}
                >
                  Discard
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-6">
      <div className="p-4 border-b border-black/8">
        <h2 className="font-semibold text-[15px]">{title}</h2>
        {hint && <p className="text-xs text-black/55 mt-0.5">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="text-sm text-black/50 py-4">{children}</div>; }

function RequestList({ reqs, vendorMap }: { reqs: ReturnType<typeof useApp.getState>['requests']; vendorMap: Map<string, { name: string; supplierNumber: string }> }) {
  return (
    <table className="data">
      <thead><tr><th>ID</th><th>Hub</th><th>Partner</th><th>Type</th><th>State</th><th>Submitted</th><th></th></tr></thead>
      <tbody>
        {reqs.map(r => {
          const v = r.vendorSupplierNumber ? vendorMap.get(r.vendorSupplierNumber) : undefined;
          const lastRejection = r.rejections[r.rejections.length - 1];
          return (
            <React.Fragment key={r.id}>
              <tr>
                <td className="mono text-[11.5px]">{r.id}</td>
                <td>{r.hubCode}</td>
                <td className="text-[12px]">{v ? <>{v.name} <span className="mono text-black/50">#{v.supplierNumber}</span></> : <span className="text-black/40">—</span>}</td>
                <td>{r.changeType}</td>
                <td><StateChip state={r.state} /></td>
                <td className="num text-[11.5px]">{formatDistanceToNow(new Date(r.submittedAt))} ago</td>
                <td className="whitespace-nowrap">
                  {r.state === 'Rejected' && (
                    <Link
                      className="text-[#580A46] text-xs font-semibold mr-3"
                      href={`/submit?revise=${r.id}`}
                      data-testid={`revise-${r.id}`}
                    >
                      Revise & resubmit →
                    </Link>
                  )}
                  <Link className="text-[#580A46] text-xs font-semibold" href={`/lineage/${r.hubCode}`}>Lineage →</Link>
                </td>
              </tr>
              {r.state === 'Rejected' && lastRejection && (
                <tr className="bg-[#FFF3F5]">
                  <td colSpan={7} className="text-[11.5px] text-[#B00020] px-3 py-2">
                    <span className="font-semibold">Rejected:</span> “{lastRejection.reason}”
                    <span className="mono text-black/50 ml-2">— {lastRejection.by} · {format(new Date(lastRejection.at), 'PP')}</span>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}


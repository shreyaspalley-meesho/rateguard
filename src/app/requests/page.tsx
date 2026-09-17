'use client';

import { useApp } from '@/lib/store';
import { personaById } from '@/lib/personas';
import { StateChip, EvidenceChip } from '@/components/Chip';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import React, { useState } from 'react';

export default function RequestsPage() {
  const persona = useApp(s => personaById(s.currentPersona));
  const requests = useApp(s => s.requests);
  const vendors = useApp(s => s.vendors);
  const upload = useApp(s => s.uploadAddendum);
  const override = useApp(s => s.override);

  const vendorMap = new Map(vendors.map(v => [v.supplierNumber, v]));
  const mine = requests.filter(r => r.submittedBy === persona.name);

  const wantsFromYou = mine.filter(r =>
    (r.state === 'Approved' && r.evidence === 'Awaiting') ||
    (r.evidence === 'Mismatch')
  );
  const inFlight = mine.filter(r => r.state === 'Pending');
  const closed = mine.filter(r => r.state === 'Executed' || r.state === 'Rejected' || r.state === 'AutoClosed' || r.state === 'Superseded');

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">My requests</h1>

      <Section title="Wants something from you" hint="Upload addendum, respond to mismatch">
        {wantsFromYou.length === 0 ? <Empty>Nothing to action.</Empty> :
          <ul className="space-y-3">
            {wantsFromYou.map(r => <ActionRow key={r.id} r={r} onUpload={upload} onOverride={override} actor={persona.name} />)}
          </ul>
        }
      </Section>

      <Section title="In flight" hint="Awaiting approver decision">
        {inFlight.length === 0 ? <Empty>Nothing pending.</Empty> : <RequestList reqs={inFlight} vendorMap={vendorMap} />}
      </Section>

      <Section title="Closed">
        {closed.length === 0 ? <Empty>No closed items yet.</Empty> : <RequestList reqs={closed} vendorMap={vendorMap} />}
      </Section>
    </div>
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
      <thead><tr><th>ID</th><th>Hub</th><th>Partner</th><th>Type</th><th>State</th><th>Evidence</th><th>Submitted</th><th></th></tr></thead>
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
                <td><EvidenceChip evidence={r.evidence} /></td>
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
                  <td colSpan={8} className="text-[11.5px] text-[#B00020] px-3 py-2">
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

function ActionRow({ r, onUpload, onOverride, actor }: { r: ReturnType<typeof useApp.getState>['requests'][number]; onUpload: (id: string, url: string, v: 'Verified' | 'Mismatch') => void; onOverride: (id: string, actor: string, reason: string) => void; actor: string }) {
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState('');
  const [partner, setPartner] = useState('');
  const [city, setCity] = useState('');
  const hub = useApp(s => s.hubs.find(h => h.code === r.hubCode));

  const uploaded = !!r.agreementUrl;
  const mismatch = r.evidence === 'Mismatch';

  return (
    <li className="border border-black/8 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="mono text-[11.5px]">{r.id}</span>
          <span className="ml-3 text-sm font-semibold">{r.hubCode} · {r.changeType}</span>
        </div>
        <div className="flex gap-2"><StateChip state={r.state} /><EvidenceChip evidence={r.evidence} /></div>
      </div>

      {!uploaded && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          <input className="field-input" placeholder="Partner name" value={partner} onChange={e => setPartner(e.target.value)} />
          <input className="field-input" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
          <input className="field-input col-span-2" placeholder="Agreement URL (SpotDraft/PDF)" value={url} onChange={e => setUrl(e.target.value)} />
          <button
            className="btn btn-primary col-span-4"
            disabled={!url || !partner || !city}
            onClick={() => {
              const partnerOk = partner.trim().length > 0;
              const cityOk = hub ? city.toLowerCase().trim() === hub.city.toLowerCase() : false;
              const verified = partnerOk && cityOk;
              onUpload(r.id, url, verified ? 'Verified' : 'Mismatch');
              setUrl(''); setPartner(''); setCity('');
            }}
          >
            Upload & verify
          </button>
        </div>
      )}

      {mismatch && (
        <div className="mt-3 space-y-2">
          <div className="banner banner-red">Verification mismatch — override required to proceed.</div>
          <input className="field-input" placeholder="Written override reason (mandatory)" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="btn btn-danger" disabled={!reason} onClick={() => { onOverride(r.id, actor, reason); setReason(''); }}>
            Override & mark Executed
          </button>
        </div>
      )}
    </li>
  );
}

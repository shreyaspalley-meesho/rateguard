'use client';

import { useApp } from '@/lib/store';
import { StateChip } from '@/components/Chip';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tier } from '@/lib/types';

export default function LegalClient({ id }: { id: string }) {
  const requests = useApp(s => s.requests);
  const hubs = useApp(s => s.hubs);
  const vendors = useApp(s => s.vendors);
  const stamp = useApp(s => s.uploadAddendum);
  const router = useRouter();

  const req = requests.find(r => r.id === id);
  const hub = hubs.find(h => h.code === req?.hubCode);
  const vendor = req?.vendorSupplierNumber ? vendors.find(v => v.supplierNumber === req.vendorSupplierNumber) : undefined;

  const [spotDraftLink, setSpotDraftLink] = useState('');
  const [addendumIdInput, setAddendumIdInput] = useState('');
  const [copied, setCopied] = useState(false);

  const rateRows = useMemo(() => (req ? buildRateRows(req.tiers, req.clause?.touchpointRate) : []), [req]);

  if (!req || !hub) {
    return (
      <div className="max-w-3xl">
        <Link href="/legal" className="text-xs text-[#580A46] mono">← inbox</Link>
        <div className="card p-8 mt-4 text-sm text-black/60">Request not found.</div>
      </div>
    );
  }

  const alreadyStamped = req.state === 'Executed';

  function copyTableAsTsv() {
    const header = 'Shipment Slabs (in number of shipments)\tRate (in INR) (per shipment)';
    const body = rateRows.map(r => `${r.slabLabel}\t${r.rate}`).join('\n');
    const text = `${header}\n${body}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyTableAsHtml() {
    const rows = rateRows.map(r => `<tr><td>${r.slabLabel}</td><td>${r.rate}</td></tr>`).join('');
    const html = `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Shipment Slabs<br/>(in number of shipments)</th><th>Rate (in INR)<br/>(per shipment)</th></tr></thead><tbody>${rows}</tbody></table>`;
    void navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([rateRows.map(r => `${r.slabLabel}\t${r.rate}`).join('\n')], { type: 'text/plain' }),
      }),
    ]).catch(() => {
      // Fallback for browsers without rich clipboard — plain TSV.
      void navigator.clipboard.writeText(rateRows.map(r => `${r.slabLabel}\t${r.rate}`).join('\n'));
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function stampAgreement() {
    if (!spotDraftLink.trim()) return;
    // Verification is out of scope for this handover — Legal just attaches the SpotDraft URL
    // (and optionally the addendum ID) and marks the request Executed.
    stamp(req!.id, spotDraftLink.trim(), 'Verified', addendumIdInput.trim() || undefined);
    router.push('/legal');
  }

  return (
    <div className="max-w-4xl">
      <Link href="/legal" className="text-xs text-[#580A46] mono">← inbox</Link>

      <div className="flex items-baseline gap-3 mt-2">
        <h1 className="text-2xl font-bold mono">{req.id}</h1>
        <StateChip state={req.state} />
      </div>
      <p className="text-sm text-black/60 mb-6">
        Approved on {req.approvals[0] ? new Date(req.approvals[0].at).toLocaleDateString() : '—'} by {req.approvals[0]?.by ?? '—'} · effective {req.effectiveFrom}
      </p>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-sm mb-3">Deal reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Partner" value={vendor?.name ?? hub.owner ?? '—'} sub={vendor ? `#${vendor.supplierNumber}` : undefined} />
          <Field label="Hub" value={`${hub.code} · ${hub.name}`} />
          <Field label="City" value={hub.city} />
          <Field label="Oracle ID" value={hub.oracleId ?? '—'} />
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Rate schedule</h3>
            <p className="text-[11px] text-black/55 mt-0.5">Copy this into the SpotDraft agreement.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={copyTableAsHtml}
            data-testid="copy-rate-table"
          >
            {copied ? '✓ Copied' : 'Copy table'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black/25" data-testid="rate-schedule-table">
            <thead>
              <tr>
                <th className="border border-black/25 px-4 py-2 text-center text-[13px] font-semibold bg-[#FAFAFA]">
                  Shipment Slabs<br/><span className="text-[11px] font-normal">(in number of shipments)</span>
                </th>
                <th className="border border-black/25 px-4 py-2 text-center text-[13px] font-semibold bg-[#FAFAFA]">
                  Rate (in INR)<br/><span className="text-[11px] font-normal">(per shipment)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-black/25 px-4 py-2 text-center text-[13.5px]">{r.slabLabel}</td>
                  <td className="border border-black/25 px-4 py-2 text-center text-[13.5px] mono">{r.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="mt-3 text-[11px] text-[#580A46] underline"
          onClick={copyTableAsTsv}
        >
          Copy as tab-separated (for Excel)
        </button>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-sm mb-3">Attach agreement</h3>
        {alreadyStamped ? (
          <div className="banner banner-green">
            <div>
              <div className="font-semibold">Executed</div>
              <div className="text-xs mt-1">SpotDraft link on file: <span className="mono">{req.agreementUrl}</span></div>
              {req.addendumId && <div className="text-xs mt-1">Addendum: <span className="mono">{req.addendumId}</span></div>}
            </div>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-black/60 mb-3">
              Paste the SpotDraft URL once the agreement is drafted. Optional addendum ID stamps for audit.
            </p>
            <div className="space-y-3">
              <input
                className="field-input"
                placeholder="SpotDraft URL (e.g. https://app.spotdraft.com/agreement/SD-…)"
                value={spotDraftLink}
                onChange={e => setSpotDraftLink(e.target.value)}
                data-testid="spotdraft-input"
              />
              <input
                className="field-input"
                placeholder="Addendum ID (optional)"
                value={addendumIdInput}
                onChange={e => setAddendumIdInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!spotDraftLink.trim()}
                onClick={stampAgreement}
                data-testid="stamp-agreement-btn"
              >
                Mark executed & save link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-black/50 tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-semibold">{value}{sub && <span className="mono text-black/50 ml-1">{sub}</span>}</div>
    </div>
  );
}

/** Build slab labels matching the image format: "<2500 (Slab 1)", "2500-5,000 (Slab 2)", ..., ">12,500 (Slab N)". */
function buildRateRows(tiers: Tier[], touchpointRate?: number): { slabLabel: string; rate: string }[] {
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const rows: { slabLabel: string; rate: string }[] = tiers.map((t, i) => {
    let slab: string;
    if (i === 0) {
      slab = t.upTo === null ? `All shipments (Slab 1)` : `<${fmt(t.upTo)} (Slab 1)`;
    } else if (t.upTo === null) {
      const prev = tiers[i - 1].upTo;
      slab = prev !== null ? `>${fmt(prev)} (Slab ${i + 1})` : `Slab ${i + 1}`;
    } else {
      const prev = tiers[i - 1].upTo;
      slab = prev !== null ? `${fmt(prev + 1)}-${fmt(t.upTo)} (Slab ${i + 1})` : `≤${fmt(t.upTo)} (Slab ${i + 1})`;
    }
    return { slabLabel: slab, rate: t.rate.toFixed(2).replace(/\.00$/, '') };
  });
  if (touchpointRate !== undefined) {
    rows.push({ slabLabel: 'Touchpoint Rate', rate: String(touchpointRate) });
  }
  return rows;
}

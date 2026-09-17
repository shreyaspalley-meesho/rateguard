'use client';

import { useApp } from '@/lib/store';
import { EvidenceChip } from '@/components/Chip';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LegalClient({ id }: { id: string }) {
  const requests = useApp(s => s.requests);
  const hubs = useApp(s => s.hubs);
  const vendors = useApp(s => s.vendors);
  const req = requests.find(r => r.id === id);
  const hub = hubs.find(h => h.code === req?.hubCode);
  const vendor = req?.vendorSupplierNumber ? vendors.find(v => v.supplierNumber === req.vendorSupplierNumber) : undefined;
  const upload = useApp(s => s.uploadAddendum);
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [partner, setPartner] = useState('');
  const [city, setCity] = useState('');
  const [tierValues, setTierValues] = useState<string[]>(req?.tiers.map(() => '') ?? []);

  if (!req || !hub) return <div>Not found</div>;

  function verify() {
    if (!req || !hub) return;
    const expectedPartner = vendor?.name ?? hub.owner ?? '';
    const partnerOk = partner.trim().length > 0 && (!expectedPartner || partner.trim().toLowerCase() === expectedPartner.toLowerCase());
    const cityOk = city.trim().toLowerCase() === hub.city.toLowerCase();
    const tiersOk = req.tiers.every((t, i) => Number(tierValues[i]) === t.rate);
    const ok = partnerOk && cityOk && tiersOk;
    upload(req.id, url || 'spotdraft://uploaded', ok ? 'Verified' : 'Mismatch');
    router.push('/legal');
  }

  return (
    <div className="max-w-3xl">
      <Link href="/legal" className="text-xs text-[#580A46] mono">← inbox</Link>
      <h1 className="text-2xl font-bold mt-2 mono">{req.id}</h1>
      <p className="text-sm text-black/60 mb-6">Field-by-field match against the uploaded addendum.</p>

      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Expected (from approved request)</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-black/50">Partner:</span> <strong>{vendor?.name ?? hub.owner ?? 'Vendor A'}</strong>{vendor && <span className="mono text-black/50 ml-1">#{vendor.supplierNumber}</span>}</div>
          <div><span className="text-black/50">City:</span> <strong>{hub.city}</strong></div>
          <div><span className="text-black/50">Hub code:</span> <strong>{hub.code}</strong></div>
          <div><span className="text-black/50">Oracle ID:</span> <strong>{hub.oracleId}</strong></div>
        </div>
        <div className="mt-3">
          <div className="text-[11px] uppercase text-black/50 mb-1">Tiers (all must match)</div>
          {req.tiers.map((t, i) => <div key={i} className="mono text-sm">T{i + 1}: ₹{t.rate.toFixed(2)}</div>)}
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Paste addendum values</h3>
        <div className="space-y-3">
          <input className="field-input" placeholder="Agreement URL (SpotDraft)" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="field-input" placeholder="Partner name in addendum" value={partner} onChange={e => setPartner(e.target.value)} />
            <input className="field-input" placeholder="City in addendum" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            {req.tiers.map((t, i) => (
              <input key={i} type="number" step="0.01" className="field-input num" placeholder={`Tier ${i + 1} rate as printed`} value={tierValues[i]} onChange={e => setTierValues(tierValues.map((v, ii) => ii === i ? e.target.value : v))} />
            ))}
          </div>
        </div>
        <button className="btn btn-primary mt-4" onClick={verify}>Run verification</button>
      </div>

      <div className="text-xs text-black/50">Current state: <EvidenceChip evidence={req.evidence} /></div>
    </div>
  );
}

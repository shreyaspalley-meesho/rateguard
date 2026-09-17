'use client';

import { useApp, useCurrentGuardrail } from '@/lib/store';
import { useState } from 'react';
import type { GuardrailVersion } from '@/lib/types';

export default function Guardrails() {
  const guardrails = useApp(s => s.guardrails);
  const live = useCurrentGuardrail();
  const publish = useApp(s => s.publishGuardrail);
  const advance = useApp(s => s.advanceClock);
  const reseed = useApp(s => s.reseed);

  const [newVer, setNewVer] = useState('v13');
  const [draftText, setDraftText] = useState(JSON.stringify(live.ceilings, null, 2));

  function tryPublish() {
    try {
      const ceilings = JSON.parse(draftText);
      const gv: GuardrailVersion = {
        version: newVer,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        ceilings,
        state: 'Live',
      };
      publish(gv);
      alert(`Guardrail ${newVer} published. Previous v${live.version} superseded.`);
    } catch {
      alert('Invalid JSON');
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Guardrail refresh</h1>
      <p className="text-sm text-black/60 mb-6">Publish a new BizFin ceiling set. Pending requests keep their pinned version.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-[10px] uppercase text-black/50 mb-1">Live</div>
          <div className="text-2xl font-bold mono">{live.version}</div>
          <div className="text-xs text-black/60 mt-1">Effective {live.effectiveFrom} · {live.ceilings.length} rows</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase text-black/50 mb-1">History</div>
          <div className="text-sm mono">{guardrails.map(g => g.version).join(', ')}</div>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <h3 className="font-semibold text-sm mb-3">Draft next version</h3>
        <div className="grid grid-cols-[140px_1fr] gap-3 mb-3">
          <input className="field-input mono" value={newVer} onChange={e => setNewVer(e.target.value)} />
          <div className="text-xs text-black/50 self-center">Ceilings JSON (edit and publish)</div>
        </div>
        <textarea rows={12} className="field-input mono text-[11px]" value={draftText} onChange={e => setDraftText(e.target.value)} />
        <button className="btn btn-primary mt-3" onClick={tryPublish}>Publish new guardrail</button>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3">Dev controls</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost" onClick={() => advance(8)}>Simulate: advance clock 8 days</button>
          <button className="btn btn-ghost" onClick={() => advance(14)}>Simulate: advance 14 days (TTL lapse)</button>
          <button className="btn btn-danger" onClick={() => { if (confirm('Reset all demo data?')) reseed(); }}>Reset demo data</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useApp } from '@/lib/store';
import { useState } from 'react';

export default function Delegation() {
  const delegations = useApp(s => s.delegations);
  const add = useApp(s => s.addDelegation);
  const [role, setRole] = useState('');
  const [primary, setPrimary] = useState('');
  const [backup, setBackup] = useState('');

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Approver delegation</h1>
      <div className="card overflow-hidden mb-6">
        <table className="data">
          <thead><tr><th>Role</th><th>Primary</th><th>Backup</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {delegations.map((d, i) => (
              <tr key={i}>
                <td>{d.role}</td>
                <td>{d.primary}</td>
                <td>{d.backup}</td>
                <td className="mono text-[11.5px]">{d.from}</td>
                <td className="mono text-[11.5px]">{d.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3">Add delegation</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input className="field-input" placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
          <input className="field-input" placeholder="Primary" value={primary} onChange={e => setPrimary(e.target.value)} />
          <input className="field-input" placeholder="Backup" value={backup} onChange={e => setBackup(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={!role || !primary || !backup} onClick={() => {
          add({ role, primary, backup, from: new Date().toISOString().slice(0, 10), to: `${new Date().getFullYear()}-12-31` });
          setRole(''); setPrimary(''); setBackup('');
        }}>Add</button>
      </div>
    </div>
  );
}

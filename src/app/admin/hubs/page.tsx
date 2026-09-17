'use client';

import { useApp } from '@/lib/store';

export default function AdminHubs() {
  const hubs = useApp(s => s.hubs);
  const setActive = useApp(s => s.setHubActive);
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Hubs · Oracle mapping</h1>
      <div className="card overflow-hidden">
        <table className="data">
          <thead><tr><th>Code</th><th>Name</th><th>City</th><th>Type</th><th>Oracle</th><th>Owner</th><th>Zone</th><th>Active</th></tr></thead>
          <tbody>
            {hubs.map(h => (
              <tr key={h.code}>
                <td className="mono">{h.code}</td>
                <td>{h.name}</td>
                <td>{h.city}</td>
                <td>{h.hubType}</td>
                <td className="mono text-[11.5px]">{h.oracleId ?? <span className="text-[#C42B1C]">unmapped</span>}</td>
                <td>{h.owner ?? <span className="text-[#C42B1C]">—</span>}</td>
                <td>{h.zone}</td>
                <td>
                  <button className="text-xs text-[#580A46] font-semibold" onClick={() => setActive(h.code, !h.active)}>
                    {h.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

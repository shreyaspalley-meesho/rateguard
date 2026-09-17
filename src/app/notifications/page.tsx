'use client';

import { useApp } from '@/lib/store';
import { format } from 'date-fns';
import Link from 'next/link';

export default function NotificationsPage() {
  const persona = useApp(s => s.currentPersona);
  const notifications = useApp(s => s.notifications);
  const mark = useApp(s => s.markNotificationRead);

  const mine = notifications.filter(n => n.toPersona === 'all' || n.toPersona === persona);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>
      {mine.length === 0 ? <div className="card p-8 text-center text-black/50">No notifications yet.</div> : (
        <ul className="space-y-2">
          {mine.map(n => (
            <li key={n.id} className={`card p-4 ${!n.read ? 'border-l-4 border-l-[#580A46]' : ''}`}>
              <div className="flex items-baseline justify-between">
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-[11px] text-black/50 mono">{format(new Date(n.at), 'PPp')}</div>
              </div>
              <div className="text-[13px] text-black/70 mt-1">{n.body}</div>
              <div className="mt-2 flex gap-3">
                {n.requestId && <Link href={`/approvals/${n.requestId}`} className="text-xs text-[#580A46] font-semibold">Open request →</Link>}
                {!n.read && <button className="text-xs text-black/50" onClick={() => mark(n.id)}>Mark read</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

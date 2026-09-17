'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { PERSONAS, personaById } from '@/lib/personas';
import type { PersonaId } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useIsMobile } from '@/lib/useMediaQuery';

interface NavItem { href: string; label: string; roles?: PersonaId[]; }

const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/submit', label: 'Submit rate', roles: ['fm-cluster', 'sc-biz'] },
  { href: '/requests', label: 'My requests', roles: ['fm-cluster', 'sc-biz'] },
  { href: '/approvals', label: 'Approvals queue', roles: ['ops-fm', 'ops-sc', 'bizfin'] },
  { href: '/legal', label: 'Legal inbox', roles: ['legal'] },
  { href: '/controllership', label: 'Controllership', roles: ['controllership', 'admin'] },
  { href: '/lineage', label: 'Rate lineage' },
  { href: '/admin/guardrails', label: 'Guardrails', roles: ['bizfin', 'admin'] },
  { href: '/admin/delegation', label: 'Delegation', roles: ['admin'] },
  { href: '/admin/hubs', label: 'Hubs', roles: ['admin'] },
  { href: '/notifications', label: 'Notifications' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const currentPersona = useApp(s => s.currentPersona);
  const setPersona = useApp(s => s.setPersona);
  const notifications = useApp(s => s.notifications);
  const unread = notifications.filter(n => !n.read && (n.toPersona === 'all' || n.toPersona === currentPersona)).length;
  const persona = personaById(currentPersona);
  const pathname = usePathname();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  const isMobile = useIsMobile();

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(currentPersona));

  const navContent = (
    <nav className="flex-1 p-2 overflow-auto">
      {visibleNav.map(item => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}
            className={`block px-3 py-2 rounded-md text-[13px] mb-0.5 ${active ? 'bg-[#F5E8F0] text-[#580A46] font-semibold' : 'text-black/70 hover:bg-black/5'}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-black/8 flex-col">
        <div className="p-4 border-b border-black/8 flex items-center gap-2">
          <Image src="/meesho-logo.png" alt="Meesho" width={24} height={24} />
          <div>
            <div className="font-bold text-sm">RateGuard</div>
            <div className="text-[10px] text-black/50 mono">FM · SC v1</div>
          </div>
        </div>
        {navContent}
        <div className="p-3 border-t border-black/8 text-[11px] text-black/50">
          Prototype · Data in browser
        </div>
      </aside>

      {/* Mobile drawer */}
      {hydrated && isMobile && drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="relative w-64 bg-white flex flex-col border-r border-black/8" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-black/8 flex items-center gap-2">
              <Image src="/meesho-logo.png" alt="Meesho" width={24} height={24} />
              <div>
                <div className="font-bold text-sm">RateGuard</div>
                <div className="text-[10px] text-black/50 mono">FM · SC v1</div>
              </div>
              <button className="ml-auto text-black/60 text-xl" onClick={() => setDrawerOpen(false)} aria-label="Close menu">×</button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-black/8 h-14 flex items-center justify-between px-3 md:px-5 gap-2 md:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden w-10 h-10 flex items-center justify-center text-black/70 -ml-2"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <span className="text-xl leading-none">☰</span>
            </button>
            <div className="text-[13px] font-semibold text-black/70 truncate">{visibleNav.find(v => pathname === v.href)?.label ?? 'RateGuard'}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <form
              className="hidden md:flex items-center gap-1.5 px-2.5 h-8 w-72 bg-black/[.04] rounded-md border border-transparent focus-within:border-[#580A46]/30 focus-within:bg-white"
              onSubmit={e => { e.preventDefault(); const q = searchTerm.trim(); router.push(q ? `/lineage?q=${encodeURIComponent(q)}` : '/lineage'); }}
            >
              <span className="text-black/40 mono text-xs">⌕</span>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search hubs, Oracle ID, vendor…"
                className="flex-1 bg-transparent outline-none text-[12px]"
                aria-label="Global search"
              />
            </form>
            <Link href="/notifications" className="relative text-black/60 hover:text-[#580A46] text-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
              <span aria-label="notifications">🔔</span>
              {hydrated && unread > 0 && (
                <span className="absolute top-1 right-0 bg-[#FF9D00] text-[10px] text-[#1C161A] rounded-full min-w-4 h-4 px-1 font-bold flex items-center justify-center">{unread}</span>
              )}
            </Link>
            <select
              value={currentPersona}
              onChange={e => setPersona(e.target.value as PersonaId)}
              className="field-input !py-1.5 !pr-8 !text-[12px] max-w-[140px] md:max-w-[240px]"
            >
              {PERSONAS.map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
              ))}
            </select>
            <div className="hidden sm:flex w-8 h-8 rounded-full bg-[#580A46] text-white items-center justify-center font-bold text-xs">
              {persona.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

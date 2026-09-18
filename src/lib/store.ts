'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Hub, GuardrailVersion, RateRequest, Notification, DraftRequest,
  DelegationRow, PersonaId, Vendor, SavedDraft,
} from './types';
import { SEED_HUBS, SEED_GUARDRAILS, SEED_REQUESTS, SEED_DELEGATIONS, SEED_VENDORS } from './seed';
import { evaluate, buildRequestId, nextSeq } from './guardrail';
import { personaById } from './personas';

interface AppState {
  currentPersona: PersonaId;
  hubs: Hub[];
  guardrails: GuardrailVersion[];
  requests: RateRequest[];
  notifications: Notification[];
  delegations: DelegationRow[];
  vendors: Vendor[];
  drafts: SavedDraft[];
  clockOffsetDays: number;

  setPersona(id: PersonaId): void;
  submitRequest(draft: DraftRequest): RateRequest;
  saveDraft(draft: DraftRequest, id?: string): SavedDraft;
  discardDraft(id: string): void;
  revise(id: string, draft: DraftRequest, reason?: string): RateRequest;
  withdraw(id: string, reason: string): void;
  approve(id: string, actor: string, role: string, reason?: string): void;
  reject(id: string, actor: string, reason: string): void;
  uploadAddendum(id: string, agreementUrl: string, verification?: 'Verified' | 'Mismatch', addendumId?: string): void;
  override(id: string, actor: string, reason: string): void;
  publishGuardrail(v: GuardrailVersion): void;
  advanceClock(days: number): void;
  markNotificationRead(id: string): void;
  reseed(): void;
  addDelegation(row: DelegationRow): void;
  setHubActive(code: string, active: boolean): void;
}

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10);

function currentGuardrail(gs: GuardrailVersion[]): GuardrailVersion {
  return gs.find(g => g.state === 'Live') ?? gs[0];
}

function pushNotif(state: AppState, to: PersonaId | 'all', title: string, body: string, requestId?: string) {
  state.notifications.unshift({
    id: rid(), at: now(), toPersona: to, title, body, requestId, read: false,
  });
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      currentPersona: 'fm-cluster',
      hubs: SEED_HUBS,
      guardrails: SEED_GUARDRAILS,
      requests: SEED_REQUESTS,
      notifications: [],
      delegations: SEED_DELEGATIONS,
      vendors: SEED_VENDORS,
      drafts: [],
      clockOffsetDays: 0,

      setPersona: (id) => set({ currentPersona: id }),

      saveDraft: (draft, existingId) => {
        const state = get();
        const persona = personaById(state.currentPersona);
        const nowIso = now();
        if (existingId) {
          const found = state.drafts.find(d => d.id === existingId);
          if (found) {
            const updated: SavedDraft = { ...found, ...draft, updatedAt: nowIso };
            set({ drafts: state.drafts.map(d => d.id === existingId ? updated : d) });
            return updated;
          }
        }
        const created: SavedDraft = {
          ...draft,
          id: `DRAFT-${rid().toUpperCase()}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          submittedBy: persona.name,
        };
        set({ drafts: [created, ...state.drafts] });
        return created;
      },

      discardDraft: (id) => {
        set({ drafts: get().drafts.filter(d => d.id !== id) });
      },

      submitRequest: (draft) => {
        const state = get();
        const hub = state.hubs.find(h => h.code === draft.hubCode);
        if (!hub) throw new Error('Hub not found');
        const gv = currentGuardrail(state.guardrails);
        const verdict = evaluate(gv, hub, draft.changeType, draft.tiers, hub.segment, draft.submittedHubType, draft.clause);
        const seqDate = draft.effectiveFrom || now();
        const d = new Date(seqDate);
        const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        const seq = nextSeq(state.requests.map(r => r.id), hub.code, yyyymm);
        const id = buildRequestId(hub.segment, hub.code, seqDate, seq);
        const persona = personaById(state.currentPersona);
        const req: RateRequest = {
          id,
          revision: 1,
          revisions: [],
          hubCode: draft.hubCode,
          submittedHubType: draft.submittedHubType,
          changeType: draft.changeType,
          tiers: draft.tiers,
          clause: draft.clause, incentive: draft.incentive,
          effectiveFrom: draft.effectiveFrom, negotiatedOn: draft.negotiatedOn,
          submittedBy: persona.name, submittedAt: now(),
          vendorSupplierNumber: draft.vendorSupplierNumber,
          guardrailVersion: gv.version, route: verdict.route, ttlDays: 14,
          state: 'Pending', evidence: 'NotNeeded',
          approvals: [], rejections: [], remarks: draft.remarks,
          events: [{ at: now(), actor: persona.name, kind: 'Submitted', note: verdict.reason }],
        };
        const target: PersonaId = verdict.route === 'BizFin' ? 'bizfin' : verdict.route === 'OpsHead-FM' ? 'ops-fm' : 'ops-sc';
        const draftState = { ...state, requests: [req, ...state.requests] } as AppState;
        pushNotif(draftState, target, 'New request awaiting your decision', `${id} · ${hub.name} · ${draft.changeType}`, id);
        set({ requests: draftState.requests, notifications: draftState.notifications });
        return req;
      },

      revise: (id, draft, reason) => {
        const state = get();
        const original = state.requests.find(r => r.id === id);
        if (!original) throw new Error(`Request ${id} not found`);
        const hub = state.hubs.find(h => h.code === draft.hubCode);
        if (!hub) throw new Error('Hub not found');
        const gv = currentGuardrail(state.guardrails);
        const verdict = evaluate(gv, hub, draft.changeType, draft.tiers, hub.segment, draft.submittedHubType, draft.clause);
        const persona = personaById(state.currentPersona);
        // Snapshot the OLD revision (pre-revise) into the chain before we overwrite.
        const priorSnapshot: import('./types').Revision = {
          revision: original.revision,
          at: original.submittedAt,
          tiers: original.tiers,
          clause: original.clause,
          effectiveFrom: original.effectiveFrom,
          remarks: original.remarks,
          submittedBy: original.submittedBy,
          guardrailVersion: original.guardrailVersion,
          route: original.route,
          reason,
        };
        const nextRev = original.revision + 1;
        const updated: RateRequest = {
          ...original,
          revision: nextRev,
          revisions: [...original.revisions, priorSnapshot],
          submittedHubType: draft.submittedHubType,
          changeType: draft.changeType,
          tiers: draft.tiers,
          clause: draft.clause,
          incentive: draft.incentive,
          effectiveFrom: draft.effectiveFrom,
          negotiatedOn: draft.negotiatedOn,
          submittedBy: persona.name,
          submittedAt: now(),
          vendorSupplierNumber: draft.vendorSupplierNumber,
          guardrailVersion: gv.version,
          route: verdict.route,
          state: 'Pending',
          evidence: 'NotNeeded',
          approvals: [],
          remarks: draft.remarks,
          events: [
            ...original.events,
            { at: now(), actor: persona.name, kind: 'Revised', note: `r${original.revision} → r${nextRev}${reason ? ` · ${reason}` : ''} · ${verdict.reason}` },
          ],
        };
        const reqs = state.requests.map(r => r.id === id ? updated : r);
        const target: PersonaId = verdict.route === 'BizFin' ? 'bizfin' : verdict.route === 'OpsHead-FM' ? 'ops-fm' : 'ops-sc';
        const notes = [...state.notifications];
        notes.unshift({ id: rid(), at: now(), toPersona: target, title: 'Revised request awaiting your decision', body: `${id} · r${nextRev} · ${hub.name}`, requestId: id, read: false });
        set({ requests: reqs, notifications: notes });
        return updated;
      },

      withdraw: (id, reason) => {
        const state = get();
        const persona = personaById(state.currentPersona);
        const reqs = state.requests.map(r => {
          if (r.id !== id) return r;
          const events = [...r.events, { at: now(), actor: persona.name, kind: 'Withdrawn', note: reason }];
          return { ...r, state: 'Withdrawn' as const, events };
        });
        set({ requests: reqs });
      },

      approve: (id, actor, role, reason) => {
        const state = get();
        const reqs = state.requests.map(r => {
          if (r.id !== id) return r;
          const events = [...r.events, { at: now(), actor, kind: 'Approved', note: reason }];
          return { ...r, state: 'Approved' as const, evidence: 'Awaiting' as const, approvals: [...r.approvals, { by: actor, role, at: now(), reason }], events };
        });
        const notes = [...state.notifications];
        const req = reqs.find(r => r.id === id);
        if (req) notes.unshift({ id: rid(), at: now(), toPersona: 'legal', title: 'Legal handover packet ready', body: `${id} approved. Upload addendum for verification.`, requestId: id, read: false });
        set({ requests: reqs, notifications: notes });
      },

      reject: (id, actor, reason) => {
        const state = get();
        const target = state.requests.find(r => r.id === id);
        const hub = target ? state.hubs.find(h => h.code === target.hubCode) : undefined;
        // Route the rejection notice back to the segment that owns the hub (FM vs SC),
        // otherwise the wrong submitter persona sees cross-segment notifications.
        const submitter: PersonaId = hub?.segment === 'SC' ? 'sc-biz' : 'fm-cluster';
        const reqs = state.requests.map(r => {
          if (r.id !== id) return r;
          const events = [...r.events, { at: now(), actor, kind: 'Rejected', note: reason }];
          return { ...r, state: 'Rejected' as const, rejections: [...r.rejections, { by: actor, at: now(), reason }], events };
        });
        const notes = [...state.notifications];
        notes.unshift({ id: rid(), at: now(), toPersona: submitter, title: 'Request rejected', body: `${id}: ${reason}`, requestId: id, read: false });
        set({ requests: reqs, notifications: notes });
      },

      // Legal attaches the SpotDraft link (and optionally a specific Addendum ID) —
      // the request is marked Executed. Verification/mismatch axis is no longer surfaced.
      uploadAddendum: (id, agreementUrl, _verification, addendumIdOverride) => {
        void _verification;
        const state = get();
        const reqs = state.requests.map(r => {
          if (r.id !== id) return r;
          const addendumId = addendumIdOverride || r.addendumId || `ADD-${new Date().getFullYear()}-${rid().slice(0, 5).toUpperCase()}`;
          const events = [...r.events, { at: now(), actor: 'Legal', kind: 'AgreementAttached', note: `SpotDraft link stamped; addendum ${addendumId}` }];
          return { ...r, state: 'Executed' as const, evidence: 'Verified' as const, addendumId, agreementUrl, events };
        });
        set({ requests: reqs });
      },

      override: (id, actor, reason) => {
        const state = get();
        const reqs = state.requests.map(r => {
          if (r.id !== id) return r;
          const events = [...r.events, { at: now(), actor, kind: 'Override', note: reason }];
          return { ...r, state: 'Executed' as const, evidence: 'Overridden' as const, overrideReason: reason, events };
        });
        set({ requests: reqs });
      },

      publishGuardrail: (v) => {
        const state = get();
        const gs = state.guardrails.map(g => g.state === 'Live' ? { ...g, state: 'Superseded' as const } : g);
        set({ guardrails: [...gs, { ...v, state: 'Live' }] });
      },

      advanceClock: (days) => {
        const state = get();
        const newOffset = state.clockOffsetDays + days;
        const cutoff = Date.now() + newOffset * 86400000;
        const reqs = state.requests.map(r => {
          if (r.state !== 'Pending') return r;
          const submittedMs = new Date(r.submittedAt).getTime();
          if ((cutoff - submittedMs) / 86400000 >= r.ttlDays) {
            return { ...r, state: 'AutoClosed' as const, events: [...r.events, { at: now(), actor: 'System', kind: 'AutoClosed', note: `TTL of ${r.ttlDays} days lapsed (simulated clock)` }] };
          }
          return r;
        });
        set({ clockOffsetDays: newOffset, requests: reqs });
      },

      markNotificationRead: (id) => {
        set({ notifications: get().notifications.map(n => n.id === id ? { ...n, read: true } : n) });
      },

      reseed: () => {
        set({
          hubs: SEED_HUBS, guardrails: SEED_GUARDRAILS, requests: SEED_REQUESTS,
          notifications: [], delegations: SEED_DELEGATIONS, vendors: SEED_VENDORS, drafts: [], clockOffsetDays: 0,
        });
      },

      addDelegation: (row) => set({ delegations: [...get().delegations, row] }),

      setHubActive: (code, active) => set({ hubs: get().hubs.map(h => h.code === code ? { ...h, active } : h) }),
    }),
    {
      name: 'rateguard-store',
      version: 3,
      // v1 → v2: backfill `revision` and `revisions` on any persisted requests (FR-23).
      // v2 → v3: seed the drafts array so older sessions can save/discard drafts.
      migrate: (persisted, fromVersion) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p) return p as unknown as AppState;
        if (fromVersion < 2 && Array.isArray(p.requests)) {
          p.requests = p.requests.map(r => ({
            ...r,
            revision: (r as RateRequest).revision ?? 1,
            revisions: (r as RateRequest).revisions ?? [],
          }));
        }
        if (fromVersion < 3 && !Array.isArray(p.drafts)) {
          p.drafts = [];
        }
        return p as AppState;
      },
    }
  )
);

export function useCurrentGuardrail(): GuardrailVersion {
  return useApp(s => s.guardrails.find(g => g.state === 'Live') ?? s.guardrails[0]);
}

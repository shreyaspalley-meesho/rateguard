import type { RequestState, EvidenceState } from '@/lib/types';

const STATE_CLASS: Record<RequestState, string> = {
  Draft: 'chip-outline-grey',
  Pending: 'chip-filled-purple',
  Approved: 'chip-filled-green',
  Executed: 'chip-filled-green',
  Superseded: 'chip-filled-grey',
  Rejected: 'chip-filled-red',
  AutoClosed: 'chip-filled-grey',
  Withdrawn: 'chip-filled-grey',
};

const EVIDENCE_CLASS: Record<EvidenceState, string> = {
  NotNeeded: 'chip-outline-grey',
  Awaiting: 'chip-outline-amber',
  Verified: 'chip-outline-green',
  Mismatch: 'chip-outline-red',
  Overridden: 'chip-outline-purple',
};

const EVIDENCE_LABEL: Record<EvidenceState, string> = {
  NotNeeded: 'Not needed',
  Awaiting: 'Awaiting',
  Verified: 'Verified',
  Mismatch: 'Mismatch',
  Overridden: 'Overridden',
};

export function StateChip({ state }: { state: RequestState }) {
  return <span className={`chip ${STATE_CLASS[state]}`}>{state === 'AutoClosed' ? 'Auto-Closed' : state}</span>;
}

export function EvidenceChip({ evidence }: { evidence: EvidenceState }) {
  return <span className={`chip ${EVIDENCE_CLASS[evidence]}`}>{EVIDENCE_LABEL[evidence]}</span>;
}

export function Chip({ children, tone = 'grey', variant = 'outline' }: { children: React.ReactNode; tone?: 'green' | 'red' | 'amber' | 'purple' | 'grey'; variant?: 'filled' | 'outline' }) {
  return <span className={`chip chip-${variant}-${tone}`}>{children}</span>;
}

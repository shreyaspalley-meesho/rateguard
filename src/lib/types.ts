/**
 * KRD §1.1 / §2.1 — canonical rate-change types.
 *  - FM-OLD / FM-NEW: slabbed FM rate cards (5 / 6 tiers).
 *  - FM-FMCP: flat FMCP consolidation rates.
 *  - SC-SLAB: SC vendor-defined slab structure (KRD §2.1.1) — up to 10 slabs — used for FMSC / LMSC / GW.
 *  - SC-CD: SC CrossDock flat rate (KRD §2.1.2) — single ₹/bag rate.
 */
export type ChangeType = 'FM-OLD' | 'FM-NEW' | 'FM-FMCP' | 'SC-SLAB' | 'SC-CD';
/** KRD §1.0 — the five canonical FM hub types. SC hubs use `scSubTypes` instead. */
export type HubType = 'Standalone' | 'Mall Hub' | 'Mini Hub' | 'Seller Led Hub' | 'FMCP' | 'LM-as-FM';
export type ScSubType = 'FMSC' | 'LMSC' | 'CD' | 'GW';
export type HubStatus =
  | 'GoLivePending'
  | 'LiveAgreementPending'
  | 'LiveAgreementExecuted'
  | 'PendingDeactivation'
  | 'Deactivated';
export type RequestState = 'Draft' | 'Pending' | 'Approved' | 'Executed' | 'Superseded' | 'Rejected' | 'AutoClosed' | 'Withdrawn';
export type EvidenceState = 'NotNeeded' | 'Awaiting' | 'Verified' | 'Mismatch' | 'Overridden';
export type Segment = 'FM' | 'SC';
export type ApprovalRoute = 'OpsHead-FM' | 'OpsHead-SC' | 'BizFin';

export type PersonaId =
  | 'fm-cluster'
  | 'sc-biz'
  | 'ops-fm'
  | 'ops-sc'
  | 'bizfin'
  | 'controllership'
  | 'legal'
  | 'admin'
  | 'zonal';

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  email: string;
}

export interface Hub {
  code: string;
  name: string;
  city: string;
  /** Required on FM segment hubs (KRD §1.0). SC hubs leave this undefined and use `scSubTypes`. */
  hubType?: HubType;
  segment: Segment;
  oracleId?: string;
  owner?: string;
  zone: string;
  active: boolean;
  excludedReason?: string;
  /** SC hub sub-types per KRD §2.0. Empty for FM hubs. */
  scSubTypes?: ScSubType[];
  /** Hub lifecycle status per KRD §1.2.13 / §2.2.14. */
  status?: HubStatus;
}

export interface Vendor {
  supplierNumber: string;
  name: string;
  city: string;
  state: string;
}

export interface CeilingRow {
  hubType: HubType;
  city?: string;
  type: ChangeType;
  tiers: number[];
}

export interface TouchpointCeilingRow {
  hubType: HubType;
  city?: string;
  ceiling: number;
}

export interface GuardrailVersion {
  version: string;
  effectiveFrom: string;
  ceilings: CeilingRow[];
  /** KRD §1.1.3 — per-shipment touchpoint ceilings. Optional; older versions may lack this. */
  touchpoints?: TouchpointCeilingRow[];
  state: 'Draft' | 'Approved' | 'Live' | 'Superseded';
}

export interface Clause {
  mg?: number;
  mgTrigger?: string;
  lockInMonths?: number;
  /** KRD §2.1.3.c — MG payable through notice-period on offboarding. */
  noticePeriodMonths?: number;
  /** KRD §1.1.3 — flat rate applied per unique supplier an FE visits/day. */
  touchpointRate?: number;
  touchpointBasis?: string;
  /** KRD §2.1.2 — flat ₹/bag rate for a CrossDock leg (paired with FMSC/LMSC) or a standalone SC-CD submission. */
  crossDockBagRate?: number;
  /** KRD §1.1.2 — FMCP flat rates. */
  fwdRate?: number;
  revRate?: number;
  bagRate?: number;
  /** Free-text field per KRD §2.1.7. */
  freeText?: string;
}

export interface Incentive {
  base: number;
  incremental: number;
  period: 'Day' | 'Week' | 'Month' | 'Custom';
  start: string;
  end: string;
}

export interface Tier {
  upTo: number | null;
  rate: number;
}

export interface EventEntry {
  at: string;
  actor: string;
  kind: string;
  note?: string;
}

export interface RequestApproval {
  by: string;
  role: string;
  at: string;
  reason?: string;
}

export interface RequestRejection {
  by: string;
  at: string;
  reason: string;
}

export interface Revision {
  revision: number;
  at: string;
  tiers: Tier[];
  clause?: Clause;
  effectiveFrom: string;
  remarks: string;
  submittedBy: string;
  guardrailVersion: string;
  route: ApprovalRoute;
  reason?: string;
}

export interface RateRequest {
  id: string;
  addendumId?: string;
  /** FR-23 — 1-indexed revision counter. r1 is the original submission. */
  revision: number;
  /** FR-23 — historical snapshots of prior revisions (before the current one). */
  revisions: Revision[];
  hubCode: string;
  /** KRD §II.3.6 — hub type is unreliable in the mapping file; submitter explicitly confirms it at submit time. */
  submittedHubType?: HubType;
  changeType: ChangeType;
  tiers: Tier[];
  clause?: Clause;
  incentive?: Incentive;
  effectiveFrom: string;
  negotiatedOn: string;
  contractExecutionDate?: string;
  submittedBy: string;
  submittedAt: string;
  vendorSupplierNumber?: string;
  guardrailVersion: string;
  route: ApprovalRoute;
  ttlDays: number;
  state: RequestState;
  evidence: EvidenceState;
  approvals: RequestApproval[];
  rejections: RequestRejection[];
  remarks: string;
  supersededBy?: string;
  supersedes?: string;
  agreementUrl?: string;
  overrideReason?: string;
  events: EventEntry[];
}

export interface Notification {
  id: string;
  at: string;
  toPersona: PersonaId | 'all';
  title: string;
  body: string;
  requestId?: string;
  read: boolean;
}

export interface DraftRequest {
  hubCode: string;
  /** Explicit submitter-confirmed hub type (KRD §II.3.6). Overrides the mapping-file value. */
  submittedHubType?: HubType;
  changeType: ChangeType;
  tiers: Tier[];
  clause?: Clause;
  incentive?: Incentive;
  effectiveFrom: string;
  negotiatedOn: string;
  vendorSupplierNumber?: string;
  remarks: string;
  /** FR-24 — mandatory per-tier explanations when abnormal-rate band flags a value. */
  abnormalReasons?: Record<number, string>;
}

export interface DelegationRow {
  role: string;
  primary: string;
  backup: string;
  from: string;
  to: string;
}

import type { Hub, GuardrailVersion, RateRequest, DelegationRow, Vendor, CeilingRow, TouchpointCeilingRow } from './types';
import vendorsData from './vendors.json';
import guardrailV12 from './guardrail-v12.json';

export const SEED_VENDORS: Vendor[] = vendorsData as Vendor[];

export const SEED_HUBS: Hub[] = [
  { code: 'SSY', name: 'Surat SSY', city: 'Surat', hubType: 'Standalone', segment: 'FM', oracleId: 'OR34112', owner: 'Ramesh Kumar', zone: 'West', active: true, status: 'LiveAgreementExecuted' },
  // Whitefield/Koramangala are Bengaluru localities — sheet uses 'Bengaluru' as canonical.
  { code: 'HUB14', name: 'Hub 14 Whitefield', city: 'Bengaluru', hubType: 'Standalone', segment: 'FM', oracleId: 'OR48213', owner: 'Ramesh Kumar', zone: 'South', active: true, status: 'LiveAgreementPending' },
  { code: 'HUB9', name: 'Hub 9 Koramangala', city: 'Bengaluru', hubType: 'Standalone', segment: 'FM', oracleId: 'OR55021', owner: 'Ajay Singh', zone: 'South', active: true, status: 'LiveAgreementExecuted' },
  // Sheet uses 'Mysore' spelling (KRD §II.3.6 flagged spelling variants).
  { code: 'HUB47', name: 'Hub 47 Mysore', city: 'Mysore', hubType: 'Mini Hub', segment: 'FM', oracleId: 'OR62305', owner: 'Neha Joshi', zone: 'South', active: true, status: 'LiveAgreementExecuted' },
  { code: 'BLR7', name: 'BLR7 CrossDock', city: 'Bengaluru', segment: 'SC', oracleId: 'OR70012', owner: 'Priya Menon', zone: 'South', active: true, scSubTypes: ['FMSC', 'CD'], status: 'LiveAgreementExecuted' },
  { code: 'KTA', name: 'KTA (unmapped)', city: 'Kota', hubType: 'Standalone', segment: 'FM', zone: 'North', active: true, status: 'GoLivePending' },
  { code: 'HUB31', name: 'Hub 31 Whitefield', city: 'Bengaluru', hubType: 'Standalone', segment: 'FM', oracleId: 'OR48213', owner: 'Ramesh Kumar', zone: 'South', active: true, status: 'LiveAgreementExecuted' },
  { code: 'HUB5', name: 'Hub 5 Pune', city: 'Pune', hubType: 'Mall Hub', segment: 'FM', oracleId: 'OR60214', owner: 'Neha Joshi', zone: 'West', active: true, status: 'LiveAgreementExecuted' },
  { code: 'HUB22', name: 'Hub 22 Jaipur', city: 'Jaipur', hubType: 'Seller Led Hub', segment: 'FM', oracleId: 'OR61190', owner: 'Priya Menon', zone: 'North', active: true, status: 'LiveAgreementExecuted' },
  { code: 'FMSC1', name: 'FMSC Mumbai', city: 'Mumbai', segment: 'SC', oracleId: 'OR70118', owner: 'Priya Menon', zone: 'West', active: true, scSubTypes: ['FMSC'], status: 'LiveAgreementExecuted' },
  // Sheet has 'Ahemdabad' misspelling — keep that so ceiling lookup hits.
  { code: 'FMCP1', name: 'FMCP Ahemdabad', city: 'Ahemdabad', hubType: 'FMCP', segment: 'FM', oracleId: 'OR70220', owner: 'Ramesh Kumar', zone: 'West', active: true, status: 'GoLivePending' },
  { code: 'GW1', name: 'Gateway Mumbai', city: 'Mumbai', segment: 'SC', oracleId: 'OR70301', owner: 'Priya Menon', zone: 'West', active: true, scSubTypes: ['GW'], status: 'LiveAgreementExecuted' },
  { code: 'ZED', name: 'ZED (excluded)', city: 'Nagpur', hubType: 'Standalone', segment: 'FM', zone: 'West', active: false, excludedReason: 'Duplicate DC code conflict', status: 'Deactivated' },
];

// FM-OLD rows are supplied hand-crafted (the ratecard sheet only publishes FM-NEW ceilings).
// FM-NEW + Touchpoint ceilings come from the Finance-canonical rate-card xlsx (guardrail-v12.json).
const FM_OLD_CEILINGS: CeilingRow[] = [
  { hubType: 'Standalone', city: 'Surat', type: 'FM-OLD', tiers: [3.20, 2.80, 2.50, 2.30, 2.10] },
];

export const SEED_GUARDRAILS: GuardrailVersion[] = [
  {
    version: 'v12',
    effectiveFrom: '2026-07-01',
    state: 'Live',
    ceilings: [
      ...(guardrailV12.ceilings as CeilingRow[]),
      ...FM_OLD_CEILINGS,
    ],
    touchpoints: guardrailV12.touchpoints as TouchpointCeilingRow[],
  },
];

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const RAW_SEED_REQUESTS: Omit<RateRequest, 'revision' | 'revisions'>[] = [
  {
    id: 'RC-FM-HUB9-202609-001',
    hubCode: 'HUB9', changeType: 'FM-OLD',
    tiers: [{ upTo: 5000, rate: 44 }, { upTo: 10000, rate: 42 }, { upTo: 15000, rate: 40 }, { upTo: 20000, rate: 38 }, { upTo: null, rate: 36 }],
    effectiveFrom: '2026-09-20', negotiatedOn: '2026-09-10',
    submittedBy: 'Ajay Singh', submittedAt: daysAgo(3),
    vendorSupplierNumber: '10058',
    guardrailVersion: 'v12', route: 'OpsHead-FM', ttlDays: 14,
    state: 'Pending', evidence: 'NotNeeded',
    approvals: [], rejections: [], remarks: 'Peak season revision, within-band.',
    events: [{ at: daysAgo(3), actor: 'Ajay Singh', kind: 'Submitted', note: 'Routed to Ops Head (FM)' }],
  },
  {
    // KRD §2.1.1 — vendor-defined SC-SLAB grid (FMSC leg for BLR7).
    id: 'RC-SC-BLR7-202609-001',
    hubCode: 'BLR7', changeType: 'SC-SLAB',
    tiers: [
      { upTo: 5000, rate: 13.5 },
      { upTo: 12000, rate: 12.8 },
      { upTo: null, rate: 12.0 },
    ],
    effectiveFrom: '2026-09-25', negotiatedOn: '2026-09-12',
    submittedBy: 'Priya Menon', submittedAt: daysAgo(2),
    vendorSupplierNumber: '10059',
    guardrailVersion: 'v12', route: 'BizFin', ttlDays: 14,
    state: 'Pending', evidence: 'NotNeeded',
    approvals: [], rejections: [], remarks: 'SC has no published ceilings — routes to BizFin by rule.',
    events: [{ at: daysAgo(2), actor: 'Priya Menon', kind: 'Submitted', note: 'Routed to BizFin (no SC ceilings)' }],
  },
  {
    // KRD §2.1.2 — flat CrossDock ₹/bag rate (SC-CD).
    id: 'RC-SC-BLR7-202609-002',
    hubCode: 'BLR7', changeType: 'SC-CD',
    tiers: [],
    clause: { crossDockBagRate: 14.0 },
    effectiveFrom: '2026-09-28', negotiatedOn: '2026-09-13',
    submittedBy: 'Priya Menon', submittedAt: daysAgo(1),
    vendorSupplierNumber: '10059',
    guardrailVersion: 'v12', route: 'BizFin', ttlDays: 14,
    state: 'Pending', evidence: 'NotNeeded',
    approvals: [], rejections: [], remarks: 'CrossDock flat ₹/bag — routes to BizFin by rule.',
    events: [{ at: daysAgo(1), actor: 'Priya Menon', kind: 'Submitted', note: 'Routed to BizFin (SC-CD flat)' }],
  },
  {
    id: 'RC-FM-HUB14-202608-001',
    hubCode: 'HUB14', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 48 }, { upTo: 5000, rate: 46 }, { upTo: 7500, rate: 44 }, { upTo: 10000, rate: 42 }, { upTo: 12500, rate: 40 }, { upTo: null, rate: 38 }],
    effectiveFrom: '2026-08-15', negotiatedOn: '2026-08-05',
    submittedBy: 'Ramesh Kumar', submittedAt: daysAgo(30),
    vendorSupplierNumber: '10169',
    guardrailVersion: 'v12', route: 'OpsHead-FM', ttlDays: 14,
    state: 'Approved', evidence: 'Awaiting',
    approvals: [{ by: 'Tajinder Kaur', role: 'Ops Head (FM)', at: daysAgo(28), reason: 'Within band, cleared' }],
    rejections: [], remarks: 'Awaiting addendum upload.',
    events: [
      { at: daysAgo(30), actor: 'Ramesh Kumar', kind: 'Submitted' },
      { at: daysAgo(28), actor: 'Tajinder Kaur', kind: 'Approved', note: 'Within band' },
    ],
  },
  {
    id: 'RC-FM-SSY-202607-001',
    hubCode: 'SSY', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 2.30 }, { upTo: 5000, rate: 2.05 }, { upTo: 7500, rate: 1.95 }, { upTo: 10000, rate: 1.80 }, { upTo: 12500, rate: 1.70 }, { upTo: null, rate: 1.55 }],
    effectiveFrom: '2026-07-15', negotiatedOn: '2026-07-01',
    submittedBy: 'Ramesh Kumar', submittedAt: daysAgo(70),
    vendorSupplierNumber: '10192',
    guardrailVersion: 'v12', route: 'OpsHead-FM', ttlDays: 14,
    state: 'Executed', evidence: 'Verified',
    addendumId: 'ADD-2026-07-045',
    agreementUrl: 'spotdraft://agreements/SSY-2026-07-045',
    approvals: [{ by: 'Tajinder Kaur', role: 'Ops Head (FM)', at: daysAgo(68), reason: 'Cleared' }],
    rejections: [], remarks: 'Live and executed.',
    events: [
      { at: daysAgo(70), actor: 'Ramesh Kumar', kind: 'Submitted' },
      { at: daysAgo(68), actor: 'Tajinder Kaur', kind: 'Approved' },
      { at: daysAgo(60), actor: 'Legal', kind: 'Verified', note: 'All tiers matched.' },
    ],
  },
  {
    id: 'RC-FM-HUB5-202608-003',
    hubCode: 'HUB5', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 72 }, { upTo: 5000, rate: 68 }, { upTo: 7500, rate: 62 }, { upTo: 10000, rate: 58 }, { upTo: 12500, rate: 55 }, { upTo: null, rate: 52 }],
    effectiveFrom: '2026-09-01', negotiatedOn: '2026-08-20',
    submittedBy: 'Ramesh Kumar', submittedAt: daysAgo(20),
    vendorSupplierNumber: '10355',
    guardrailVersion: 'v12', route: 'BizFin', ttlDays: 14,
    state: 'Rejected', evidence: 'NotNeeded',
    approvals: [], rejections: [{ by: 'Vidhi Sharma', at: daysAgo(18), reason: 'Breach too aggressive; renegotiate.' }],
    remarks: 'Out-of-band, rejected.',
    events: [
      { at: daysAgo(20), actor: 'Ramesh Kumar', kind: 'Submitted', note: 'Routed to BizFin (out-of-band)' },
      { at: daysAgo(18), actor: 'Vidhi Sharma', kind: 'Rejected', note: 'Breach too aggressive; renegotiate.' },
    ],
  },
  {
    id: 'RC-FM-HUB22-202607-002',
    hubCode: 'HUB22', changeType: 'FM-NEW',
    tiers: [{ upTo: 2500, rate: 56 }, { upTo: 5000, rate: 53 }, { upTo: 7500, rate: 50 }, { upTo: 10000, rate: 47 }, { upTo: 12500, rate: 45 }, { upTo: null, rate: 43 }],
    clause: { touchpointRate: 3.80, touchpointBasis: 'Per unique supplier an FE visits per day' },
    effectiveFrom: '2026-07-20', negotiatedOn: '2026-07-05',
    submittedBy: 'Priya Menon', submittedAt: daysAgo(80),
    vendorSupplierNumber: '10361',
    guardrailVersion: 'v12', route: 'OpsHead-FM', ttlDays: 14,
    state: 'AutoClosed', evidence: 'NotNeeded',
    approvals: [], rejections: [],
    remarks: 'Never concluded; TTL lapsed.',
    events: [
      { at: daysAgo(80), actor: 'Priya Menon', kind: 'Submitted' },
      { at: daysAgo(66), actor: 'System', kind: 'AutoClosed', note: 'TTL of 14 days lapsed' },
    ],
  },
];

// FR-23 — every seed starts at revision 1 with an empty revision chain.
export const SEED_REQUESTS: RateRequest[] = RAW_SEED_REQUESTS.map(r => ({
  ...r,
  revision: 1,
  revisions: [],
}));

export const SEED_DELEGATIONS: DelegationRow[] = [
  { role: 'Ops Head (FM)', primary: 'Tajinder Kaur', backup: 'Rahul Verma', from: '2026-01-01', to: '2026-12-31' },
  { role: 'Ops Head (SC)', primary: 'Soumya Varma', backup: 'Anita Gupta', from: '2026-01-01', to: '2026-12-31' },
  { role: 'BizFin', primary: 'Vidhi Sharma', backup: 'Harpreet Singh', from: '2026-01-01', to: '2026-12-31' },
];

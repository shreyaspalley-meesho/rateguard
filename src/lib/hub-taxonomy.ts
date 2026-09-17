import type { HubType, ChangeType, ApprovalRoute } from './types';

/**
 * AD-12 — single source of truth for hub-type → structure/unit/guardrail/approver.
 * Everything on the /submit hub-type-first flow (Steps 2–4) reads from this table.
 */

export type HubTypeExt = HubType | 'LM-as-FM';

export type SlabStructure = 'FM-OLD' | 'FM-NEW' | 'FMCP-FLAT' | 'SC-FLEX-10' | 'UNDEFINED';
export type RateUnit = 'shipment' | 'bag' | 'supplier-touch' | 'mixed-flat';
export type GuardrailPolicy = 'applicable' | 'not-applicable' | 'not-yet-published';
export type ClauseField =
  | 'mg' | 'mgTrigger' | 'lockInMonths' | 'noticePeriodMonths'
  | 'touchpointRate' | 'crossDockBagRate' | 'fwdRate' | 'revRate' | 'bagRate' | 'freeText';

export interface HubTaxonomy {
  hubType: HubTypeExt;
  /** Structures the submitter may pick for rate values. */
  structures: SlabStructure[];
  unit: RateUnit;
  guardrailPolicy: GuardrailPolicy;
  approver: ApprovalRoute;
  approverName: string;
  /** Optional clause fields that the wizard should reveal in Step 4. */
  clauseFields: ClauseField[];
  /** When true, /submit shows a blocked-state panel and disables submit. */
  blocked?: boolean;
  blockedReason?: string;
}

const FM_SLAB_CLAUSES: ClauseField[] = ['touchpointRate'];
const SC_CLAUSES: ClauseField[] = ['mg', 'mgTrigger', 'lockInMonths', 'noticePeriodMonths', 'crossDockBagRate'];
const FMCP_CLAUSES: ClauseField[] = ['fwdRate', 'revRate', 'bagRate'];

export const HUB_TAXONOMY: Record<HubTypeExt, HubTaxonomy> = {
  Standalone: {
    hubType: 'Standalone',
    structures: ['FM-OLD', 'FM-NEW'],
    unit: 'shipment',
    guardrailPolicy: 'applicable',
    approver: 'OpsHead-FM',
    approverName: 'Ops-FM (Tajinder)',
    clauseFields: FM_SLAB_CLAUSES,
  },
  'Mall Hub': {
    hubType: 'Mall Hub',
    structures: ['FM-OLD', 'FM-NEW'],
    unit: 'shipment',
    guardrailPolicy: 'applicable',
    approver: 'OpsHead-FM',
    approverName: 'Ops-FM (Tajinder)',
    clauseFields: FM_SLAB_CLAUSES,
  },
  'Mini Hub': {
    hubType: 'Mini Hub',
    structures: ['FM-OLD', 'FM-NEW'],
    unit: 'shipment',
    guardrailPolicy: 'applicable',
    approver: 'OpsHead-FM',
    approverName: 'Ops-FM (Tajinder)',
    clauseFields: FM_SLAB_CLAUSES,
  },
  'Seller Led Hub': {
    hubType: 'Seller Led Hub',
    structures: ['FM-OLD', 'FM-NEW'],
    unit: 'shipment',
    guardrailPolicy: 'applicable',
    approver: 'OpsHead-FM',
    approverName: 'Ops-FM (Tajinder)',
    clauseFields: FM_SLAB_CLAUSES,
  },
  FMCP: {
    hubType: 'FMCP',
    structures: ['FMCP-FLAT'],
    unit: 'mixed-flat',
    guardrailPolicy: 'not-applicable',
    approver: 'BizFin',
    approverName: 'BizFin',
    clauseFields: FMCP_CLAUSES,
  },
  'LM-as-FM': {
    hubType: 'LM-as-FM',
    structures: ['UNDEFINED'],
    unit: 'shipment',
    guardrailPolicy: 'not-yet-published',
    approver: 'BizFin',
    approverName: 'BizFin',
    clauseFields: [],
    blocked: true,
    blockedReason: 'Structure not yet defined — cannot submit until Admin configures it.',
  },
};

export function taxonomyFor(hubType: HubTypeExt | undefined): HubTaxonomy | undefined {
  if (!hubType) return undefined;
  return HUB_TAXONOMY[hubType];
}

/** Map (hubType, chosen structure) → the concrete ChangeType the store uses. */
export function changeTypeFor(hubType: HubTypeExt | undefined, structure: SlabStructure | undefined): ChangeType | undefined {
  if (!hubType || !structure) return undefined;
  switch (structure) {
    case 'FM-OLD': return 'FM-OLD';
    case 'FM-NEW': return 'FM-NEW';
    case 'FMCP-FLAT': return 'FM-FMCP';
    case 'SC-FLEX-10': return 'SC-SLAB';
    case 'UNDEFINED': return undefined;
  }
}

export const HUB_TYPE_EXT_LIST: HubTypeExt[] = [
  'Standalone', 'Mall Hub', 'Mini Hub', 'Seller Led Hub', 'FMCP', 'LM-as-FM',
];

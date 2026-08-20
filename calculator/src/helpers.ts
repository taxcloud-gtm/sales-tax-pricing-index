// =============================================================================
// helpers.ts — Shared math utilities used by multiple calculators
//
// SCHEMA GAP NOTE: SST_MEMBER_STATES is app-level data, not provider data.
// The schema is right to omit it. But the SST eligibility computation here
// assumes a uniform distribution of filing states across SST members, which
// is wrong for most real customers (their states cluster). For v1.1, accept
// an optional `sstEligibleStates: number` directly on UserInputs that the
// UI computes from the user's state selection.
// =============================================================================

import type { BillingCadence, BuyerSegment, FilingFrequency, UserInputs } from './types';

// -----------------------------------------------------------------------------
// SST member states (24 as of 2026). Used to estimate free-filing eligibility
// for SST-certified providers (currently only TaxCloud and Avalara in our set).
// -----------------------------------------------------------------------------
export const SST_MEMBER_STATES: readonly string[] = [
  'AR', 'GA', 'IN', 'IA', 'KS', 'KY', 'MI', 'MN', 'NE', 'NV',
  'NJ', 'NC', 'ND', 'OH', 'OK', 'RI', 'SD', 'TN', 'UT', 'VT',
  'WA', 'WV', 'WI', 'WY',
] as const;

export const TOTAL_SALES_TAX_STATES = 45;  // 50 minus 5 with no statewide sales tax (AK, DE, MT, NH, OR)
export const SST_MEMBER_COUNT = SST_MEMBER_STATES.length;

// -----------------------------------------------------------------------------
// filingsPerYear — convert frequency to count
// -----------------------------------------------------------------------------
export function filingsPerYear(freq: FilingFrequency): number {
  switch (freq) {
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'annual': return 1;
  }
}

// -----------------------------------------------------------------------------
// totalFilingsPerYear — across the full state footprint
// Prefers the explicit `annualFilings` input when provided; otherwise computes
// from statesFiling × frequency.
// -----------------------------------------------------------------------------
export function totalFilingsPerYear(inputs: UserInputs): number {
  if (typeof inputs.annualFilings === 'number' && inputs.annualFilings >= 0) {
    return inputs.annualFilings;
  }
  return inputs.statesFiling * filingsPerYear(inputs.filingFrequency);
}

// -----------------------------------------------------------------------------
// sstEligibleStateCount — estimate how many of the user's filing states
// qualify for SST free-filing. A state qualifies if:
//   1. It is an SST member state, AND
//   2. The customer does not have physical nexus in that state.
//
// Without per-state selection in UserInputs, we estimate using the share of
// SST members in all sales tax states. This is intentionally conservative
// for the calculator's first cut — the UI should allow per-state selection
// in v1.1 and override this estimate.
// -----------------------------------------------------------------------------
export function sstEligibleStateCount(inputs: UserInputs): number {
  // When the UI has the user pick specific SST states, trust that count.
  // Cap at SST_MEMBER_COUNT and at the user's total filing footprint — you
  // can't get a free filing in a state you don't file in.
  if (typeof inputs.sstEligibleStates === 'number') {
    return Math.min(
      SST_MEMBER_COUNT,
      Math.max(0, inputs.sstEligibleStates),
      Math.max(0, inputs.statesFiling - inputs.statesPhysicalNexus),
    );
  }

  // Fallback (no per-state selection): proportional estimate.
  const noPhysicalNexusStates = Math.max(0, inputs.statesFiling - inputs.statesPhysicalNexus);
  const sstShare = SST_MEMBER_COUNT / TOTAL_SALES_TAX_STATES;
  return Math.min(SST_MEMBER_COUNT, Math.floor(noPhysicalNexusStates * sstShare));
}

// -----------------------------------------------------------------------------
// sstFreeFilingsPerYear — how many of the buyer's annual returns are filed in
// SST-eligible states, and therefore never billed to the seller.
//
// This replaces an earlier model that treated the CSP benefit as a dollar
// credit computed at the provider's pay-as-you-go per-filing rate and then
// subtracted from a tiered filing subscription. That mixed two pricing bases:
// the credit was valued at a higher rate than the price it reduced, so it grew
// faster than the cost it offset. At high SST-state counts it very nearly
// cancelled the entire filing subscription, and a seller filing in 45 states
// came out cheaper than one filing in 20.
//
// The correct model, confirmed with TaxCloud: returns in SST member states are
// not charged at all. They are $0 rather than discounted, and they do not
// consume the seller's filing subscription. So they come out of the filing
// count BEFORE the tier ladder is walked, and no credit line exists.
//
// Derivation: without per-state filing cadence in UserInputs, assume returns
// are distributed evenly across the seller's filing states, so the SST share of
// returns equals the SST share of states. That is an assumption, not a fact,
// and it is the one to revisit when the UI can collect per-state cadence.
// -----------------------------------------------------------------------------
export function sstFreeFilingsPerYear(inputs: UserInputs, sstEligibleStates: number): number {
  if (sstEligibleStates <= 0) return 0;
  if (inputs.statesFiling <= 0) return 0;
  const totalFilings = totalFilingsPerYear(inputs);
  if (totalFilings <= 0) return 0;
  const share = Math.min(1, sstEligibleStates / inputs.statesFiling);
  return Math.min(totalFilings, Math.round(totalFilings * share));
}

// -----------------------------------------------------------------------------
// applyAnnualDiscount — convert monthly to annual with discount
// -----------------------------------------------------------------------------
export function applyAnnualDiscount(
  monthlyPrice: number,
  discountPct: number,
  cadence: BillingCadence,
): number {
  const annualGross = monthlyPrice * 12;
  return cadence === 'annual' ? annualGross * (1 - discountPct / 100) : annualGross;
}

// -----------------------------------------------------------------------------
// pickBuyerSegment — for opaque vendor estimation based on revenue
// -----------------------------------------------------------------------------
export function pickBuyerSegment(annualRevenueUSD: number): BuyerSegment {
  if (annualRevenueUSD < 1_000_000) return 'startup';
  if (annualRevenueUSD < 10_000_000) return 'smb';
  if (annualRevenueUSD < 50_000_000) return 'mid_market';
  return 'enterprise';
}

// -----------------------------------------------------------------------------
// requiresEnterpriseIntegration — flag for Avalara/Vertex-class pricing tier
// -----------------------------------------------------------------------------
export function requiresEnterpriseIntegration(integrationType: UserInputs['integrationType']): boolean {
  return ['sap', 'oracle', 'netsuite', 'dynamics'].includes(integrationType);
}

// -----------------------------------------------------------------------------
// roundDollars — keep estimates in clean integers; finance teams don't want cents
// -----------------------------------------------------------------------------
export function roundDollars(n: number): number {
  return Math.round(n);
}

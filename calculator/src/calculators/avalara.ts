// =============================================================================
// avalara.ts — Avalara range estimator (data-driven)
// Source: providers/avalara.yaml
//
// Math kept in TS:
//   - Buyer-segment selection by annual revenue
//   - Range arithmetic (always returns a range, never collapses to a point)
//   - Implementation fee amortization (3-year)
//   - ERP connector fees by integration type (HARDCODED — see TODO)
//
// Data sourced from YAML:
//   - AvaTax base ranges from plan.order_tiers (startup/smb/mid/enterprise)
//   - Per-filing range from filings.base_cost (currently single value;
//     v2 schema should add range_min/range_max to CostWithSource)
//   - Registration cost from registrations.base_cost ($403 published)
//   - SST CSP status (true — but customer experience varies)
//
// SCHEMA GAPS (TODOs for v1.1):
//   1. ERP connector fees per integration type (SAP/Oracle/NetSuite/Dynamics
//      ranges live in this file, not in YAML's add_ons.other_fees)
//   2. Implementation fee ranges per buyer segment (similar)
//   3. Per-filing cost as a range type, not single value
//   4. Bundle pricing (AvaTax + Returns multi-product discount)
// =============================================================================

import type { ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import { filingsPerYear, pickBuyerSegment, roundDollars, sstEligibleStateCount, totalFilingsPerYear } from '../helpers';

// -----------------------------------------------------------------------------
// HARDCODED — should migrate to YAML once schema supports per-integration ranges
// -----------------------------------------------------------------------------
const ERP_CONNECTOR_FEES: Record<string, { min: number; max: number }> = {
  sap: { min: 5000, max: 15000 },
  oracle: { min: 5000, max: 15000 },
  netsuite: { min: 2500, max: 8000 },
  dynamics: { min: 2500, max: 8000 },
};

const IMPLEMENTATION_FEE_RANGES = {
  startup: { min: 2500, max: 5000 },
  smb: { min: 5000, max: 15000 },
  mid_market: { min: 15000, max: 30000 },
  enterprise: { min: 30000, max: 50000 },
} as const;

// Per-filing range (currently captured as single value in YAML; this is the
// reasonable +/- spread from the aggregator-reported $42-$54)
const PER_FILING_RANGE_SPREAD = { min: 42, max: 54 };

// Observed Avalara contract values from Vendr buyer data (717 purchases,
// accessed 2026-05). Used to (1) provide a SOURCED ceiling for buyers past the
// published order ladder instead of an arbitrary ×N guess, and (2) BOUND the
// final modeled range so it can never print a figure outside observed reality.
// Source: https://www.vendr.com/marketplace/avalara
const OBSERVED_CONTRACT_RANGE = { min: 3_750, max: 75_385, avg: 16_700 };

function clampToObserved(v: number): number {
  return Math.min(OBSERVED_CONTRACT_RANGE.max, Math.max(OBSERVED_CONTRACT_RANGE.min, v));
}

// -----------------------------------------------------------------------------
// YAML-DRIVEN — pick AvaTax tier by annual orders, fall back to revenue segment
//
// Avalara's order_tiers in YAML have annual-orders boundaries (6k, 30k, 120k,
// null=enterprise). When the user supplies an order count, walk the ladder
// directly. When they don't, fall back to mapping by revenue segment.
// -----------------------------------------------------------------------------
function getAvataxRange(
  data: ProviderData,
  segment: ReturnType<typeof pickBuyerSegment>,
  annualOrders: number,
): { min: number; max: number } {
  const avataxPlan = data.plans.find((p) => p.slug === 'avatax');
  if (!avataxPlan || !avataxPlan.order_tiers || avataxPlan.order_tiers.length === 0) {
    throw new Error('Avalara YAML missing avatax plan or order_tiers');
  }
  // Avalara's enterprise tier has all-null prices ("custom"). Exclude it from
  // the order-walk so we don't divide by zero — we'll fall through to the
  // last numerically-priced tier instead and flag in a caveat that the buyer
  // is past the published range.
  const numericTiers = avataxPlan.order_tiers.filter(
    (t) => typeof t.included_orders === 'number' && (t.monthly_price > 0 || (t.annual_price ?? 0) > 0),
  );
  if (numericTiers.length === 0) {
    throw new Error('Avalara YAML has no numerically-priced order_tiers');
  }

  // Order-driven tier selection. Find the first tier whose included_orders
  // covers the buyer's annual order count; fall back to the largest numeric
  // tier when the buyer exceeds the published ladder.
  let idx = numericTiers.findIndex((t) => annualOrders <= t.included_orders);
  if (idx === -1) {
    idx = numericTiers.length - 1;
  }

  // If the input was zero (form default for assessment-stage buyers), fall
  // back to revenue-segment mapping so we still produce a meaningful range.
  if (annualOrders === 0) {
    const segmentIndex: Record<ReturnType<typeof pickBuyerSegment>, number> = {
      startup: 0,
      smb: 0,
      mid_market: Math.min(1, numericTiers.length - 1),
      enterprise: Math.min(2, numericTiers.length - 1),
    };
    idx = segmentIndex[segment];
  }

  const tier = numericTiers[idx];
  const tierMin = tier.annual_price ?? tier.monthly_price * 12;

  // Range max is the next numeric tier's annual price. If we're at the top
  // of the numeric ladder, the buyer is past Avalara's published tiers, so use
  // the top of Vendr's OBSERVED contract range as a sourced ceiling rather than
  // an arbitrary multiple of the current tier. The opacity is flagged in the
  // caveat string.
  const nextTier = numericTiers[idx + 1];
  let tierMax: number;
  if (nextTier && (nextTier.annual_price ?? null) !== null) {
    tierMax = nextTier.annual_price as number;
  } else if (nextTier && (nextTier.monthly_price ?? null) !== null && nextTier.monthly_price > 0) {
    tierMax = nextTier.monthly_price * 12;
  } else {
    tierMax = OBSERVED_CONTRACT_RANGE.max;
  }

  return { min: tierMin, max: tierMax };
}

export function calculateAvalara(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateAvalara requires ProviderData loaded from providers/avalara.yaml');
  }

  const segment = pickBuyerSegment(inputs.annualRevenueUSD);
  const annualOrders = inputs.monthlyOrders * 12;
  const baseRange = getAvataxRange(data, segment, annualOrders);

  // ERP connector fees (hardcoded, see TODO)
  const erp = ERP_CONNECTOR_FEES[inputs.integrationType];
  const connectorMin = erp?.min ?? 0;
  const connectorMax = erp?.max ?? 0;

  // Per-filing range — YAML captures the midpoint; use +/- spread for range.
  // For SST CSPs, compute the filing cost on the FULL annual filing count and
  // surface SST savings as a separate credit line so the buyer sees what the
  // CSP benefit is worth. Per-filing-rate used for the credit is Avalara's
  // published $48 base cost (data.filings.base_cost.amount).
  const totalFilings = totalFilingsPerYear(inputs);
  // Assume monthly cadence in SST states (12 returns/year/state). Decoupled
  // from inputs.statesFiling so the SST credit depends only on how many SST
  // states the buyer has economic nexus in — not on the buyer's total
  // filing-state footprint.
  const SST_FILINGS_PER_STATE_PER_YEAR = 12;
  const sstEligible = data.sst.is_csp ? sstEligibleStateCount(inputs) : 0;
  const sstFreeFilings = sstEligible * SST_FILINGS_PER_STATE_PER_YEAR;
  const perFilingPublished = data.filings.base_cost.amount ?? PER_FILING_RANGE_SPREAD.max;
  const theoreticalSstSavings = Math.round(sstFreeFilings * perFilingPublished);

  const filingsMin = totalFilings * PER_FILING_RANGE_SPREAD.min;
  const filingsMax = totalFilings * PER_FILING_RANGE_SPREAD.max;
  // Cap the displayed SST credit at the midpoint filings cost — for range
  // pricing, the customer can't save more than the average filings line.
  const filingsMid = (filingsMin + filingsMax) / 2;
  const sstSavings = Math.min(theoreticalSstSavings, Math.round(filingsMid));
  const filingsNetMin = Math.max(0, filingsMin - sstSavings);
  const filingsNetMax = Math.max(0, filingsMax - sstSavings);

  // Registrations — YAML-driven ($403 published)
  const perRegistrationCost = data.registrations.base_cost.amount ?? 0;
  const registrations = inputs.registrationBacklog * perRegistrationCost;

  // Implementation, ERP connectors, and per-transaction overages are real
  // Avalara costs, but they are one-time or variable and not defensibly sourced
  // as recurring annual figures. They are surfaced as caveats rather than baked
  // into the headline range (which previously inflated it). The segment
  // implementation range is kept only for the caveat text.
  const implRange = IMPLEMENTATION_FEE_RANGES[segment];

  // Headline range = AvaTax + Returns core + Returns filings (net of SST credit)
  // + published registrations, then BOUNDED to Vendr's observed contract
  // envelope so the model can never print a figure outside observed reality.
  const rawMin = baseRange.min + filingsNetMin + registrations;
  const rawMax = baseRange.max + filingsNetMax + registrations;
  const annualCostMin = roundDollars(clampToObserved(rawMin));
  const annualCostMax = roundDollars(clampToObserved(rawMax));

  const assumptions = [
    `Buyer segment: ${segment} (based on $${inputs.annualRevenueUSD.toLocaleString()} annual revenue)`,
    `AvaTax + Returns core: $${baseRange.min.toLocaleString()}–$${baseRange.max.toLocaleString()}/yr (Avalara's published contract tiers; ceiling bounded by Vendr observed data when the buyer is past the published ladder)`,
    `Returns (per-filing): ${totalFilings} × $${PER_FILING_RANGE_SPREAD.min}–$${PER_FILING_RANGE_SPREAD.max}`,
    sstSavings > 0
      ? `SST CSP savings: ${sstEligible} state${sstEligible === 1 ? '' : 's'} × ${SST_FILINGS_PER_STATE_PER_YEAR} filings × $${perFilingPublished}/filing = −$${sstSavings.toLocaleString()}/yr`
      : '',
    `Registrations: ${inputs.registrationBacklog} × $${perRegistrationCost} (published)`,
    `Bounded to Vendr observed Avalara contracts: $${OBSERVED_CONTRACT_RANGE.min.toLocaleString()}–$${OBSERVED_CONTRACT_RANGE.max.toLocaleString()}/yr (avg ~$${OBSERVED_CONTRACT_RANGE.avg.toLocaleString()}, 717 purchases)`,
  ].filter(Boolean);

  const caveats: string[] = [
    `${data.provider.name} does not publish list pricing for its core platform. This range is bounded to Vendr observed buyer data (avg ~$${OBSERVED_CONTRACT_RANGE.avg.toLocaleString()}/yr across 717 purchases), checkthat.ai analysis, and customer reviews — it is not a published quote.`,
    `Implementation/onboarding (~$${(implRange.min / 1000).toLocaleString()}K–$${(implRange.max / 1000).toLocaleString()}K, typically one-time), ERP connector fees, and per-transaction overages are additional and not included in this range.`,
    'Multi-year and multi-product commitments yield material discounts but are not modeled.',
    'Per-transaction overage rates apply when volume exceeds contracted tier; overage rates are not publicly disclosed.',
  ];
  if (connectorMin > 0) {
    caveats.push(
      `${inputs.integrationType.toUpperCase()} connector adds roughly $${connectorMin.toLocaleString()}–$${connectorMax.toLocaleString()}/yr and is not included above.`,
    );
  }
  if (segment === 'enterprise') {
    caveats.push('Enterprise contracts are fully custom — actual price may exceed the high end of this range.');
  }
  if (data.sst.is_csp && sstSavings > 0) {
    caveats.push(
      `${data.provider.name} is an SST CSP, but real-world realization of the SST free-filing discount varies. Some buyers report it is absorbed into base pricing rather than discounted at invoice — confirm with Avalara before relying on the SST savings shown here.`,
    );
  }
  if (data.calculator.output_caveat) {
    caveats.push(data.calculator.output_caveat);
  }

  // Midpoint breakdown for the "show full breakdown" view. Implementation and
  // connector fees are excluded from the headline (see caveats), so they are 0
  // here. (filingsMid is already computed above for the SST cap.)
  const subscriptionMid = (baseRange.min + baseRange.max) / 2;

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: 'AvaTax + Returns (custom quote)',
    estimate: {
      type: 'range',
      annualCostMinUSD: annualCostMin,
      annualCostMaxUSD: annualCostMax,
    },
    breakdown: {
      subscription: roundDollars(subscriptionMid),
      filings: roundDollars(filingsMid),
      registrations,
      transactions: 0,
      addOns: 0,
      implementation: 0,
      ...(sstSavings > 0 ? { sstSavings } : {}),
    },
    assumptions,
    caveats,
    sources: data.sources.map((s) => s.url),
  };
}

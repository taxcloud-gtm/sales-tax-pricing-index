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

// Observed Avalara contract values from Vendr buyer data (739 purchases,
// data dated Feb 2026, re-pulled 2026-08-18). Used to (1) provide a SOURCED
// ceiling for buyers past the published order ladder instead of an arbitrary
// ×N guess, and (2) BOUND the final modeled range so it can never print a
// figure outside observed reality.
// Source: https://www.vendr.com/buyer-guides/avalara
const OBSERVED_CONTRACT_RANGE = { min: 3_814, max: 75_385, avg: 16_887 };
const OBSERVED_CONTRACT_SAMPLE = 739;

// Avalara segments its published plans at $50M in annual revenue. Note this is
// a plan-card label ("Annual revenue less than $50M"), not stated exclusion
// language — the page says pricing "scales rather than locking into fixed
// tiers". We use it as the routing signal because it is what Avalara publishes.
// Source: https://www.avalara.com/us/en/products/sales-and-use-tax/pricing.html
const PUBLISHED_PRICING_REVENUE_CEILING = 50_000_000;

// The REAL gate on Avalara's published plans is the integration list, not
// revenue. Both Core plans are labeled "LIMITED INTEGRATIONS" and support only
// this list. Anything else — every ERP — is Custom-plan-only and therefore
// quote-only, regardless of how small the seller is.
// Verified 2026-08-18 against the plan page FAQ.
const CORE_PLAN_INTEGRATIONS: ReadonlySet<string> = new Set([
  'shopify',
  'bigcommerce',
  'woocommerce',
  'stripe',
  'quickbooks',
  'csv_only', // no integration required; nothing gates a CSV/manual workflow
]);

// Named on the plan page as Custom-only: NetSuite, SAP, Oracle, Dynamics,
// Acumatica. Chargebee and custom_api are not on Avalara's supported list
// either, so they fall through to the quote path.

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

// -----------------------------------------------------------------------------
// PUBLISHED PER-STATE PRICING (new 2026-08)
//
// Avalara now lists $79/state/month (Core Compliance) and $69/state/month
// (Core Compliance + SST Services) for sellers under $50M in annual revenue,
// with a 15% annual prepay discount. This is confidence-A published pricing and
// it replaces the aggregator range for that whole segment.
//
// Returned as `starting_at`, not `exact`. Avalara publishes the per-state rate
// but not the transaction limits, included return counts, or overage rates that
// sit behind it, and its own copy still says cost factors include transaction
// volume and integration footprint. The published number is a floor.
// -----------------------------------------------------------------------------
function calculateAvalaraPublished(
  inputs: UserInputs,
  data: ProviderData,
  sstEligible: number,
): ProviderEstimate | null {
  // Gate 1: the integration list. Every ERP is Custom-plan-only.
  if (!CORE_PLAN_INTEGRATIONS.has(inputs.integrationType)) return null;

  const useSstPlan = sstEligible > 0;
  const planSlug = useSstPlan ? 'core-compliance-sst' : 'core-compliance';
  const plan = data.plans.find((p) => p.slug === planSlug);
  const standardPlan = data.plans.find((p) => p.slug === 'core-compliance');
  if (!plan || plan.monthly_price.amount == null) return null;
  if (!standardPlan || standardPlan.monthly_price.amount == null) return null;

  const rateFor = (pl: typeof plan) =>
    inputs.billingCadence === 'annual'
      ? (pl.annual_price?.amount ?? (pl.monthly_price.amount as number) * 12)
      : (pl.monthly_price.amount as number) * 12;

  const sstRate = rateFor(plan);
  const standardRate = rateFor(standardPlan);

  // MIXED RATE. The $69 SST rate is NOT a blended rate across the buyer's whole
  // footprint. Avalara's fine print: "State-funded services apply only to
  // SST-eligible transactions in participating states and only for qualifying
  // volunteer sellers. If you operate in non-SST states, or in SST states where
  // you don't meet the volunteer seller criteria, standard AvaTax and Managed
  // Returns pricing applies." So SST states bill at the SST rate and every
  // other filing state bills at the standard rate.
  const states = Math.max(inputs.statesFiling, 1);
  const sstStates = Math.min(sstEligible, states);
  const nonSstStates = Math.max(0, states - sstStates);
  const subscription = useSstPlan
    ? sstStates * sstRate + nonSstStates * standardRate
    : states * standardRate;

  // Registrations are a separate published product ($403/location). On the SST
  // plan, registration in participating SST states is state-sponsored, so only
  // the non-SST backlog is billable.
  const perRegistrationCost = data.registrations.base_cost.amount ?? 0;
  const billableRegistrations = useSstPlan
    ? Math.max(0, inputs.registrationBacklog - sstStates)
    : inputs.registrationBacklog;
  const registrations = billableRegistrations * perRegistrationCost;

  const annualCost = subscription + registrations;

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: { type: 'starting_at', annualCostUSD: roundDollars(annualCost) },
    breakdown: {
      subscription: roundDollars(subscription),
      filings: 0,
      registrations,
      transactions: 0,
      addOns: 0,
      implementation: 0,
    },
    assumptions: [
      `Annual revenue ($${inputs.annualRevenueUSD.toLocaleString()}) sits under the $50M line Avalara puts on its published plan cards`,
      `Integration (${inputs.integrationType}) is on Avalara's Core plan list, so the published plans apply`,
      useSstPlan
        ? `Mixed rate: ${sstStates} SST state${sstStates === 1 ? '' : 's'} at $${sstRate.toLocaleString()}/state/year (${plan.name}) + ${nonSstStates} non-SST state${nonSstStates === 1 ? '' : 's'} at $${standardRate.toLocaleString()}/state/year (standard) = $${roundDollars(subscription).toLocaleString()}`
        : `${states} filing state${states === 1 ? '' : 's'} × $${standardRate.toLocaleString()}/state/year (${standardPlan.name}) = $${roundDollars(subscription).toLocaleString()}`,
      useSstPlan
        ? `Avalara prices its SST plan $10/state/month below its standard plan and says why in writing: states compensate Avalara directly as a CSP for covered SST services. It is a pass-through of state funding, not a discount.`
        : 'Standard Core Compliance plan (no SST-eligible states selected)',
      billableRegistrations > 0
        ? `Registrations: ${billableRegistrations} × $${perRegistrationCost} (published)${useSstPlan ? `, ${sstStates} SST-state registration${sstStates === 1 ? '' : 's'} state-sponsored at no charge` : ''}`
        : '',
      'Filings are bundled into the plan, so no separate per-filing cost is added',
    ].filter(Boolean),
    caveats: [
      "This is Avalara's published list price, shown as a floor rather than an exact figure. Avalara publishes the per-state rate but not the transaction limits, included return counts, or overage rates behind it, and its own pricing-page FAQ still says cost factors include transaction volume and integration footprint.",
      "It is a list price, not a transactable one. Every plan CTA is a sales contact form; there is no self-serve checkout, and Avalara's Returns and small-business pages remain quote-only.",
      "Avalara's Core plans support a fixed integration list (Amazon, BigCommerce, DualEntry, eBay, Etsy, Miva, QuickBooks, Sage 50, Shopify, Shopify Marketplace Connect, Stripe, TikTok, Walmart, WooCommerce). Every ERP — NetSuite, SAP, Oracle, Dynamics, Acumatica — is Custom-plan-only and therefore quote-only at any revenue level.",
      useSstPlan
        ? "The SST rate is not a blended rate. Avalara's fine print: state-funded services apply only to SST-eligible transactions in participating states and only for qualifying volunteer sellers; in non-SST states, or where the volunteer-seller test isn't met, standard pricing applies. This estimate bills SST states at the SST rate and every other filing state at the standard rate."
        : '',
      useSstPlan
        ? "Volunteer-seller eligibility is a physical-presence test, not a volume test: no fixed place of business in the state for more than 30 days, under $50,000 of property, under $50,000 of payroll, and under 25% of total property or payroll in the state."
        : '',
      "Avalara markets SST coverage in 'up to 25 states'. That is the 24 SST member states plus Pennsylvania, which Avalara describes as an analogous program rather than SST membership.",
      'Implementation and onboarding fees and per-transaction overages are additional and are not published.',
      'Above $50M in annual revenue Avalara routes buyers to its quote-only Custom plan.',
    ].filter(Boolean),
    sources: data.sources.map((s) => s.url),
  };
}

export function calculateAvalara(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateAvalara requires ProviderData loaded from providers/avalara.yaml');
  }

  // Route sub-$50M buyers to Avalara's published per-state list pricing.
  if (
    inputs.annualRevenueUSD > 0 &&
    inputs.annualRevenueUSD < PUBLISHED_PRICING_REVENUE_CEILING
  ) {
    const published = calculateAvalaraPublished(
      inputs,
      data,
      data.sst.is_csp ? sstEligibleStateCount(inputs) : 0,
    );
    if (published) return published;
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
    `Bounded to Vendr observed Avalara contracts: $${OBSERVED_CONTRACT_RANGE.min.toLocaleString()}–$${OBSERVED_CONTRACT_RANGE.max.toLocaleString()}/yr (avg ~$${OBSERVED_CONTRACT_RANGE.avg.toLocaleString()}, ${OBSERVED_CONTRACT_SAMPLE} purchases)`,
  ].filter(Boolean);

  const caveats: string[] = [
    `${data.provider.name} publishes per-state list pricing only below $50M in annual revenue; at this revenue level the core platform is quote-only. This range is bounded to Vendr observed buyer data (avg ~$${OBSERVED_CONTRACT_RANGE.avg.toLocaleString()}/yr across ${OBSERVED_CONTRACT_SAMPLE} purchases), checkthat.ai analysis, and customer reviews — it is not a published quote.`,
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

// =============================================================================
// taxcloud.ts — TaxCloud cost estimator (data-driven version)
//
// Source: providers/taxcloud.yaml (loaded at runtime)
//
// REFACTORED FROM HARDCODED CONSTANTS to consume ProviderData from the YAML
// loader. The pricing constants now live in YAML — the math stays here.
// This file is the canonical example of the data-driven calculator pattern;
// other calculators should follow the same shape.
// =============================================================================

import type { ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import {
  applyAnnualDiscount,
  roundDollars,
  sstEligibleStateCount,
  totalFilingsPerYear,
} from '../helpers';

// Integration-based plan rule:
//   - Shopify, Stripe, or CSV-only customers → Starter (lighter integrations,
//     no API access required, fits the marketplace-seller profile)
//   - Any other integration (ERP, custom API, B2B billing, other ecommerce
//     platforms) → Premium (heavier integrations imply real-time API needs
//     and the full SST CSP benefits Premium provides)
//   - statesFiling === 0 previously fell back to Free. TaxCloud removed the
//     Free plan (verified 2026-08-18), so pre-compliance buyers now land on
//     Starter, the cheapest plan that actually exists.
const STARTER_INTEGRATIONS: ReadonlyArray<UserInputs['integrationType']> = [
  'shopify',
  'stripe',
  'csv_only',
];

// Filings per SST member state per year. Assumes monthly cadence — the typical
// commerce filing rhythm and the cadence published in TaxCloud's pricing.
// Holding this constant means changing `statesFiling` doesn't shift TaxCloud's
// price: SST savings depend only on how many SST states the buyer has economic
// nexus in, not on how filings are distributed across non-SST states.
const SST_FILINGS_PER_STATE_PER_YEAR = 12;

function pickPlanSlug(inputs: UserInputs): 'starter' | 'premium' {
  if (inputs.statesFiling === 0 && inputs.registrationBacklog === 0) {
    return 'starter';
  }
  if (STARTER_INTEGRATIONS.includes(inputs.integrationType)) {
    return 'starter';
  }
  return 'premium';
}

function findPlan(data: ProviderData, slug: string) {
  const plan = data.plans.find((p) => p.slug === slug);
  if (!plan) throw new Error(`TaxCloud plan '${slug}' not found in YAML data.`);
  return plan;
}

// Walk the plan's order_tiers ladder and return the tier matching monthlyOrders.
// Falls back to the last tier when the buyer exceeds the published ladder.
function pickOrderTier(plan: ReturnType<typeof findPlan>, monthlyOrders: number) {
  const tiers = plan.order_tiers ?? [];
  if (tiers.length === 0) return null;
  for (const tier of tiers) {
    if (monthlyOrders <= tier.included_orders) return { tier, capped: false };
  }
  return { tier: tiers[tiers.length - 1], capped: true };
}

// Walk the filings.tier_pricing ladder and return the annual price for the
// tier that covers billableFilings. Returns null when no tier_pricing is
// configured (calculator will fall back to per-filing × volume math).
function pickFilingTierPrice(
  data: ProviderData,
  billableFilings: number,
): { tier: { filings: number; annual_price: number }; capped: boolean } | null {
  const tiers = data.filings.tier_pricing ?? [];
  if (tiers.length === 0) return null;
  for (const tier of tiers) {
    if (billableFilings <= tier.filings) return { tier, capped: false };
  }
  return { tier: tiers[tiers.length - 1], capped: true };
}

export function calculateTaxcloud(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateTaxcloud requires ProviderData loaded from providers/taxcloud.yaml');
  }

  const planSlug = pickPlanSlug(inputs);
  const plan = findPlan(data, planSlug);
  const orderTierResult = pickOrderTier(plan, inputs.monthlyOrders);
  const orderTier = orderTierResult?.tier ?? null;
  const annualDiscountPct =
    plan.annual_price.discount_pct_vs_monthly ??
    ((data.discounts as Record<string, unknown> | undefined)?.annual_billing_discount_pct as number) ??
    0;
  const perRegistrationCost = data.registrations.base_cost.amount ?? 0;
  // SST CSP savings apply on every TaxCloud plan — TaxCloud is the CSP, so the
  // free-filing benefit follows the customer regardless of tier. Gating to
  // plan-level `sst_program_access` would understate the savings.
  //
  // 2026-08-18: briefly gated to Premium after the help-center filing-fee
  // article (support.taxcloud.com/article/192) read that way. Confirmed with
  // TaxCloud that the benefit is available on all plans and reverted. The help
  // article is the thing that is wrong, and it is flagged for correction.
  const sstCspBenefitAvailable = data.sst.is_csp;

  // Subscription: prefer the tier's explicit annual_price when annual billing
  // is selected (TaxCloud publishes tier-specific annual rates that don't
  // collapse cleanly to a flat percentage discount).
  const monthlyPrice = orderTier?.monthly_price ?? plan.monthly_price.amount ?? 0;
  const subscription =
    inputs.billingCadence === 'annual' && typeof orderTier?.annual_price === 'number'
      ? orderTier.annual_price
      : applyAnnualDiscount(monthlyPrice, annualDiscountPct, inputs.billingCadence);

  const totalFilings = totalFilingsPerYear(inputs);
  const sstEligible = sstCspBenefitAvailable ? sstEligibleStateCount(inputs) : 0;
  const sstFreeFilingsPerYear = sstEligible * SST_FILINGS_PER_STATE_PER_YEAR;

  // Filings cost: walk the tier ladder for the FULL annual filing count, then
  // subtract a flat SST savings credit. Each SST state saves
  // (12 filings/year × base per-filing rate) — for monthly cadence at $39/filing,
  // that's $468 per SST state per year.
  const perFilingCost = data.filings.base_cost.amount ?? 0;
  const filingTierResult = pickFilingTierPrice(data, totalFilings);
  const filingCostBeforeSst = filingTierResult
    ? filingTierResult.tier.annual_price
    : totalFilings * perFilingCost;
  // Effective SST savings cap: can't save more than the filings cost. If the
  // theoretical credit exceeds filings, the buyer's invoice just zeroes out
  // the filings line — they don't get a negative balance.
  const theoreticalSstSavings = Math.round(sstFreeFilingsPerYear * perFilingCost);
  const sstSavings = Math.min(theoreticalSstSavings, Math.round(filingCostBeforeSst));
  const filings = filingCostBeforeSst - sstSavings;
  const billableFilings = Math.round(totalFilings);

  const registrations = inputs.registrationBacklog * perRegistrationCost;

  const annualCost = subscription + filings + registrations;

  // Show order tiers in ANNUAL orders to match TaxCloud's published pricing
  // table (the YAML stores monthly thresholds for parity with other providers,
  // but TaxCloud's pricing table is published per annual orders).
  const annualOrdersTier = orderTier ? orderTier.included_orders * 12 : 0;
  const assumptions: string[] = [
    orderTier
      ? `Plan: ${plan.name}, up to ${annualOrdersTier.toLocaleString()} orders/year tier at $${orderTier.annual_price ? orderTier.annual_price.toLocaleString() : (monthlyPrice * 12).toLocaleString()}/yr`
      : `Plan: ${plan.name} at $${monthlyPrice}/mo`,
    `Annual billing: ${inputs.billingCadence === 'annual' ? `~${annualDiscountPct}% discount applied via tier annual rate` : 'No annual discount applied'}`,
    filingTierResult
      ? `Filings: up to ${filingTierResult.tier.filings} filings/year tier at $${filingTierResult.tier.annual_price.toLocaleString()}/yr`
      : `${billableFilings} filings/year at $${perFilingCost}/filing`,
    sstEligible > 0
      ? sstSavings < theoreticalSstSavings
        ? `SST CSP savings: ${sstEligible} state${sstEligible === 1 ? '' : 's'} × ${SST_FILINGS_PER_STATE_PER_YEAR} filings × $${perFilingCost}/filing = −$${theoreticalSstSavings.toLocaleString()}, capped at filings cost = −$${sstSavings.toLocaleString()}/yr`
        : `SST CSP savings: ${sstEligible} state${sstEligible === 1 ? '' : 's'} × ${SST_FILINGS_PER_STATE_PER_YEAR} filings × $${perFilingCost}/filing = −$${sstSavings.toLocaleString()}/yr`
      : sstCspBenefitAvailable
        ? 'No SST states selected — pick the SST member states where you have economic nexus only to apply free-filing credit'
        : '',
    inputs.registrationBacklog > 0
      ? `Registrations: ${inputs.registrationBacklog} × $${perRegistrationCost} = $${(inputs.registrationBacklog * perRegistrationCost).toLocaleString()} (SST member state registrations are free under CSP enrollment — subtract $${perRegistrationCost}/state for any of these in SST states)`
      : '',
  ].filter(Boolean);

  const caveats: string[] = [];
  if (orderTierResult?.capped && orderTier) {
    caveats.push(
      `${(inputs.monthlyOrders * 12).toLocaleString()} orders/year exceeds the top published ${plan.name} tier (${(orderTier.included_orders * 12).toLocaleString()} orders/year). The subscription shown is that published ceiling. TaxCloud bills orders above tier at the tier's per-order rate, so actual cost will be higher${plan.slug === 'starter' ? '; Premium publishes tiers up to 480,000 orders/year' : ''}.`,
    );
  }
  if (filingTierResult?.capped) {
    caveats.push(
      `${billableFilings} billable filings exceeds the published top tier (${filingTierResult.tier.filings} filings). Custom pricing likely; estimate is the published ceiling.`,
    );
  }
  if (inputs.statesPhysicalNexus > 0 && sstCspBenefitAvailable) {
    caveats.push(`Physical nexus in ${inputs.statesPhysicalNexus} states disqualifies those from SST free-filing. Estimate accounts for this.`);
  }
  if (data.calculator.output_caveat) {
    caveats.push(data.calculator.output_caveat);
  }

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: { type: 'exact', annualCostUSD: roundDollars(annualCost) },
    breakdown: {
      subscription: roundDollars(subscription),
      // Filings line shows the tier-pricing cost BEFORE SST credit so the
      // savings are visible as a separate line. The net is filings − sstSavings.
      filings: roundDollars(filingCostBeforeSst),
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

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
  sstFreeFilingsPerYear,
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

  // Returns in SST member states are not charged and do not consume the filing
  // subscription, so they come out of the count BEFORE the tier ladder is
  // walked. There is no credit line: the returns are $0, not discounted.
  //
  // The previous model walked the ladder on the FULL filing count and then
  // subtracted a credit valued at the pay-as-you-go per-filing rate, which is
  // higher than the tiered effective rate it was reducing. See
  // sstFreeFilingsPerYear() in helpers.ts for why that was wrong and by how
  // much.
  const freeFilings = sstFreeFilingsPerYear(inputs, sstEligible);
  const billableFilings = Math.max(0, Math.round(totalFilings - freeFilings));

  const perFilingCost = data.filings.base_cost.amount ?? 0;
  const filingTierResult = billableFilings > 0 ? pickFilingTierPrice(data, billableFilings) : null;
  const filings =
    billableFilings === 0
      ? 0
      : filingTierResult
        ? filingTierResult.tier.annual_price
        : billableFilings * perFilingCost;

  // Registrations in SST member states are also free under CSP enrollment, so
  // only the non-SST backlog is billable. State permit fees charged by the
  // state itself pass through and are not modeled.
  const billableRegistrations = Math.max(0, inputs.registrationBacklog - sstEligible);
  const registrations = billableRegistrations * perRegistrationCost;

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
    freeFilings > 0
      ? `Filings: ${totalFilings} returns/year total, ${freeFilings} of them in ${sstEligible} SST member state${sstEligible === 1 ? '' : 's'} and not charged, leaving ${billableFilings} billable`
      : `Filings: ${totalFilings} returns/year, all billable`,
    billableFilings === 0
      ? 'Filing subscription: none needed, every return falls in an SST member state where filing is not charged'
      : filingTierResult
        ? `Filing subscription: the ${filingTierResult.tier.filings}-filing tier at $${filingTierResult.tier.annual_price.toLocaleString()}/yr, sized to the ${billableFilings} billable returns rather than the ${totalFilings} total`
        : `${billableFilings} billable filings at $${perFilingCost}/filing`,
    sstEligible === 0 && sstCspBenefitAvailable
      ? 'No SST states selected. Pick the SST member states where you have economic nexus only and no physical presence to remove those returns from the bill.'
      : '',
    inputs.registrationBacklog > 0
      ? billableRegistrations === inputs.registrationBacklog
        ? `Registrations: ${inputs.registrationBacklog} × $${perRegistrationCost} = $${(billableRegistrations * perRegistrationCost).toLocaleString()}. State permit fees charged by the state pass through and are not modeled.`
        : `Registrations: ${inputs.registrationBacklog} needed, ${inputs.registrationBacklog - billableRegistrations} of them in SST member states and free under CSP enrollment, leaving ${billableRegistrations} × $${perRegistrationCost} = $${(billableRegistrations * perRegistrationCost).toLocaleString()}. State permit fees charged by the state pass through and are not modeled.`
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
  if (freeFilings > 0) {
    caveats.push(
      `Which returns land in SST states is estimated, not known: without per-state filing cadence the model assumes returns are spread evenly across your filing states, so ${sstEligible} of ${inputs.statesFiling} states means ${freeFilings} of ${totalFilings} returns. A footprint that clusters returns in non-SST states costs more than this shows.`,
    );
  }
  const upcharges = data.filings.state_upcharges ?? [];
  if (freeFilings > 0 && upcharges.length > 0) {
    caveats.push(
      `"Not charged" is not universal across SST states. ${upcharges
        .map((u) => `${u.state} adds $${u.additional_cost} per filing (${u.reason.toLowerCase()})`)
        .join('; ')}. Those are not modeled here because the calculator has no per-state input.`,
    );
  }
  // Published tier pricing is a list price for this provider too. It is
  // transactable, unlike some competitors' list prices, but a sales-assisted
  // deal can land below it. Saying so keeps the site from presenting one
  // vendor's number as firm while flagging everyone else's as a starting
  // point, which is the asymmetry a publisher is most likely to miss in its
  // own favour.
  caveats.push(
    `This is ${data.provider.name}'s published tier pricing, which is self-serve and transactable at list. A sales-assisted deal can still land below it, so treat the figure as what you would pay without negotiating rather than the floor of what is achievable.`,
  );
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
      // The filings line is the cost of the BILLABLE returns. There is no
      // credit to net off, because returns in SST member states are never
      // charged. `filingsNotCharged` carries the count so the UI can say what
      // the CSP benefit removed without pretending it was a discount.
      filings: roundDollars(filings),
      registrations,
      transactions: 0,
      addOns: 0,
      implementation: 0,
      ...(freeFilings > 0 ? { filingsNotCharged: freeFilings } : {}),
    },
    assumptions,
    caveats,
    sources: data.sources.map((s) => s.url),
  };
}

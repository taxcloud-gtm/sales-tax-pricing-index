// =============================================================================
// anrok.ts — Anrok cost estimator (data-driven)
// Source: providers/anrok.yaml
//
// REWRITTEN 2026-08-18. Anrok replaced subscription + basis-points pricing with
// a flat fee per market per month. The old ARR-banded plan picker and the bps
// math are gone because the inputs they consumed no longer exist on Anrok's
// pricing page.
//
// Pricing primitive: per_region_flat — markets x monthly rate x 12.
// Math kept in TS:
//   - Market count (US filing states + international jurisdictions)
//   - Product-line selection (ecommerce line at $50 vs general line at $100)
//
// Data sourced from YAML:
//   - Per-market monthly rate for each product line
//   - Custom tier quote-only flag
//
// Anrok publishes the unit definition of a "market": each US state counts as
// one, the EU filed via OSS counts as one, Canada federal GST/HST counts as one
// with BC, Manitoba, Saskatchewan and Quebec counted separately. We count
// international jurisdictions one-for-one, which overstates cost for EU-heavy
// buyers. That is disclosed in the caveats rather than silently corrected.
// =============================================================================

import type { ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import { roundDollars } from '../helpers';

// Anrok sells a separate, cheaper product line to ecommerce sellers but
// publishes no rule for which line a buyer falls into beyond "eCommerce
// companies". Integration type is our proxy. Disclosed as an assumption.
const ECOMMERCE_INTEGRATIONS: ReadonlyArray<UserInputs['integrationType']> = [
  'shopify',
  'bigcommerce',
  'woocommerce',
];

function pickPlanSlug(inputs: UserInputs): 'starter' | 'ecommerce-starter' {
  return ECOMMERCE_INTEGRATIONS.includes(inputs.integrationType)
    ? 'ecommerce-starter'
    : 'starter';
}

export function calculateAnrok(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateAnrok requires ProviderData loaded from providers/anrok.yaml');
  }

  const planSlug = pickPlanSlug(inputs);
  const plan = data.plans.find((p) => p.slug === planSlug);
  if (!plan) throw new Error(`Anrok plan '${planSlug}' not found in YAML data.`);

  const perMarketMonthly = plan.monthly_price.amount ?? 0;
  const markets = inputs.statesFiling + (inputs.internationalCountries ?? 0);
  const annualCost = markets * perMarketMonthly * 12;

  const isEcommerceLine = planSlug === 'ecommerce-starter';

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: { type: 'exact', annualCostUSD: roundDollars(annualCost) },
    breakdown: {
      subscription: roundDollars(annualCost),
      filings: 0,
      registrations: 0,
      transactions: 0,
      addOns: 0,
      implementation: 0,
    },
    assumptions: [
      `${markets} markets (${inputs.statesFiling} US states + ${inputs.internationalCountries ?? 0} international)`,
      `Flat rate: $${perMarketMonthly}/market/month x 12 months`,
      isEcommerceLine
        ? `Priced on Anrok's ecommerce line ($${perMarketMonthly}/market/mo) because the selected integration (${inputs.integrationType}) is an ecommerce platform. Non-ecommerce companies pay $100/market/mo.`
        : `Priced on Anrok's general line ($${perMarketMonthly}/market/mo). Ecommerce companies pay $50/market/mo.`,
      'All filings and registrations included in the flat per-market fee',
    ],
    caveats: [
      'Anrok counts the EU filed via OSS as a single market. This estimate counts each international jurisdiction separately, so EU-heavy buyers will be overstated here.',
      'Anrok discloses that high-volume Starter sellers may be charged additional fees to cover third-party costs. Neither the volume threshold nor the rate is published, so it is not modeled.',
      'Anrok publishes no threshold for when a buyer is moved to its quote-only Custom tier, where pricing scales with total transaction volume.',
      !data.sst.is_csp ? `${data.provider.name} is not an SST CSP.` : '',
      data.calculator.output_caveat ?? '',
    ].filter(Boolean),
    sources: data.sources.map((s) => s.url),
  };
}

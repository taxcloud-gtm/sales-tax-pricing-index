// =============================================================================
// sphere.ts — Sphere cost estimator (data-driven)
// Source: providers/sphere.yaml
//
// Pricing primitive: per_region_flat — multiply active regions by monthly rate.
// Math kept in TS:
//   - Region count (US states + international countries)
//   - High-volume threshold detection (50,000 txn/month)
//
// Data sourced from YAML:
//   - Per-region monthly price ($100)
//   - Transaction threshold and overage notes
// =============================================================================

import type { ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import { roundDollars } from '../helpers';

const SPHERE_HIGH_VOLUME_THRESHOLD_PER_YEAR = 50_000 * 12;  // 50K/month threshold

// Sphere publishes the $100/region rate only for Starter, which it caps at
// "< 10 regions". At 10+ the buyer is on the quote-only Growth tier.
// Verified 2026-08-18 against the pricing page.
const SPHERE_STARTER_MAX_REGIONS = 10;

export function calculateSphere(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateSphere requires ProviderData loaded from providers/sphere.yaml');
  }

  const plan = data.plans.find((p) => p.slug === 'starter');
  if (!plan) throw new Error("Sphere YAML missing 'starter' plan.");

  const perRegionMonthly = plan.monthly_price.amount ?? 0;
  const regions = inputs.statesFiling + (inputs.internationalCountries ?? 0);
  const annualCost = regions * perRegionMonthly * 12;

  const annualTransactions = inputs.monthlyOrders * 12;
  const exceedsHighVolume = annualTransactions > SPHERE_HIGH_VOLUME_THRESHOLD_PER_YEAR;
  const exceedsStarterRegions = regions >= SPHERE_STARTER_MAX_REGIONS;

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: exceedsStarterRegions
      ? { type: 'starting_at', annualCostUSD: roundDollars(annualCost) }
      : { type: 'exact', annualCostUSD: roundDollars(annualCost) },
    breakdown: {
      subscription: roundDollars(annualCost),
      filings: 0,
      registrations: 0,
      transactions: 0,
      addOns: 0,
      implementation: 0,
    },
    assumptions: [
      `${regions} regions (${inputs.statesFiling} US states + ${inputs.internationalCountries ?? 0} international)`,
      `Flat rate: $${perRegionMonthly}/region/month × 12 months`,
      'All filings and registrations included in flat fee',
    ],
    caveats: [
      exceedsStarterRegions
        ? `At ${regions} regions you are past Sphere's published Starter tier, which covers fewer than ${SPHERE_STARTER_MAX_REGIONS} regions. Sphere routes 10+ regions to a quote-only Growth tier with no published price, so this figure is the Starter rate extended as a floor, not a quote.`
        : '',
      exceedsHighVolume
        ? `At ${annualTransactions.toLocaleString()} annual transactions, you exceed Sphere's 50,000/month threshold. Additional per-transaction fees apply above this volume; not modeled here.`
        : 'No per-transaction fees below 50,000 transactions/month across active regions.',
      'State-level registration fees may pass through (e.g., states that charge a permit fee).',
      !data.sst.is_csp ? `${data.provider.name} is not an SST CSP.` : '',
    ].filter(Boolean),
    sources: data.sources.map((s) => s.url),
  };
}

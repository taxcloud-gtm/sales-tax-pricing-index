// =============================================================================
// numeral.ts — Numeral cost estimator (data-driven)
// Source: providers/numeral.yaml
//
// Math kept in TS:
//   - Plan selection (Free/Standard/Pro based on features)
//   - Pro plan custom-quote handling with Standard-equivalent floor
//
// Data sourced from YAML:
//   - Plan list and is_quote_only flags
//   - filings.base_cost ($75)
//   - registrations.base_cost ($150)
//   - SST CSP status (false)
// =============================================================================

import type { ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import { roundDollars, totalFilingsPerYear } from '../helpers';

// Slugs are legacy and no longer match Numeral's plan names. Numeral renamed
// its tiers to Monitoring / Professional / Enterprise (verified 2026-08-18);
// 'free' -> Monitoring, 'standard' -> Professional, 'pro' -> Enterprise. Slugs
// kept for data continuity so historical comparisons don't break.
function pickPlanSlug(inputs: UserInputs): 'free' | 'standard' | 'pro' {
  if (
    inputs.requiresApiAccess ||
    inputs.requiresExemptionCertificateMgmt ||
    inputs.requiresInternationalVatGst ||
    inputs.requiresVdaSupport
  ) {
    return 'pro';
  }
  if (inputs.statesFiling === 0 && inputs.registrationBacklog === 0) {
    return 'free';
  }
  return 'standard';
}

export function calculateNumeral(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateNumeral requires ProviderData loaded from providers/numeral.yaml');
  }

  const planSlug = pickPlanSlug(inputs);
  const plan = data.plans.find((p) => p.slug === planSlug);
  if (!plan) throw new Error(`Numeral plan '${planSlug}' not found in YAML data.`);

  const perFilingCost = data.filings.base_cost.amount ?? 0;
  const perRegistrationCost = data.registrations.base_cost.amount ?? 0;
  const baseSources = data.sources.map((s) => s.url);

  if (planSlug === 'free') {
    return {
      provider: data.provider.name,
      slug: data.provider.slug,
      transparencyTier: data.transparency.tier,
      recommendedPlan: plan.name,
      estimate: { type: 'exact', annualCostUSD: 0 },
      breakdown: { subscription: 0, filings: 0, registrations: 0, transactions: 0, addOns: 0, implementation: 0 },
      assumptions: ['No filings or registrations required — monitoring tier sufficient'],
      caveats: [`As soon as you cross nexus and need to file, you move to Standard at $${perFilingCost}/filing.`],
      sources: baseSources,
    };
  }

  const totalFilings = totalFilingsPerYear(inputs);

  if (planSlug === 'standard') {
    const filings = totalFilings * perFilingCost;
    const registrations = inputs.registrationBacklog * perRegistrationCost;
    const annualCost = filings + registrations;

    const assumptions = [
      'Plan: Standard (no subscription fee)',
      `${totalFilings} filings/year × $${perFilingCost}`,
      `${inputs.registrationBacklog} registrations × $${perRegistrationCost}`,
    ];

    const caveats: string[] = [];
    if (!data.sst.is_csp) {
      caveats.push(`Numeral is not an SST CSP. full $${perFilingCost}/return applies in all states including SST members.`);
    }
    if (totalFilings >= 60) {
      caveats.push(
        `At ${totalFilings} filings/year, per-filing cost compounds significantly. SST-certified providers eliminate filing fees in up to 24 states for eligible customers.`,
      );
    }

    return {
      provider: data.provider.name,
      slug: data.provider.slug,
      transparencyTier: data.transparency.tier,
      recommendedPlan: plan.name,
      estimate: { type: 'exact', annualCostUSD: roundDollars(annualCost) },
      breakdown: { subscription: 0, filings, registrations, transactions: 0, addOns: 0, implementation: 0 },
      assumptions,
      caveats,
      sources: baseSources,
    };
  }

  // Pro plan — quote required with Standard-equivalent floor
  const standardFloor = totalFilings * perFilingCost + inputs.registrationBacklog * perRegistrationCost;

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: {
      type: 'quote_required',
      startingAtUSD: roundDollars(standardFloor),
      message:
        'Pro plan is custom-quoted. Reports indicate fixed fee + potential % of revenue for ERP-integrated customers. Floor shown is Standard-plan equivalent before Pro feature uplift.',
    },
    assumptions: [
      'Pro plan required by your selected features (API / ECM / international / VDA).',
      `Standard-plan equivalent floor: ${totalFilings} filings × $${perFilingCost} + ${inputs.registrationBacklog} registrations × $${perRegistrationCost}`,
    ],
    caveats: [
      'Pro plan custom pricing is not publicly published. Third-party reports suggest revenue-based components for ERP-integrated customers.',
      `${data.provider.name} is not an SST CSP. no free filings in SST states.`,
    ],
    sources: baseSources,
  };
}

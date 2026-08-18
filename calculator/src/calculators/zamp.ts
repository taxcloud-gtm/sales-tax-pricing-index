// =============================================================================
// zamp.ts — Zamp cost estimator (data-driven, range-based)
//
// Pricing primitive: opaque bundle.
// Zamp publishes a Free tier in full detail. U.S. Plan and Global Plan are
// quote-only with no dollar amounts on the pricing page. We return a range
// estimate scaled by buyer segment, similar to Avalara's pattern.
//
// Data sourced from YAML:
//   - Plan list with monthly_price range bounds (range_min / range_max)
//   - international support flag (selects U.S. vs Global plan)
// Math kept in TS:
//   - Plan selection (Global if user needs VAT/GST; otherwise U.S.)
//   - Range scaling by buyer segment (revenue + state footprint)
// =============================================================================
import type { Plan, ProviderData } from '../data/types';
import type { ProviderEstimate, UserInputs } from '../types';
import { pickBuyerSegment, roundDollars } from '../helpers';

type ScaleFactor = { min: number; max: number };

// How much of the published range to surface, by buyer segment.
// Free tier is not modeled — user is post-assessment by the time they hit
// the calculator with real volumes.
const SEGMENT_SCALE: Record<string, ScaleFactor> = {
  startup: { min: 0.0, max: 0.25 },     // bottom quarter of the range
  smb: { min: 0.15, max: 0.5 },          // lower-middle
  mid_market: { min: 0.4, max: 0.8 },    // upper-middle
  enterprise: { min: 0.7, max: 1.0 },    // top quarter
};

function pickPaidPlan(plans: Plan[], wantsInternational: boolean): Plan {
  const slug = wantsInternational ? 'global' : 'us';
  const plan = plans.find((p) => p.slug === slug);
  if (!plan) throw new Error(`Zamp plan '${slug}' not found in YAML data.`);
  return plan;
}

export function calculateZamp(inputs: UserInputs, data?: ProviderData): ProviderEstimate {
  if (!data) {
    throw new Error('calculateZamp requires ProviderData loaded from providers/zamp.yaml');
  }

  const plan = pickPaidPlan(data.plans, !!inputs.requiresInternationalVatGst);

  const baseMin = plan.monthly_price.range_min ?? 0;
  const baseMax = plan.monthly_price.range_max ?? 0;

  // Pull the buyer segment, then nudge it upward when state footprint is wide.
  // 25+ filing states pushes one tier up; 40+ pushes another. This reflects
  // Zamp's stated cost drivers (jurisdictions, transactions, integrations).
  const baseSegment = pickBuyerSegment(inputs.annualRevenueUSD);
  const segments = ['startup', 'smb', 'mid_market', 'enterprise'];
  let segIdx = segments.indexOf(baseSegment);
  if (inputs.statesFiling >= 40) segIdx = Math.min(3, segIdx + 2);
  else if (inputs.statesFiling >= 25) segIdx = Math.min(3, segIdx + 1);
  const segment = segments[segIdx];
  const scale = SEGMENT_SCALE[segment] ?? SEGMENT_SCALE.smb;

  const monthlyMin = baseMin + (baseMax - baseMin) * scale.min;
  const monthlyMax = baseMin + (baseMax - baseMin) * scale.max;

  const annualMin = roundDollars(monthlyMin * 12);
  const annualMax = roundDollars(monthlyMax * 12);

  const assumptions = [
    `Plan: ${plan.name} (quote-only; range estimated from aggregator buyer data)`,
    `Buyer segment: ${segment} (revenue $${inputs.annualRevenueUSD.toLocaleString()}, ${inputs.statesFiling} states)`,
    // NOTE: the 'global' slug is legacy. Zamp renamed this tier "U.S. + Canada"
    // (verified 2026-08-18) and sells no globally-scoped plan on its pricing
    // page. Slug kept for data continuity; the copy follows the current name.
    `Bundle includes filings, registrations, notice handling, and ${plan.slug === 'global' ? 'Canadian coverage alongside US sales tax' : 'US sales tax'}, with no per-event surcharges.`,
  ];

  const caveats: string[] = [
    'Zamp does not publish dollar pricing for paid plans. Ranges inferred from aggregator commentary and third-party comparison pages.',
    'Actual quote depends on transaction volume, jurisdictions, integration complexity, and negotiation.',
  ];
  if (!data.sst.is_csp) {
    caveats.push(`${data.provider.name} is not an SST CSP — no free filings in SST member states.`);
  }
  if (inputs.statesFiling >= 25) {
    caveats.push(`Wide state footprint (${inputs.statesFiling} states) typically pushes Zamp's quote toward the upper end of the segment range.`);
  }

  return {
    provider: data.provider.name,
    slug: data.provider.slug,
    transparencyTier: data.transparency.tier,
    recommendedPlan: plan.name,
    estimate: {
      type: 'range',
      annualCostMinUSD: annualMin,
      annualCostMaxUSD: annualMax,
    },
    assumptions,
    caveats,
    sources: data.sources.map((s) => s.url),
  };
}

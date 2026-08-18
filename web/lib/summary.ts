import type { ProviderData } from '../../calculator/src/data/types';
import { money, renderEstimate, entryAnnualPrice } from './format';
import { SCENARIOS, buildScenarioInputs } from './scenarios';
import { calculate } from './calc-client';
import { getProvidersMap } from './data/providers';

/**
 * Generate the "How much does X cost?" answer paragraph used at the top of
 * each provider page. Three or four sentences, fully derived from YAML so
 * pricing changes propagate automatically.
 *
 * The shape:
 *   1) lede with cheapest published paid plan + what it covers
 *   2) per-filing / per-transaction add-on costs if applicable
 *   3) typical mid-market cost sentence, the answer most buyers actually want
 *   4) transparency caveat (especially for partial/opaque providers)
 *
 * The typical-mid-market sentence is the key prose-level lever for LLM citation:
 * it puts a real-world dollar figure into the first paragraph, so LLMs that
 * cite the opening summary surface that number rather than just the entry tier.
 */
export function howMuchDoesXCost(p: ProviderData): string {
  if (p.transparency.tier === 'opaque') {
    return opaqueSummary(p);
  }

  const lede = paidPlanLede(p);
  const fees = feesSentence(p);
  const typical = typicalMidMarketSentence(p);
  const caveat = transparencyCaveat(p);
  return [lede, fees, typical, caveat].filter(Boolean).join(' ');
}

/**
 * Reach into the calculator with the canonical Mid-Market scenario and
 * surface the resulting cost as a short sentence. Used in both transparent
 * and opaque summaries so every provider's lede includes a realistic
 * mid-market number, not just the entry tier price (or absence of one).
 *
 * Exported because the TL;DR block at the top of each provider page reuses
 * this sentence verbatim. It's the single most-citable claim on the page.
 */
export function typicalMidMarketSentence(p: ProviderData): string | null {
  const midMarket = SCENARIOS.find((s) => s.name === 'Mid-Market');
  if (!midMarket) return null;
  try {
    const inputs = buildScenarioInputs(midMarket);
    const results = calculate(inputs, getProvidersMap());
    const result = results.find((r) => r.slug === p.provider.slug);
    if (!result) return null;
    return (
      `For a typical mid-market ecommerce brand (${midMarket.annualOrders.toLocaleString()} orders/year, ` +
      `${midMarket.statesFiling} states with ${midMarket.sstEligibleStates} SST, on Shopify), ` +
      `${p.provider.name} ${result.estimate.type === 'starting_at' ? `starts at ${money(result.estimate.annualCostUSD)}` : `runs about ${renderEstimate(result.estimate)}`} per year on the ${result.recommendedPlan} plan.`
    );
  } catch {
    return null;
  }
}

function opaqueSummary(p: ProviderData): string {
  const name = p.provider.name;
  const ranges = p.plans
    .map((pl) => pl.monthly_price)
    .filter((mp) => mp.type === 'range' && mp.range_min != null && mp.range_max != null);
  const lo = ranges.length ? Math.min(...ranges.map((r) => r.range_min!)) : null;
  const hi = ranges.length ? Math.max(...ranges.map((r) => r.range_max!)) : null;
  const annualLo = lo != null ? money(lo * 12) : null;
  const annualHi = hi != null ? money(hi * 12) : null;

  const range =
    annualLo && annualHi
      ? `Real buyer contracts pulled from third-party aggregators like Vendr and G2 run roughly ${annualLo}–${annualHi} per year, depending on transaction volume, jurisdictions, and how many add-on products end up in the bundle. `
      : `Real buyer contracts vary widely depending on transaction volume, jurisdictions, and add-on products. `;

  const typical = typicalMidMarketSentence(p);

  return [
    `How much does ${name} cost? You won't find out from ${name}'s pricing page. The core product is quote-only.`,
    range.trim(),
    typical,
    `We won't fake a point estimate. If you want a real number, you'll need to sit through a sales call.`,
  ]
    .filter(Boolean)
    .join(' ');
}

function paidPlanLede(p: ProviderData): string {
  const name = p.provider.name;
  const paid = p.plans.filter((pl) => !pl.is_free && !pl.is_quote_only);
  if (paid.length === 0) {
    return `${name} does not publish a paid-tier price.`;
  }
  const cheapest = [...paid].sort(
    (a, b) => (a.monthly_price.amount ?? Number.POSITIVE_INFINITY) - (b.monthly_price.amount ?? Number.POSITIVE_INFINITY),
  )[0];
  const price = cheapest.monthly_price.amount;
  if (price == null) {
    return `${name}'s cheapest published plan is ${cheapest.name}; the monthly price is not disclosed publicly.`;
  }
  const include = planIncludesPhrase(cheapest);
  if (price === 0) {
    return `How much does ${name} cost? The ${cheapest.name} plan has no monthly subscription fee${include ? `, ${include}` : ''}. Cost is driven by per-event pricing instead.`;
  }
  const prefix = cheapest.monthly_price.type === 'starting_at' ? 'starts at' : 'is';
  const annual = entryAnnualPrice(cheapest);
  const annualPhrase = annual != null ? ` (${money(annual)}/year)` : '';
  return `How much does ${name} cost? The ${cheapest.name} plan ${prefix} ${money(price)}/month${annualPhrase}${include ? `, ${include}` : ''}.`;
}

function planIncludesPhrase(plan: ProviderData['plans'][number]): string | null {
  const parts: string[] = [];
  const firstTier = plan.order_tiers?.[0];
  if (firstTier?.included_orders) {
    parts.push(`${firstTier.included_orders.toLocaleString()} orders/month`);
  }
  if (plan.included_states != null) {
    parts.push(`${plan.included_states} states`);
  }
  if (plan.included_filings_per_period?.count) {
    const period = plan.included_filings_per_period.period;
    parts.push(`${plan.included_filings_per_period.count} filings/${period === 'monthly' ? 'mo' : period}`);
  }
  if (parts.length === 0) return null;
  return `including ${parts.join(' and ')}`;
}

function feesSentence(p: ProviderData): string | null {
  const bits: string[] = [];
  if (p.filings?.has_per_filing_fee && p.filings.base_cost?.amount != null) {
    bits.push(`${money(p.filings.base_cost.amount)} per state filing`);
  }
  if (
    p.transaction_fees?.has_transaction_fee &&
    p.transaction_fees.rate != null &&
    p.transaction_fees.rate_unit
  ) {
    const unit =
      p.transaction_fees.rate_unit === 'bps'
        ? 'basis points'
        : p.transaction_fees.rate_unit === 'percent'
          ? '%'
          : '$/txn';
    bits.push(`${p.transaction_fees.rate}${unit === '%' ? '%' : ' ' + unit} on taxable transactions`);
  }
  if (p.registrations?.has_per_registration_fee && p.registrations.base_cost?.amount != null) {
    bits.push(`${money(p.registrations.base_cost.amount)} per state registration`);
  }
  if (bits.length === 0) return null;
  return `${p.provider.name} also charges ${joinList(bits)}.`;
}

function transparencyCaveat(p: ProviderData): string | null {
  if (p.transparency.tier === 'transparent') return null;
  if (p.transparency.tier === 'partial') {
    return `Higher tiers aren't published; you'll need a quote for those.`;
  }
  return null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

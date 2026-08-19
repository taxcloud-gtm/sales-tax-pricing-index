/**
 * cost-spread.ts — the homepage's liftable answer.
 *
 * The root URL is the page most likely to be cited as "the source" for this
 * site, and until now it contained no prices and no <table> at all: a model
 * landing here found nothing quotable. This computes a single self-contained
 * sentence answering "how much does sales tax compliance software cost?" from
 * the same calculator the rest of the site uses, plus the ItemList payload for
 * the ranking.
 */
import type { ProviderData } from '../../calculator/src/data/types';
import type { ProviderEstimate } from '../../calculator/src/types';
import { calculate } from './calc-client';
import { estimateFloor, money, renderEstimate } from './format';
import { SCENARIOS, buildScenarioInputs } from './scenarios';
import { providerPath } from './slugs';
import { absoluteUrl } from './utils';

/** Highest defensible figure for an estimate: the top of a range, else the point. */
function estimateCeiling(e: ProviderEstimate['estimate']): number {
  switch (e.type) {
    case 'exact':
    case 'starting_at':
      return e.annualCostUSD;
    case 'range':
      return e.annualCostMaxUSD;
    case 'quote_required':
      return e.startingAtUSD ?? Number.NEGATIVE_INFINITY;
  }
}

export interface CostSpread {
  scenarioName: string;
  scenarioDescription: string;
  cheapest: ProviderEstimate;
  priciest: ProviderEstimate;
  low: number;
  high: number;
  multiple: number;
  results: ProviderEstimate[];
}

export function midMarketSpread(providers: Map<string, ProviderData>): CostSpread | null {
  const scenario = SCENARIOS.find((s) => s.name === 'Mid-Market') ?? SCENARIOS[SCENARIOS.length - 1];
  if (!scenario) return null;

  let results: ProviderEstimate[];
  try {
    results = calculate(buildScenarioInputs(scenario), providers);
  } catch {
    return null;
  }
  if (results.length === 0) return null;

  const sorted = [...results].sort((a, b) => estimateFloor(a.estimate) - estimateFloor(b.estimate));
  const cheapest = sorted[0];
  const priciest = sorted[sorted.length - 1];
  const low = estimateFloor(cheapest.estimate);
  const high = estimateCeiling(priciest.estimate);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0) return null;

  return {
    scenarioName: scenario.name,
    scenarioDescription: scenario.description,
    cheapest,
    priciest,
    low,
    high,
    multiple: high / low,
    results: sorted,
  };
}

/**
 * One sentence, complete on its own, with every qualifier inline so it survives
 * being lifted out of the page without its surrounding context.
 */
export function costSpreadSentence(spread: CostSpread): string {
  const times = spread.multiple >= 10 ? spread.multiple.toFixed(0) : spread.multiple.toFixed(1);
  return (
    `For a mid-market ecommerce brand (${spread.scenarioDescription}), ` +
    `sales tax compliance software costs between ${money(spread.low)} and ${money(spread.high)} ` +
    `per year across the eight platforms tracked here, a ${times}x spread for the same work. ` +
    `${spread.cheapest.provider} is cheapest at ${renderEstimate(spread.cheapest.estimate)} and ` +
    `${spread.priciest.provider} is most expensive at ${renderEstimate(spread.priciest.estimate)}.`
  );
}

/** ItemList of the ranking, so the table is machine-readable as an ordered list. */
export function costSpreadItemListJsonLd(spread: CostSpread) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Sales tax compliance software cost, ranked (${spread.scenarioName} profile)`,
    description: costSpreadSentence(spread),
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: spread.results.length,
    itemListElement: spread.results.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.provider,
      url: absoluteUrl(providerPath(r.slug)),
      item: {
        '@type': 'Product',
        name: r.provider,
        url: absoluteUrl(providerPath(r.slug)),
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: estimateFloor(r.estimate),
          description: `${renderEstimate(r.estimate)} per year for the ${spread.scenarioName} profile on the ${r.recommendedPlan} plan.`,
        },
      },
    })),
  };
}

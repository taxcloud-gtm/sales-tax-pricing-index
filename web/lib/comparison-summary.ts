import type { ProviderData } from '../../calculator/src/data/types';
import { money, renderEstimate, entryAnnualPrice } from './format';
import { SCENARIOS, buildScenarioInputs } from './scenarios';
import { calculate } from './calc-client';
import { getProvidersMap } from './data/providers';

interface PlanPrice {
  amount: number | null;
  annualAmount: number | null;
  type: 'exact' | 'starting_at' | 'range' | null;
  planName: string;
}

function cheapestPaidPrice(p: ProviderData): PlanPrice | null {
  // Include quote-only plans here; for opaque vendors, the quote-only core
  // product is the meaningful "entry tier" a buyer is evaluating, not some
  // ancillary product with a published price.
  const paid = p.plans.filter((pl) => !pl.is_free);
  if (paid.length === 0) return null;
  const sorted = [...paid].sort(
    (a, b) => (a.monthly_price.amount ?? Number.POSITIVE_INFINITY) - (b.monthly_price.amount ?? Number.POSITIVE_INFINITY),
  );
  const c = sorted[0];
  return {
    amount: c.monthly_price.amount,
    annualAmount: entryAnnualPrice(c),
    type: c.monthly_price.type ?? null,
    planName: c.name,
  };
}

function priceLabel(pp: PlanPrice | null): string {
  if (!pp) return 'no published paid plan';
  // Strip parenthetical clauses from plan names so the prose reads cleanly,
  // e.g., "AvaTax (core tax calculation engine)" → "AvaTax".
  const name = pp.planName.replace(/\s*\([^)]+\)\s*$/, '').trim();
  if (pp.amount == null) return `${name} is quote-only`;
  if (pp.amount === 0) return `${name} has no monthly subscription fee`;
  const verb = pp.type === 'starting_at' ? 'starts at' : 'is';
  const annualSuffix = pp.annualAmount != null ? ` (${money(pp.annualAmount)}/year)` : '';
  return `${name} ${verb} ${money(pp.amount)}/month${annualSuffix}`;
}

export interface PairSummaryOptions {
  /**
   * Prefix with "How does A pricing compare to B?". True for page prose and
   * meta descriptions. FALSE for the FAQ answer, where that string is already
   * the entry's `q` and repeating it stutters on all 28 comparison pages.
   */
  includeQuestion?: boolean;
}

export function pairSummary(
  a: ProviderData,
  b: ProviderData,
  opts: PairSummaryOptions = {},
): string {
  const { includeQuestion = true } = opts;
  const ap = cheapestPaidPrice(a);
  const bp = cheapestPaidPrice(b);
  const aName = a.provider.name;
  const bName = b.provider.name;

  const opening = `How does ${aName} pricing compare to ${bName}?`;

  // Cheaper-of-the-two sentence, only when both prices are known and numeric
  let cheaperSentence = '';
  if (ap?.amount != null && bp?.amount != null && ap.amount !== bp.amount) {
    const cheaper = ap.amount < bp.amount ? aName : bName;
    cheaperSentence = ` At the entry tier, ${cheaper} is the cheaper option.`;
  }

  const intro = `${aName}'s ${priceLabel(ap)}; ${bName}'s ${priceLabel(bp)}.${cheaperSentence}`;

  // Per-filing / per-transaction differentiator
  const extras: string[] = [];
  if (a.filings?.has_per_filing_fee && b.filings?.has_per_filing_fee) {
    const aFee = a.filings.base_cost?.amount;
    const bFee = b.filings.base_cost?.amount;
    if (aFee != null && bFee != null) {
      extras.push(`Both charge per-state filing fees: ${money(aFee)} for ${aName}, ${money(bFee)} for ${bName}.`);
    }
  } else if (a.filings?.has_per_filing_fee) {
    extras.push(`${aName} charges per-state filing fees; ${bName} does not.`);
  } else if (b.filings?.has_per_filing_fee) {
    extras.push(`${bName} charges per-state filing fees; ${aName} does not.`);
  }

  if (a.transaction_fees?.has_transaction_fee || b.transaction_fees?.has_transaction_fee) {
    const aBps = a.transaction_fees?.has_transaction_fee && a.transaction_fees.rate != null
      ? `${a.transaction_fees.rate} ${a.transaction_fees.rate_unit}`
      : null;
    const bBps = b.transaction_fees?.has_transaction_fee && b.transaction_fees.rate != null
      ? `${b.transaction_fees.rate} ${b.transaction_fees.rate_unit}`
      : null;
    if (aBps && bBps) {
      extras.push(`Both also charge a per-transaction fee (${aBps} and ${bBps} respectively).`);
    } else if (aBps) {
      extras.push(`${aName} also charges a per-transaction fee (${aBps}); ${bName} does not.`);
    } else if (bBps) {
      extras.push(`${bName} also charges a per-transaction fee (${bBps}); ${aName} does not.`);
    }
  }

  return [includeQuestion ? opening : null, intro, ...extras].filter(Boolean).join(' ');
}

/**
 * TL;DR sentence for the top of a pair page. One direct sentence answering
 * "at a typical mid-market profile, which is cheaper and by how much."
 * The single most-citable answer on the page. Returns null if either side
 * isn't a numeric exact/starting-at estimate (e.g. quote-only).
 */
export function pairTldr(a: ProviderData, b: ProviderData): string | null {
  const midMarket = SCENARIOS.find((s) => s.name === 'Mid-Market');
  if (!midMarket) return null;
  try {
    const inputs = buildScenarioInputs(midMarket);
    const results = calculate(inputs, getProvidersMap());
    const aR = results.find((r) => r.slug === a.provider.slug);
    const bR = results.find((r) => r.slug === b.provider.slug);
    if (!aR || !bR) return null;
    const aName = a.provider.name;
    const bName = b.provider.name;
    // `renderEstimate` prefixes floors with "From", which collides with the
    // "runs about" phrasing below. Say "starts at $X" for floors instead.
    const phrase = (r: typeof aR, name: string) =>
      r.estimate.type === 'starting_at'
        ? `${name} starts at ${money(r.estimate.annualCostUSD)}`
        : `${name} runs about ${renderEstimate(r.estimate)}`;
    const profile =
      `${midMarket.annualOrders.toLocaleString()} orders/year, ${midMarket.annualFilings} filings, ` +
      `${midMarket.statesFiling} states with ${midMarket.sstEligibleStates} SST, on Shopify`;
    // Only quote a winner when both estimates are exact dollar figures.
    const aIsExact = aR.estimate.type === 'exact' || aR.estimate.type === 'starting_at';
    const bIsExact = bR.estimate.type === 'exact' || bR.estimate.type === 'starting_at';
    if (aIsExact && bIsExact) {
      const aAnn = (aR.estimate as { annualCostUSD: number }).annualCostUSD;
      const bAnn = (bR.estimate as { annualCostUSD: number }).annualCostUSD;
      const cheaper = aAnn < bAnn ? aName : bName;
      const diff = Math.abs(aAnn - bAnn);
      return (
        `At a typical mid-market profile (${profile}), ${phrase(aR, aName)}/year ` +
        `and ${phrase(bR, bName)}/year, making ${cheaper} the cheaper option by ` +
        `${money(diff)} per year for this profile.`
      );
    }
    return (
      `At a typical mid-market profile (${profile}), ${phrase(aR, aName)}/year ` +
      `and ${phrase(bR, bName)}/year.`
    );
  } catch {
    return null;
  }
}

/**
 * "Which is cheaper, X or Y?" Used in FAQ. Returns null if no clean answer.
 */
export function whichIsCheaper(a: ProviderData, b: ProviderData): string {
  const ap = cheapestPaidPrice(a);
  const bp = cheapestPaidPrice(b);
  const aName = a.provider.name;
  const bName = b.provider.name;

  if (ap?.amount != null && bp?.amount != null && ap.amount !== bp.amount) {
    const cheaper = ap.amount < bp.amount ? aName : bName;
    const lo = Math.min(ap.amount, bp.amount);
    const hi = Math.max(ap.amount, bp.amount);
    return `${cheaper} at the entry tier, ${money(lo)}/mo vs. ${money(hi)}/mo. But the entry-tier price isn't the whole picture: per-filing fees, transaction fees, and registration costs all shift the math. Run the calculator with your real numbers to see which adds up to less for your business.`;
  }
  if (ap?.amount != null && bp?.amount == null) {
    return `${aName} publishes a starting price (${money(ap.amount)}/mo); ${bName} doesn't publish entry-tier pricing, so a real head-to-head means getting a quote from ${bName} first.`;
  }
  if (bp?.amount != null && ap?.amount == null) {
    return `${bName} publishes a starting price (${money(bp.amount)}/mo); ${aName} doesn't publish entry-tier pricing, so a real head-to-head means getting a quote from ${aName} first.`;
  }
  return `Neither ${aName} nor ${bName} publishes a comparable entry-tier price. You'll need quotes from both before a direct comparison is possible.`;
}

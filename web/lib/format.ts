import type { CostEstimate } from '../../calculator/src/types';
import type { ProviderData } from '../../calculator/src/data/types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Ensure a fragment ends with exactly one terminal period. Authored fields
 * (plan taglines, target_icp) are written as complete sentences and already
 * end in ".", so templates that appended their own produced artifacts like
 * "…order volume.." and "…small and predictable..".
 */
export function terminate(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : t + '.';
}

export function money(n: number): string {
  return usd.format(n);
}

export function moneyRange(min: number, max: number): string {
  return `${money(min)}–${money(max)}`;
}

/**
 * Render a CostEstimate as a single human-readable string. UI components can
 * also branch on `type` directly if they want richer rendering (e.g., a "from"
 * prefix in smaller type).
 */
export function renderEstimate(e: CostEstimate): string {
  switch (e.type) {
    case 'exact':
      return money(e.annualCostUSD);
    case 'starting_at':
      return `From ${money(e.annualCostUSD)}`;
    case 'range':
      return moneyRange(e.annualCostMinUSD, e.annualCostMaxUSD);
    case 'quote_required':
      return e.startingAtUSD
        ? `Quote required (from ${money(e.startingAtUSD)})`
        : 'Quote required';
  }
}

/**
 * Resolve an annual figure for a plan's entry-tier price. Used to show both
 * monthly and annual on "starts at $X/mo" surfaces. Order of preference:
 *   1. plan.annual_price.amount (explicit annual rate)
 *   2. plan.order_tiers[0].annual_price (tier-specific annual rate, e.g. TaxJar)
 *   3. monthly × 12 × (1 - discount_pct/100), if a discount is published
 * Returns null when no defensible annual number can be derived.
 */
export function entryAnnualPrice(plan: ProviderData['plans'][number]): number | null {
  if (typeof plan.annual_price?.amount === 'number') return plan.annual_price.amount;
  const firstTier = plan.order_tiers?.[0];
  if (typeof firstTier?.annual_price === 'number') return firstTier.annual_price;
  const monthly = plan.monthly_price?.amount;
  const discountPct = plan.annual_price?.discount_pct_vs_monthly;
  if (typeof monthly === 'number' && typeof discountPct === 'number') {
    return Math.round(monthly * 12 * (1 - discountPct / 100));
  }
  return null;
}

/**
 * For sorting / "from X" labels on cards.
 */
export function estimateFloor(e: CostEstimate): number {
  switch (e.type) {
    case 'exact':
    case 'starting_at':
      return e.annualCostUSD;
    case 'range':
      return e.annualCostMinUSD;
    case 'quote_required':
      return e.startingAtUSD ?? Number.POSITIVE_INFINITY;
  }
}

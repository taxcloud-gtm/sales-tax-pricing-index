import type { ProviderData } from '../../../calculator/src/data/types';
import { terminate } from '../format';
import { absoluteUrl } from '../utils';
import { providerPath } from '../slugs';

/**
 * Schema.org Product with one Offer per published plan AND one nested Offer
 * per order_tier within each plan when the plan publishes a tier ladder.
 *
 * The per-tier offers give LLMs the full pricing ladder as structured data
 * rather than just the entry-tier "starting at $X" price. Each tier-level
 * Offer is named with the volume threshold and carries `eligibleQuantity`
 * for the order count so LLMs can cite the right price for a buyer's volume.
 *
 * For range pricing (opaque vendors), use AggregateOffer.
 */
export function productJsonLd(p: ProviderData) {
  const plans = p.plans;
  const allOffers: Array<Record<string, unknown>> = [];

  for (const pl of plans) {
    const mp = pl.monthly_price;

    // Range-priced plans → single AggregateOffer (Avalara-style)
    if (mp.type === 'range' && mp.range_min != null && mp.range_max != null) {
      allOffers.push({
        '@type': 'AggregateOffer',
        name: pl.name,
        description: pl.tagline ?? undefined,
        lowPrice: mp.range_min,
        highPrice: mp.range_max,
        priceCurrency: 'USD',
        offerCount: 1,
        availability: 'https://schema.org/InStock',
        url: mp.source,
      });
      continue;
    }

    // Transparent paid plans → one Offer per order tier if a ladder exists,
    // otherwise one Offer at the plan's entry price.
    if (mp.type !== 'exact' && mp.type !== 'starting_at') continue;
    if (typeof mp.amount !== 'number') continue;

    const tiers = pl.order_tiers ?? [];
    if (tiers.length > 1) {
      for (const tier of tiers) {
        const annualEquivalent = tier.included_orders * 12;
        allOffers.push({
          '@type': 'Offer',
          name: `${pl.name} — up to ${annualEquivalent.toLocaleString()} orders/year`,
          description:
            (pl.tagline ? `${terminate(pl.tagline)} ` : '') +
            `Tier covers up to ${tier.included_orders.toLocaleString()} orders/month ` +
            `(${annualEquivalent.toLocaleString()} orders/year).`,
          price: String(tier.monthly_price),
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: tier.monthly_price,
            priceCurrency: 'USD',
            unitText: 'MONTH',
            ...(typeof tier.annual_price === 'number' && {
              billingDuration: 'P1Y',
              billingIncrement: 1,
            }),
          },
          // Capture the buyer's eligible-quantity threshold so LLMs can map
          // "I do X orders" → the right tier.
          eligibleQuantity: {
            '@type': 'QuantitativeValue',
            maxValue: annualEquivalent,
            unitText: 'orders per year',
          },
          availability: 'https://schema.org/InStock',
          url: tier.source ?? mp.source,
        });
      }
    } else {
      // Plan with no tier ladder (or only an entry tier) — emit a single Offer
      // at the plan's base price.
      allOffers.push({
        '@type': 'Offer',
        name: pl.name,
        description: pl.tagline ?? undefined,
        price: String(mp.amount),
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: mp.amount,
          priceCurrency: 'USD',
          unitText: 'MONTH',
          ...(mp.type === 'starting_at' && { minPrice: mp.amount }),
        },
        availability: 'https://schema.org/InStock',
        url: mp.source,
      });
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.provider.name,
    // Use the public target-ICP description only. `competitive_position` is
    // internal GTM framing and must never ship in public schema/payload.
    description: p.provider.target_icp ?? undefined,
    brand: {
      '@type': 'Brand',
      name: p.provider.name,
    },
    url: absoluteUrl(providerPath(p.provider.slug)),
    sameAs: p.provider.primary_url,
    ...(allOffers.length === 1
      ? { offers: allOffers[0] }
      : allOffers.length > 1
        ? { offers: allOffers }
        : {}),
  };
}

import type { ProviderData } from '../../../calculator/src/data/types';
import { money, entryAnnualPrice } from '@/lib/format';

function priceCell(plan: ProviderData['plans'][number]): React.ReactNode {
  const mp = plan.monthly_price;
  if (plan.is_free) return 'Free';
  if (plan.is_quote_only) return 'Quote required';

  if (mp.type === 'range' && mp.range_min != null && mp.range_max != null) {
    return (
      <span>
        {money(mp.range_min)}–{money(mp.range_max)}
        <span className="text-ink-subtle text-xs ml-1">/mo</span>
      </span>
    );
  }
  if (mp.amount != null) {
    const annual = entryAnnualPrice(plan);
    return (
      <span>
        {mp.type === 'starting_at' && <span className="text-ink-subtle text-xs">from </span>}
        {money(mp.amount)}
        <span className="text-ink-subtle text-xs ml-1">/mo</span>
        {annual != null && (
          <span className="text-ink-subtle text-xs ml-1.5 whitespace-nowrap">
            · {money(annual)}/yr
          </span>
        )}
      </span>
    );
  }
  return <span className="text-ink-subtle">Not published</span>;
}

function includedCell(plan: ProviderData['plans'][number]): React.ReactNode {
  const parts: string[] = [];
  const firstTier = plan.order_tiers?.[0];
  if (firstTier?.included_orders) parts.push(`${firstTier.included_orders.toLocaleString()} orders/mo`);
  if (plan.included_states != null) parts.push(`${plan.included_states} states`);
  if (plan.included_integrations != null) parts.push(`${plan.included_integrations} integrations`);
  if (plan.api_access_included) parts.push('API access');
  if (parts.length === 0) return <span className="text-ink-subtle">—</span>;
  return parts.join(' · ');
}

/**
 * Order-tier ladder for plans that have one (e.g. TaxCloud, TaxJar).
 * Renders the full price-by-volume table so annual totals are reproducible
 * from the page without needing to open the calculator.
 */
function OrderTierLadder({ plan }: { plan: ProviderData['plans'][number] }) {
  const tiers = plan.order_tiers;
  if (!tiers || tiers.length <= 1) return null;

  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer text-ink-subtle hover:text-accent select-none">
        Full order-volume pricing ({tiers.length} tiers) ▸
      </summary>
      <div className="overflow-x-auto mt-3">
        <table className="text-xs border-collapse w-full max-w-lg">
          <thead>
            <tr className="rule-bottom">
              <th className="text-left py-2 pr-4 small-caps text-ink-subtle">Orders / mo</th>
              <th className="text-left py-2 px-3 small-caps text-ink-subtle">Monthly</th>
              <th className="text-left py-2 px-3 small-caps text-ink-subtle">Annual</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={i} className="rule-bottom">
                <td className="py-2 pr-4 text-ink-muted font-mono">
                  {tier.included_orders != null
                    ? `≤ ${tier.included_orders.toLocaleString()}`
                    : 'Custom'}
                </td>
                <td className="py-2 px-3 text-ink font-mono">
                  {tier.monthly_price > 0 ? money(tier.monthly_price) : '—'}
                </td>
                <td className="py-2 px-3 text-ink font-mono">
                  {tier.annual_price != null
                    ? money(tier.annual_price)
                    : tier.monthly_price > 0
                      ? money(tier.monthly_price * 12)
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-ink-subtle">
        Annual rate is subscription only — filings, registrations, and add-ons calculated separately.
      </p>
    </details>
  );
}

export function PricingTable({ provider }: { provider: ProviderData }) {
  return (
    <section className="my-12">
      <h2 className="text-subhed mb-4">Plans &amp; published pricing</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="rule-bottom">
              <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Plan</th>
              <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Subscription</th>
              <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Includes</th>
              <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Source</th>
            </tr>
          </thead>
          <tbody>
            {provider.plans.map((plan) => (
              <tr key={plan.slug} className="rule-bottom align-top">
                <td className="py-4 pr-4">
                  <p className="font-serif font-semibold text-ink">{plan.name}</p>
                  {plan.tagline && <p className="text-ink-subtle text-xs mt-1 max-w-xs">{plan.tagline}</p>}
                  <OrderTierLadder plan={plan} />
                </td>
                <td className="py-4 px-4 text-ink whitespace-nowrap">{priceCell(plan)}</td>
                <td className="py-4 px-4 text-ink-muted">{includedCell(plan)}</td>
                <td className="py-4 px-4">
                  <a
                    href={plan.monthly_price.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs no-underline text-ink-subtle hover:text-accent"
                    title={`Source: ${plan.monthly_price.source}`}
                  >
                    [{plan.monthly_price.confidence}] ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle mt-3">
        Source confidence: <a href="/methodology" className="no-underline hover:text-accent">A = vendor pricing page, B = help center, C = third-party aggregator, G = estimated</a>.
      </p>
    </section>
  );
}

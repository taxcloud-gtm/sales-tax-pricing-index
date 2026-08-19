import type { ProviderData } from '../../../calculator/src/data/types';
import { calculate } from '@/lib/calc-client';
import { getProvidersMap } from '@/lib/data/providers';
import { renderEstimate } from '@/lib/format';
import { SCENARIOS, buildScenarioInputs } from '@/lib/scenarios';

export function ProviderExampleScenarios({ provider }: { provider: ProviderData }) {
  const providers = getProvidersMap();
  const name = provider.provider.name;

  return (
    <section className="my-12">
      <h2 className="text-subhed mb-3">Typical {name} pricing</h2>
      <p className="text-ink-muted text-sm max-w-prose mb-6">
        Headline prices like &ldquo;starts at $X&rdquo; rarely match what a real ecommerce
        brand pays. Here&apos;s what {name} costs for two typical profiles. Both assume
        Shopify, monthly filing cadence, annual billing, and a typical $120 AOV.
        Plug in your own numbers in the{' '}
        <a href="/calculator" className="no-underline hover:text-accent">calculator</a>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SCENARIOS.map((scenario) => {
          const results = calculate(buildScenarioInputs(scenario), providers);
          const result = results.find((r) => r.slug === provider.provider.slug);
          if (!result) return null;

          return (
            <div key={scenario.name} className="bg-paper-raised border border-rule p-5">
              <p className="small-caps text-xs text-ink-subtle">{scenario.name}</p>
              <p className="text-sm text-ink-muted mt-1 mb-5">{scenario.description}</p>
              <div className="space-y-1">
                <p className="font-mono text-2xl font-semibold text-ink">
                  {renderEstimate(result.estimate)}
                  <span className="text-xs font-sans text-ink-subtle ml-2">/ year</span>
                </p>
                <p className="text-xs text-ink-subtle">
                  Recommended plan: <span className="text-ink">{result.recommendedPlan}</span>
                </p>
              </div>
              {result.breakdown && (
                <dl className="mt-5 pt-4 rule-top grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-ink-muted">
                  <dt>Subscription</dt>
                  <dd>${Math.round(result.breakdown.subscription).toLocaleString()}</dd>
                  <dt>Filings</dt>
                  <dd>${Math.round(result.breakdown.filings).toLocaleString()}</dd>
                  {typeof result.breakdown.sstSavings === 'number' && result.breakdown.sstSavings > 0 && (
                    <>
                      <dt className="text-accent">SST savings</dt>
                      <dd className="text-accent">−${Math.round(result.breakdown.sstSavings).toLocaleString()}</dd>
                    </>
                  )}
                  {result.breakdown.transactions > 0 && (
                    <>
                      <dt>Transactions</dt>
                      <dd>${Math.round(result.breakdown.transactions).toLocaleString()}</dd>
                    </>
                  )}
                  {result.breakdown.registrations > 0 && (
                    <>
                      <dt>Registrations</dt>
                      <dd>${Math.round(result.breakdown.registrations).toLocaleString()}</dd>
                    </>
                  )}
                  {result.breakdown.addOns > 0 && (
                    <>
                      <dt>Add-ons</dt>
                      <dd>${Math.round(result.breakdown.addOns).toLocaleString()}</dd>
                    </>
                  )}
                  {result.breakdown.implementation > 0 && (
                    <>
                      <dt>Implementation</dt>
                      <dd>${Math.round(result.breakdown.implementation).toLocaleString()}</dd>
                    </>
                  )}
                </dl>
              )}

              {/* Caveats travel with the number. These used to render only in
                  the calculator's own provider cards, so the figure most likely
                  to be quoted (this one) appeared with no qualification at all
                  on the page most likely to be cited. */}
              {result.caveats && result.caveats.length > 0 && (
                <div className="mt-5 pt-4 rule-top">
                  <p className="small-caps text-[11px] text-ink-subtle mb-2">
                    What this estimate assumes
                  </p>
                  <ul className="space-y-1.5 text-xs text-ink-muted leading-snug">
                    {result.caveats.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden className="text-ink-subtle">&middot;</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

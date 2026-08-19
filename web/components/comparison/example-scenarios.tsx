import type { ProviderData } from '../../../calculator/src/data/types';
import { calculate } from '@/lib/calc-client';
import { getProvidersMap } from '@/lib/data/providers';
import { renderEstimate } from '@/lib/format';
import { providerPath } from '@/lib/slugs';
import { SCENARIOS, buildScenarioInputs } from '@/lib/scenarios';

export function ExampleScenarios({ a, b }: { a: ProviderData; b: ProviderData }) {
  const providers = getProvidersMap();
  const aName = a.provider.name;
  const bName = b.provider.name;

  return (
    <section className="my-12">
      <h2 className="text-subhed mb-3">{aName} vs {bName}: typical pricing</h2>
      <p className="text-ink-muted text-sm max-w-prose mb-6">
        Annual cost for two common ecommerce profiles. Both assume Shopify, monthly filing
        cadence, annual billing, and a typical $120 AOV.{' '}
        <a href="/calculator" className="no-underline hover:text-accent">Run the calculator</a> to
        plug in your own numbers.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SCENARIOS.map((scenario) => {
          const results = calculate(buildScenarioInputs(scenario), providers);
          const aResult = results.find((r) => r.slug === a.provider.slug);
          const bResult = results.find((r) => r.slug === b.provider.slug);
          const ordered = [aResult, bResult].filter(Boolean);

          return (
            <div key={scenario.name} className="bg-paper-raised border border-rule p-5">
              <p className="small-caps text-xs text-ink-subtle">{scenario.name}</p>
              <p className="text-sm text-ink-muted mt-1 mb-5">{scenario.description}</p>
              <dl className="space-y-3">
                {ordered.map((r) =>
                  r ? (
                    <div
                      key={r.slug}
                      className="grid grid-cols-[1fr_auto] gap-3 items-baseline rule-bottom pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="font-serif font-semibold text-ink">{r.provider}</p>
                        <p className="text-xs text-ink-subtle">{r.recommendedPlan}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold text-ink whitespace-nowrap">
                        {renderEstimate(r.estimate)}
                      </p>
                      {/* Lead caveat only. Each calculator orders caveats with
                          the most decision-relevant one first (past the
                          published ladder, list-price-not-quote, region cap).
                          The full set lives on the provider page; showing all
                          of them for both providers here would bury the
                          comparison, but shipping the number with none at all
                          is how an unqualified figure gets quoted. */}
                      {r.caveats && r.caveats.length > 0 && (
                        <p className="col-span-2 text-xs text-ink-subtle leading-snug -mt-1">
                          {r.caveats[0]}{' '}
                          {r.caveats.length > 1 && (
                            <a
                              href={providerPath(r.slug)}
                              className="no-underline hover:text-accent whitespace-nowrap"
                            >
                              +{r.caveats.length - 1} more
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

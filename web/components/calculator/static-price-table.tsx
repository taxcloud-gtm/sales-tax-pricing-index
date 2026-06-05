/**
 * StaticPriceTable — server-rendered canonical price table for the calculator
 * page.
 *
 * Why this exists:
 *   The interactive calculator is client-rendered JS. LLMs and search crawlers
 *   see almost nothing without JS. This component renders a static, citeable
 *   table of all 8 providers × 2 profiles at build time, so the page has real
 *   content in the HTML payload. The interactive form stays; this sits above it
 *   as the crawlable ground truth.
 */
import type { ProviderData } from '../../../calculator/src/data/types';
import { calculate } from '@/lib/calc-client';
import { renderEstimate } from '@/lib/format';
import { SCENARIOS, buildScenarioInputs } from '@/lib/scenarios';
import { providerPath } from '@/lib/slugs';
import Link from 'next/link';

export function StaticPriceTable({ providers }: { providers: Map<string, ProviderData> }) {
  const rows = SCENARIOS.map((scenario) => {
    const results = calculate(buildScenarioInputs(scenario), providers);
    return { scenario, results };
  });

  // Use first scenario to get provider order (sorted by SMB cost)
  const providerOrder = rows[0].results.map((r) => r.slug);

  return (
    <section className="my-10">
      <h2 className="text-subhed mb-2">All-provider pricing at a glance</h2>
      <p className="text-ink-muted text-sm max-w-prose mb-6">
        Estimated annual cost for two representative ecommerce profiles, ranked
        cheapest to most expensive. Both assume Shopify integration, monthly
        filing cadence, and annual billing. SST savings applied where eligible.
        Adjust for your numbers using the calculator below.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="rule-bottom">
              <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle w-1/4">
                Provider
              </th>
              {SCENARIOS.map((s) => (
                <th key={s.name} className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">
                  <span className="text-ink font-semibold">{s.name}</span>
                  <span className="block font-normal text-ink-subtle mt-0.5">{s.description}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providerOrder.map((slug) => {
              const smb = rows[0].results.find((r) => r.slug === slug)!;
              const mid = rows[1].results.find((r) => r.slug === slug)!;
              return (
                <tr key={slug} className="rule-bottom align-top hover:bg-paper-raised/60 transition-colors">
                  <td className="py-4 pr-4">
                    <Link
                      href={providerPath(slug)}
                      className="font-semibold text-ink no-underline hover:text-accent"
                    >
                      {smb.provider}
                    </Link>
                  </td>
                  <td className="py-4 px-4 font-mono text-ink">
                    {renderEstimate(smb.estimate)}
                    <span className="text-xs font-sans text-ink-subtle ml-1">/yr</span>
                  </td>
                  <td className="py-4 px-4 font-mono text-ink">
                    {renderEstimate(mid.estimate)}
                    <span className="text-xs font-sans text-ink-subtle ml-1">/yr</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle mt-3">
        Opaque vendors (Avalara, Zamp) shown as observed ranges from buyer data.{' '}
        <Link href="/methodology" className="no-underline hover:text-accent">
          Methodology
        </Link>{' '}
        · Last updated based on each provider&apos;s most recently verified source.
      </p>
    </section>
  );
}

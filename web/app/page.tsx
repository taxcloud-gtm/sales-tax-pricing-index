import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { StaticPriceTable } from '@/components/calculator/static-price-table';
import { midMarketSpread, costSpreadSentence, costSpreadItemListJsonLd } from '@/lib/cost-spread';
import { providerPath, pairPath } from '@/lib/slugs';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { datasetJsonLd } from '@/lib/jsonld/dataset';

// The root URL had no canonical and no prices at all. Both fixed below.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description:
    'What sales tax compliance software actually costs, with every price traced to a public source. Ranked annual cost for TaxCloud, Avalara, TaxJar, Numeral, Kintsugi, Anrok, Sphere and Zamp.',
};

const FEATURED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['avalara', 'taxjar'],
  ['avalara', 'zamp'],
  ['anrok', 'numeral'],
  ['taxcloud', 'avalara'],
  ['kintsugi', 'numeral'],
  ['taxjar', 'taxcloud'],
  ['taxcloud', 'zamp'],
];

export default function HomePage() {
  const providers = getAllProviders();
  const providersMap = getProvidersMap();
  const date = lastUpdatedAcross(providers);
  const dataset = datasetJsonLd(providers);
  const spread = midMarketSpread(providersMap);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
      {spread && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(costSpreadItemListJsonLd(spread)),
          }}
        />
      )}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-accent-subtle text-accent px-3 py-1 text-xs font-semibold">
            A sourced comparison
          </span>
          <h1 className="text-display mt-6">Pricing for every sales tax compliance platform, in one place.</h1>
          <p className="mt-6 text-lg text-ink-muted leading-relaxed">
            Compare pricing for all of the top sales tax compliance platforms in one place.
            Pricing data compiled from vendor pricing pages and documentation, third-party
            review sites, and online forum discussions.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/calculator"
              className="inline-flex items-center px-5 py-2.5 bg-accent text-paper rounded-lg no-underline hover:bg-accent-hover font-semibold text-sm shadow-card hover:shadow-card-hover transition-all"
            >
              Open the calculator
            </Link>
            <Link href="/methodology" className="text-sm text-ink-muted hover:text-ink no-underline">
              How we source data →
            </Link>
          </div>
          <div className="mt-6">
            <UpdatedBadge date={date} />
          </div>
        </div>
      </section>

      {/* What it costs — the citable answer. This sits directly under the hero
          because the root URL is the page most likely to be quoted as "the
          source", and it previously carried no prices and no table at all. */}
      {spread && (
        <section className="mx-auto max-w-6xl px-6">
          <StaticPriceTable
            providers={providersMap}
            heading="How much does sales tax compliance software cost?"
            lead={
              <>
                <p className="text-ink text-base leading-relaxed max-w-prose mb-4">
                  {costSpreadSentence(spread)}
                </p>
                <p className="text-ink-muted text-sm max-w-prose mb-6">
                  Both profiles assume Shopify, monthly filing cadence, and annual
                  billing. SST savings applied where eligible. Every figure below traces
                  to a public source.{' '}
                  <Link href="/calculator" className="no-underline hover:text-accent">
                    Run your own numbers
                  </Link>
                  .
                </p>
              </>
            }
          />
        </section>
      )}

      {/* All providers */}
      <section className="mx-auto max-w-6xl px-6 my-16">
        <p className="text-sm text-ink-muted max-w-prose mb-8">
          Two of the eight are Certified Service Providers in the Streamlined Sales Tax
          Program, which means member states pay them directly for filing on behalf of
          qualifying sellers.{' '}
          <Link href="/sst-csp-savings" className="text-accent hover:text-accent-hover">
            What CSP status is worth
          </Link>
          .
        </p>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-subhed">All tracked providers</h2>
          <p className="text-xs text-ink-subtle small-caps">8 providers · sourced pricing</p>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providers.map((p) => (
            <li key={p.provider.slug}>
              <Link
                href={providerPath(p.provider.slug)}
                className="block p-5 card card-hover no-underline h-full"
              >
                <p className="font-sans font-bold text-ink">{p.provider.name}</p>
                <p className="text-[11px] text-ink-subtle small-caps mt-1">{p.transparency.tier}</p>
                <p className="text-xs text-ink-muted mt-2 line-clamp-2">{p.provider.target_icp}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured comparisons */}
      <section className="mx-auto max-w-6xl px-6 my-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-subhed">The comparisons people actually search for</h2>
          <Link href="#all-pairs" className="text-xs text-ink-subtle small-caps no-underline hover:text-ink">
            All 28 pairings ↓
          </Link>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURED_PAIRS.map(([a, b]) => {
            const aP = providers.find((p) => p.provider.slug === a)!;
            const bP = providers.find((p) => p.provider.slug === b)!;
            return (
              <li key={`${a}-${b}`}>
                <Link
                  href={pairPath(a, b)}
                  className="block p-5 card card-hover no-underline"
                >
                  <p className="font-sans font-bold text-ink">
                    {aP.provider.name} <span className="text-ink-subtle font-normal">vs</span> {bP.provider.name}
                  </p>
                  <p className="text-xs text-ink-muted mt-2">
                    Side-by-side pricing, fees, and what each one hides
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Why this site */}
      <section className="rule-top rule-bottom bg-paper-sunken my-16">
        <div className="mx-auto max-w-5xl px-6 py-16 grid md:grid-cols-3 gap-10">
          <div>
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-subtle text-accent text-lg font-bold mb-4">
              S
            </span>
            <h3 className="font-sans text-base font-bold">Every number traces back</h3>
            <p className="text-sm text-ink-muted mt-2">
              Each price links to where it came from: the vendor&apos;s pricing page, help center, or a buyer aggregator like Vendr or G2. Confidence ratings tell you how authoritative each source is.
            </p>
          </div>
          <div>
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-subtle text-accent text-lg font-bold mb-4">
              H
            </span>
            <h3 className="font-sans text-base font-bold">We don&apos;t invent prices</h3>
            <p className="text-sm text-ink-muted mt-2">
              For providers that hide their pricing, we publish ranges from real buyer contracts.
              We won&apos;t fake a point estimate. &ldquo;Quote required&rdquo; means quote required.
            </p>
          </div>
          <div>
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-subtle text-accent text-lg font-bold mb-4">
              D
            </span>
            <h3 className="font-sans text-base font-bold">You should know who runs this</h3>
            <p className="text-sm text-ink-muted mt-2">
              Operated by TaxCloud, Inc., one of the eight providers compared here.{' '}
              <Link href="/methodology#ownership" className="text-accent hover:text-accent-hover">
                Full disclosure
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* All 28 pairs */}
      <section id="all-pairs" className="mx-auto max-w-6xl px-6 my-16">
        <h2 className="text-subhed mb-6">All pairwise comparisons</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          {providers.flatMap((a, i) =>
            providers.slice(i + 1).map((b) => (
              <li key={`${a.provider.slug}-${b.provider.slug}`}>
                <Link
                  href={pairPath(a.provider.slug, b.provider.slug)}
                  className="block px-3 py-2 rounded border border-rule no-underline text-ink-muted hover:border-accent hover:text-accent hover:bg-accent-subtle/40 transition-colors"
                >
                  {a.provider.name} vs {b.provider.name}
                </Link>
              </li>
            )),
          )}
        </ul>
      </section>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { StaticPriceTable } from '@/components/calculator/static-price-table';
import { providerPath } from '@/lib/slugs';
import { money, renderEstimate } from '@/lib/format';
import { absoluteUrl } from '@/lib/utils';
import {
  canonicalBands,
  costAnswerSentence,
  entryPoints,
  pricingFamilies,
  shortCostAnswer,
  unpricedItems,
} from '@/lib/head-terms/cost-answer';

const TITLE = 'How much does sales tax software cost?';

export function generateMetadata(): Metadata {
  const providers = getAllProviders();
  const bands = canonicalBands(getProvidersMap());
  return {
    title: `${TITLE} · 2026 pricing, every tracked platform`,
    description: shortCostAnswer(bands) || `Annual cost for ${providers.length} US sales tax compliance platforms, with every price traced to a public source.`,
    alternates: { canonical: '/how-much-does-sales-tax-software-cost' },
    openGraph: {
      title: TITLE,
      description: shortCostAnswer(bands),
      url: absoluteUrl('/how-much-does-sales-tax-software-cost'),
      type: 'article',
    },
  };
}

export default function CostPage() {
  const providers = getAllProviders();
  const providersMap = getProvidersMap();
  const date = lastUpdatedAcross(providers);
  const bands = canonicalBands(providersMap);
  const families = pricingFamilies(providers);
  const entries = entryPoints(providers);
  const unpriced = unpricedItems(providers);
  const answer = costAnswerSentence(bands, providers.length, families);

  const overallLow = bands.length ? Math.min(...bands.map((b) => b.low)) : 0;
  const overallHigh = bands.length ? Math.max(...bands.map((b) => b.high)) : 0;

  const faqs: Array<{ q: string; a: string }> = [
    { q: TITLE, a: shortCostAnswer(bands) },
    {
      q: 'What is the cheapest sales tax software?',
      a: `On published pricing, for the profiles modeled on this site, ${bands[0] ? `${bands[0].cheapest.provider} at ${renderEstimate(bands[0].cheapest.estimate).replace(/^From /, 'from ')} per year for an SMB profile` : 'the answer depends on profile'}. That is a list-price comparison, not a like-for-like one: the platforms differ in what the price includes, and the vendors publish very different amounts of pricing, so some positions are prices and some are floors or observed ranges. The profile-by-profile breakdown, including the profiles where the answer changes, is at /cheapest-sales-tax-software.`,
    },
    {
      q: 'Why is the price range so wide for the same work?',
      a: `Because the pricing models are not comparable. The ${providers.length} platforms split into ${families.length} models: ${families.map((f) => `${f.label} (${f.members.map((m) => m.provider.name).join(', ')})`).join('; ')}. A business filing 240 returns across 20 states pays very differently under per-filing pricing than under per-state pricing, even though the compliance work is identical.`,
    },
    {
      q: 'Is sales tax software priced per state or per filing?',
      a: `Both, and neither is universal. Across the ${providers.length} platforms tracked here there are ${families.length} distinct models: ${families.map((f) => `${f.members.length} use ${f.label.toLowerCase()} (${f.members.map((m) => m.provider.name).join(', ')})`).join('; ')}. Which one suits you depends on the shape of your business rather than its size. A wide, thin footprint favours per-filing pricing at a low filing cadence and is punished by it at a monthly one. High volume concentrated in a few states favours per-state pricing. No platform in this set prices on a straight percentage of revenue.`,
    },
    {
      q: 'What costs are not included in a sales tax software subscription?',
      a: `Four things, none of them in a subscription price: ${unpriced.map((u) => u.label).join('; ')}. State permit fees are charged by the state and pass straight through. Implementation is either free or unrecorded at most vendors in this set, and reaches five figures at the enterprise end. Overage rates above the included volume are the least-published number in the category.`,
    },
    {
      q: 'Do I need sales tax software at all?',
      a: `If you file in one or two states with low order volume, filing directly through each state's portal is free and many businesses do exactly that. Software starts paying for itself when the number of returns, the number of jurisdictions, or the taxability complexity of what you sell makes manual filing a recurring drain. This site does not model the cost of doing it yourself, because the honest input is your own team's hours and only you have that number.`,
    },
    {
      q: 'How much does sales tax software cost for a small business?',
      a: bands[0]
        ? `For ${bands[0].profile.inputSummary}, the ${providers.length} tracked platforms run from ${renderEstimate(bands[0].cheapest.estimate)} to ${renderEstimate(bands[0].priciest.estimate)} per year, with the middle of the ranked list at about ${money(bands[0].median)}. Below that volume, several platforms have free tiers that cover monitoring and calculation but not filing.`
        : '',
    },
  ].filter((f) => f.a);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: TITLE,
      description: answer,
      url: absoluteUrl('/how-much-does-sales-tax-software-cost'),
      ...(date ? { dateModified: date, datePublished: date } : {}),
      about: { '@type': 'Thing', name: 'Sales tax compliance software pricing' },
      publisher: { '@type': 'Organization', name: 'TaxCloud, Inc.', url: 'https://taxcloud.com' },
      isBasedOn: providers
        .flatMap((p) => p.sources ?? [])
        .filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i)
        .slice(0, 12)
        .map((s) => ({ '@type': 'WebPage', url: s.url, name: s.title ?? s.url })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Table',
      name: 'Annual cost of sales tax compliance software, by buyer profile',
      description: answer,
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }} />
      ))}

      <header>
        <p className="small-caps text-xs text-ink-subtle">Category pricing</p>
        <h1 className="text-hed mt-2">{TITLE}</h1>
        <div className="mt-3">
          <UpdatedBadge date={date} />
        </div>
      </header>

      <Tldr>{answer}</Tldr>

      {/* The band table: the fastest possible answer, self-contained. */}
      <section className="my-12">
        <h2 className="text-subhed mb-4">The short answer, by buyer profile</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Profile</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Annual range</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Middle of the list</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Spread</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.profile.key} className="rule-bottom align-top">
                  <td className="py-4 pr-4">
                    <span className="font-semibold text-ink block">{b.profile.name}</span>
                    <span className="text-xs text-ink-subtle">{b.profile.inputSummary}</span>
                  </td>
                  <td className="py-4 px-4 font-mono text-ink whitespace-nowrap">
                    {money(b.low)} – {money(b.high)}
                  </td>
                  <td className="py-4 px-4 font-mono text-ink-muted whitespace-nowrap">{money(b.median)}</td>
                  <td className="py-4 px-4 text-ink-muted whitespace-nowrap">
                    {`${b.multiple >= 10 ? b.multiple.toFixed(0) : b.multiple.toFixed(1)}\u00d7`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-subtle mt-3">
          Both profiles assume Shopify, monthly filing cadence, and annual billing, with the SST
          Certified Service Provider credit applied where a seller would qualify.{' '}
          <Link href="/calculator" className="no-underline hover:text-accent">
            Change the assumptions
          </Link>
          .
        </p>
      </section>

      {/* Full ranked table for both canonical profiles. */}
      <StaticPriceTable
        providers={providersMap}
        heading="What each platform costs, ranked"
        lead={
          <p className="text-ink-muted text-sm max-w-prose mb-6">
            Estimated annual cost for the two profiles above. A vendor shown as a range is ordered
            by the midpoint of that range rather than its floor, so its row can sit above a
            published price that is lower. The{' '}
            <Link href="/cheapest-sales-tax-software" className="no-underline hover:text-accent">
              ranked comparison
            </Link>{' '}
            orders the same rows by floor instead, which moves those vendors up. Each provider name
            links to its full pricing page, plan ladder, and source list.
          </p>
        }
      />

      <section className="my-12">
        <h2 className="text-subhed mb-4">What actually drives the bill</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          The {overallHigh > 0 ? `${money(overallLow)} to ${money(overallHigh)}` : ''} spread is not
          a quality difference. It is {families.length} incompatible pricing models applied to the
          same work. The model matters more than the sticker price, because it decides what happens
          to your bill when the business changes.
        </p>
        <div className="space-y-8">
          {families.map((f) => (
            <div key={f.model} className="rule-bottom pb-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-sans text-base font-bold text-ink">{f.label}</h3>
                <p className="text-xs text-ink-subtle">
                  {f.members.map((m) => m.provider.name).join(', ')}
                </p>
              </div>
              <p className="text-sm text-ink mt-2">
                <strong className="text-ink">Bill moves with:</strong> {f.driver}
              </p>
              <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="small-caps text-[11px] text-ink-subtle">Works for</dt>
                  <dd className="text-ink-muted mt-1">{f.suits}</dd>
                </div>
                <div>
                  <dt className="small-caps text-[11px] text-ink-subtle">Works against</dt>
                  <dd className="text-ink-muted mt-1">{f.punishes}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">The cheapest way in with each platform</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          Entry price is the number vendors market and the number that least resembles a real bill,
          because filing is usually charged separately. Both halves are shown together here for that
          reason.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Platform</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Entry price</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">What it does and doesn&apos;t cover</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.provider.provider.slug} className="rule-bottom align-top">
                  <td className="py-4 pr-4">
                    <Link href={providerPath(e.provider.provider.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                      {e.provider.provider.name}
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-ink whitespace-nowrap">{e.headline}</td>
                  <td className="py-4 px-4 text-ink-muted">{e.covers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">What is not in any of these numbers</h2>
        <dl className="space-y-7">
          {unpriced.map((u) => (
            <div key={u.label} className="rule-bottom pb-6">
              <dt className="font-sans font-bold text-ink">{u.label}</dt>
              <dd className="text-sm text-ink-muted mt-2 max-w-prose">{u.detail}</dd>
              {u.clear.length > 0 && u.clearLabel && (
                <dd className="text-xs text-ink-subtle mt-3">
                  <span className="small-caps">{u.clearLabel}:</span> {u.clear.join('; ')}
                </dd>
              )}
              {u.unclear.length > 0 && u.unclearLabel && u.unclear.length < providers.length && (
                <dd className="text-xs text-ink-subtle mt-1.5">
                  <span className="small-caps">{u.unclearLabel}:</span> {u.unclear.join('; ')}
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-muted mt-6 max-w-prose">
          The full fee-by-fee breakdown, including which vendors charge something they do not put a
          number on, is at{' '}
          <Link href="/sales-tax-software-hidden-fees" className="no-underline hover:text-accent">
            sales tax software hidden fees
          </Link>
          .
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">How to get a number for your own business</h2>
        <p className="text-ink-muted text-sm max-w-prose">
          The three inputs that move the answer most are the number of returns you file in a year,
          the number of states you file in, and how many of those states you have physical presence
          in. The third one is the least obvious and the most expensive to get wrong: it decides
          whether you qualify for state-funded filing under the{' '}
          <Link href="/sst-csp-savings" className="no-underline hover:text-accent">
            Streamlined Sales Tax program
          </Link>
          , which is the largest single line this calculator can take off a qualifying seller&apos;s
          bill. It removes a line rather than the bill, and it is decided state by state.
        </p>
        <p className="mt-4">
          <Link
            href="/calculator"
            className="inline-flex items-center px-5 py-2.5 bg-accent text-paper rounded-lg no-underline hover:bg-accent-hover font-semibold text-sm"
          >
            Run every tracked platform against your numbers
          </Link>
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-6">Frequently asked questions</h2>
        <dl className="space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-sans font-bold text-ink">{f.q}</dt>
              <dd className="mt-2 text-ink-muted text-sm">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="my-12 rule-top pt-8">
        <p className="small-caps text-xs text-ink-subtle mb-4">Keep reading</p>
        <ul className="grid sm:grid-cols-2 gap-3 text-sm">
          <li>
            <Link href="/cheapest-sales-tax-software" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">Cheapest sales tax software</span>
              <span className="text-ink-muted text-xs">Which one wins, by buyer profile, including where the answer changes</span>
            </Link>
          </li>
          <li>
            <Link href="/sales-tax-software-hidden-fees" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">Hidden fees</span>
              <span className="text-ink-muted text-xs">Every fee category, and who publishes a number for each</span>
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}

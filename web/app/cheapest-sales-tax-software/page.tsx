import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { OwnershipNote } from '@/components/site/ownership-note';
import { providerPath } from '@/lib/slugs';
import { money, renderEstimate } from '@/lib/format';
import { absoluteUrl } from '@/lib/utils';
import {
  allRankings,
  canonicalRankings,
  capabilityGates,
  cheapestAnswerSentence,
  distinctWinners,
  scopeDifferences,
  variantRankings,
} from '@/lib/head-terms/cheapest';

const TITLE = 'What is the cheapest sales tax software?';

export function generateMetadata(): Metadata {
  const rankings = allRankings(getProvidersMap());
  return {
    title: 'Cheapest sales tax software · ranked by published pricing, 2026',
    description: cheapestAnswerSentence(rankings).slice(0, 320),
    alternates: { canonical: '/cheapest-sales-tax-software' },
    openGraph: {
      title: TITLE,
      description: cheapestAnswerSentence(rankings),
      url: absoluteUrl('/cheapest-sales-tax-software'),
      type: 'article',
    },
  };
}

export default function CheapestPage() {
  const providers = getAllProviders();
  const providersMap = getProvidersMap();
  const date = lastUpdatedAcross(providers);

  const all = allRankings(providersMap);
  const canonical = canonicalRankings(providersMap);
  const variants = variantRankings(providersMap);
  const winners = distinctWinners(all);
  const gates = capabilityGates(providers);
  const scope = scopeDifferences(providers);
  const answer = cheapestAnswerSentence(all);

  const publisherWins = all.filter((r) => r.winner.slug === 'taxcloud').length;
  // Split the profiles TaxCloud does not win into two honest buckets: the ones
  // where it competed and lost, and the ones where it was removed for lacking
  // the capability. Counting a capability exclusion as a "loss on price" would
  // overstate the fairness of the page in one direction and understate the
  // limitation in the other.
  const publisherExcluded = all.filter((r) => r.excluded.some((e) => e.name === 'TaxCloud'));
  const excludedPublisherProfiles = publisherExcluded.length;
  const publisherLosses = all.filter(
    (r) => r.winner.slug !== 'taxcloud' && !r.excluded.some((e) => e.name === 'TaxCloud'),
  );

  const faqs: Array<{ q: string; a: string }> = [
    { q: TITLE, a: answer },
    {
      q: 'Is the cheapest sales tax software the cheapest for everyone?',
      a: `No. Across the ${all.length} buyer profiles modeled on this page, ${winners.length === 1 ? 'the same platform comes out cheapest on every one, which is itself a reason to read the assumptions rather than the ranking' : `${winners.length} different platforms come out cheapest depending on the profile: ${winners.join(', ')}`}. The variables that move the answer are how many of your filing states you have physical presence in, whether your tax data sits in an ERP rather than a storefront, your filing cadence, and whether you need VAT or GST coverage. On profiles with a hard requirement, platforms that cannot meet it are removed from the ranking instead of being allowed to win on price.`,
    },
    {
      q: 'Is there free sales tax software?',
      a: `Several platforms have genuinely free tiers, but none of them file returns for you. ${providers
        .filter((p) => p.plans.some((pl) => pl.is_free))
        .map((p) => p.provider.name)
        .join(', ')} publish free tiers covering nexus monitoring and rate calculation. Filing, which is the part that takes the time, is paid at every vendor in this set. Filing directly through each state's own portal is free and remains a reasonable option at one or two states.`,
    },
    {
      q: 'Does cheapest mean lowest total cost?',
      a: `Not reliably. The vendors publish very different amounts of pricing, so the rows are not all the same kind of number: some are prices, one is a floor from a published per-state list rate sold only through a sales process, and one is an observed range from public buyer reports because the vendor publishes nothing. Contracts at both of those are negotiated. The ranking on this page is "cheapest by published pricing on a stated profile", which is the only claim the available data supports.`,
    },
    {
      q: 'What makes one sales tax platform cheaper than another?',
      a: `Three things. The pricing model does the most work: per-filing, per-state and per-order pricing produce very different bills for identical work, which is why the ranking reorders when the profile changes. Certified Service Provider status under the Streamlined Sales Tax program is the second, because member states pay certified providers directly for filing on behalf of qualifying sellers, so that line comes off a qualifying seller's bill in those states. It removes a line rather than the bill, it is decided state by state, and it is not enough on its own: one of the two certified platforms in this set is mid-table on cost. Third is scope, since a cheaper platform often does less.`,
    },
    {
      q: 'Where is the cheapest option not the right option?',
      a: gates
        .map((g) => {
          const parts: string[] = [];
          if (g.cannot.length) parts.push(`${g.cannot.join(' and ')} cannot serve it at all`);
          if (g.gated.length) parts.push(`it is gated to a higher or quote-only tier at ${g.gated.map((x) => x.split(':')[0]).join(', ')}`);
          if (g.included.length) parts.push(`it is on the cheapest paid plan at ${g.included.map((x) => x.split(':')[0]).join(', ')}`);
          return `${g.requirement}: ${parts.length ? parts.join('; ') : 'not recorded across the set'}`;
        })
        .join('. ') + '. A platform that cannot do the job is not a cheap option, whatever it costs.',
    },
  ];

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
      url: absoluteUrl('/cheapest-sales-tax-software'),
      ...(date ? { dateModified: date, datePublished: date } : {}),
      publisher: { '@type': 'Organization', name: 'TaxCloud, Inc.', url: 'https://taxcloud.com' },
    },
    ...canonical.map((r) => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Sales tax software ranked by annual cost — ${r.profile.name}`,
      description: `${r.profile.inputSummary}. Ranked cheapest first on published pricing.`,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: r.results.length,
      itemListElement: r.results.map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: e.provider,
        url: absoluteUrl(providerPath(e.slug)),
      })),
    })),
    {
      '@context': 'https://schema.org',
      '@type': 'Table',
      name: 'Cheapest sales tax software by buyer profile',
      description: answer,
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }} />
      ))}

      <header>
        <p className="small-caps text-xs text-ink-subtle">Ranked comparison</p>
        <h1 className="text-hed mt-2">{TITLE}</h1>
        <div className="mt-3">
          <UpdatedBadge date={date} />
        </div>
      </header>

      <Tldr>{answer}</Tldr>

      {/*
        REVIEWER NOTE (Ryan, round 5) — the two framings you asked to see.

        As built, this page does BOTH:
          A. "Ranking as computed" — the canonical SMB + mid-market table below,
             which is what the calculator says and what every other page on the
             site already publishes. TaxCloud wins both.
          B. "Cheapest for whom" — the all-profile table further down, which is
             the by-profile version. TaxCloud does not win all of them.

        The wide-footprint and quarterly-filer profiles were held back on the
        first pass because they surfaced two arithmetic defects in the shared
        TaxCloud SST credit, both running in the publisher's favour. The credit
        was replaced with the correct model (returns in SST member states are
        not charged and do not consume the filing subscription, so they leave
        the count before the tier ladder is walked) and both profiles are back
        in. TaxCloud now wins 4 of the 7 rather than 5, and wins them on
        arithmetic that holds up.

        If you want framing A alone, delete the "Where the answer changes"
        section and the capability-gate section. If you want framing B alone,
        promote the all-profile table above the canonical table and retitle the
        H1 to "Cheapest sales tax software, by buyer profile".

        Recommendation: ship as-is. B on its own buries the answer to the query
        the page is targeting; A on its own is the version a competitor
        screenshots.
      */}

      <OwnershipNote heading="Read this before the ranking">
        <p>
          This site is operated by TaxCloud, one of the {providers.length} platforms ranked below,
          and TaxCloud comes out cheapest on {publisherWins} of the {all.length} profiles modeled
          here. That is a conflict worth stating in the first screen rather than the footer.
        </p>
        <p>
          Three things are done about it, all structural. The ranking is computed by{' '}
          <Link href="/calculator" className="no-underline hover:text-accent">
            the same calculator
          </Link>{' '}
          that runs publicly on this site, from the same provider data, so nothing here can place a
          provider anywhere the public tool would not. {all.length} buyer profiles are published
          rather than one, including{' '}
          {publisherLosses.length > 0
            ? `the ${publisherLosses.length} where TaxCloud is not the cheapest option${excludedPublisherProfiles > 0 ? `, and the ${excludedPublisherProfiles === 1 ? 'one' : excludedPublisherProfiles} where it is removed from the ranking entirely because it cannot meet the requirement` : ''}`
            : 'the profiles that stress the assumptions hardest'}
          . And capability gates are reported before price, because a platform that cannot do the job
          is not a cheap option.
        </p>
        <p>
          The honest limit of the whole exercise: this is a comparison of{' '}
          <em>published</em> pricing, and the vendors publish very different amounts of it. One is
          quote-only, so its position is an observed range from buyer reports rather than a price.
          One publishes a per-state list rate but sells only through a sales process, so its
          position is a floor. Both negotiate, and a real contract can land well below a list
          position. Nothing on this page claims to know what any vendor's negotiated pricing is.
        </p>
      </OwnershipNote>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Ranked on the two profiles this site publishes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle w-8">#</th>
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Platform</th>
                {canonical.map((r) => (
                  <th key={r.profile.key} className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">
                    <span className="text-ink font-semibold block">{r.profile.name}</span>
                    <span className="font-normal text-ink-subtle">{r.profile.inputSummary}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(canonical[canonical.length - 1] ?? canonical[0])?.results.map((row, i) => (
                <tr key={row.slug} className="rule-bottom align-top">
                  <td className="py-4 pr-4 font-mono text-ink-subtle text-xs">{i + 1}</td>
                  <td className="py-4 pr-4">
                    <Link href={providerPath(row.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                      {row.provider}
                    </Link>
                    {row.slug === 'taxcloud' && (
                      <span className="block text-[10px] small-caps text-ink-subtle mt-0.5">Site publisher</span>
                    )}
                  </td>
                  {canonical.map((r) => {
                    const cell = r.results.find((x) => x.slug === row.slug);
                    return (
                      <td key={r.profile.key} className="py-4 px-4 font-mono text-ink whitespace-nowrap">
                        {cell ? renderEstimate(cell.estimate) : '—'}
                        <span className="text-xs font-sans text-ink-subtle ml-1">/yr</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-subtle mt-3">
          Ordered by the mid-market column, and by the floor of each estimate, so a vendor shown as
          a range is ranked on the bottom of that range. That flatters the vendor that publishes
          least rather than the other way round. The site-wide table on{' '}
          <Link href="/how-much-does-sales-tax-software-cost" className="no-underline hover:text-accent">
            the category page
          </Link>{' '}
          orders the same eight rows by the midpoint of a range instead, which moves the two
          range-priced vendors down. Neither ordering is more correct, because a range is not a
          price.
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Where the answer changes</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          A single winner across a single profile does not answer &ldquo;which is cheapest&rdquo;. It
          answers &ldquo;which is cheapest for one specific business&rdquo;. These are the shapes where the ranking moves, and the winner of each is
          whatever the calculator produces.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Buyer profile</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Cheapest</th>
                <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Runner-up</th>
              </tr>
            </thead>
            <tbody>
              {[...canonical, ...variants].map((r) => (
                <tr key={r.profile.key} className="rule-bottom align-top">
                  <td className="py-4 pr-4">
                    <span className="font-semibold text-ink block">{r.profile.name}</span>
                    <span className="text-xs text-ink-subtle">{r.profile.inputSummary}</span>
                  </td>
                  <td className="py-4 px-4">
                    <Link href={providerPath(r.winner.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                      {r.winner.provider}
                    </Link>
                    <span className="block font-mono text-xs text-ink-muted mt-0.5">
                      {renderEstimate(r.winner.estimate)}/yr
                    </span>
                    {r.winnerIsEstimated && (
                      <span className="block text-[10px] small-caps text-ink-subtle mt-0.5">
                        Quote-only, ranked on an estimated floor
                      </span>
                    )}
                    {r.excluded.length > 0 && (
                      <span className="block text-[11px] text-ink-subtle mt-1.5">
                        {r.excluded.map((e) => e.name).join(' and ')}{' '}
                        {r.excluded.length === 1 ? 'is' : 'are'} excluded from this row:{' '}
                        {r.excluded[0].reason}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-ink-muted">
                    {r.runnerUp ? (
                      <>
                        <Link href={providerPath(r.runnerUp.slug)} className="no-underline text-ink-muted hover:text-accent">
                          {r.runnerUp.provider}
                        </Link>
                        <span className="block font-mono text-xs mt-0.5">
                          {renderEstimate(r.runnerUp.estimate)}/yr
                          {r.gap > 0 && (
                            <span className="text-ink-subtle">{` \u00b7 +${money(r.gap)} on the floor of each estimate`}</span>
                          )}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 space-y-4 text-sm text-ink-muted max-w-prose">
          {[...canonical, ...variants]
            .filter((r) => !r.profile.canonical)
            .map((r) => (
              <p key={r.profile.key}>
                <strong className="text-ink">{r.profile.name}.</strong> {r.profile.why}{' '}
                {r.excluded.length > 0 && (
                  <>
                    {r.excluded.map((e) => e.name).join(' and ')} {r.excluded.length === 1 ? 'is' : 'are'}{' '}
                    excluded here, whatever they cost: {r.excluded[0].reason}.{' '}
                  </>
                )}
                {r.excluded.length > 0 ? 'Cheapest of what remains is ' : 'Cheapest here is '}
                {r.winner.provider} at{' '}
                {renderEstimate(r.winner.estimate).replace(/^From /, 'from ')}.
              </p>
            ))}
        </div>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Where price is the wrong question</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          Some requirements are not a price difference but a hard yes or no. Check these before
          reading any ranking, including the ones above.
        </p>
        <dl className="space-y-8">
          {gates.map((g) => (
            <div key={g.requirement} className="rule-bottom pb-6">
              <dt className="font-sans font-bold text-ink">{g.requirement}</dt>
              <dd className="text-sm text-ink-muted mt-1">{g.question}</dd>
              <dd className="mt-3 grid sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                {g.cannot.length > 0 && (
                  <div>
                    <p className="small-caps text-[11px] text-ink-subtle">Cannot serve it</p>
                    <p className="text-ink mt-1">{g.cannot.join(', ')}</p>
                  </div>
                )}
                {g.gated.length > 0 && (
                  <div>
                    <p className="small-caps text-[11px] text-ink-subtle">Gated to a higher or quote-only tier</p>
                    <p className="text-ink mt-1">{g.gated.join('; ')}</p>
                  </div>
                )}
                {g.included.length > 0 && (
                  <div>
                    <p className="small-caps text-[11px] text-ink-subtle">On the cheapest paid plan</p>
                    <p className="text-ink mt-1">{g.included.join('; ')}</p>
                  </div>
                )}
              </dd>
              <dd className="text-sm text-ink-muted mt-3 max-w-prose">{g.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="scope" className="my-12">
        <h2 className="text-subhed mb-4">What each price actually buys</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          A cheaper number sometimes means a narrower product. This is what is inside each
          platform&apos;s cheapest paid tier, so you can tell whether two rows in the ranking above
          are comparable.
        </p>
        <dl className="space-y-4">
          {scope.map((s) => (
            <div key={s.slug} className="grid grid-cols-1 md:grid-cols-[10rem_1fr] gap-1 md:gap-6 rule-bottom pb-4">
              <dt className="font-semibold text-ink text-sm">
                <Link href={providerPath(s.slug)} className="no-underline text-ink hover:text-accent">
                  {s.provider}
                </Link>
              </dt>
              <dd className="text-sm text-ink-muted">{s.buys}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Get the answer for your own numbers</h2>
        <p className="text-ink-muted text-sm max-w-prose">
          {all.length} profiles are more honest than one and still less useful than yours. The
          calculator takes order volume, filing count, state count and physical-presence count and
          ranks all {providers.length} platforms against them.
        </p>
        <p className="mt-4">
          <Link
            href="/calculator"
            className="inline-flex items-center px-5 py-2.5 bg-accent text-paper rounded-lg no-underline hover:bg-accent-hover font-semibold text-sm"
          >
            Rank them for your business
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
            <Link href="/how-much-does-sales-tax-software-cost" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">How much does sales tax software cost?</span>
              <span className="text-ink-muted text-xs">The category range, and what drives it</span>
            </Link>
          </li>
          <li>
            <Link href="/sales-tax-software-hidden-fees" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">Hidden fees</span>
              <span className="text-ink-muted text-xs">Why a cheap subscription is not a cheap year</span>
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}

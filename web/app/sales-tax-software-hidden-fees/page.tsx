import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { OwnershipNote } from '@/components/site/ownership-note';
import { providerPath } from '@/lib/slugs';
import { absoluteUrl } from '@/lib/utils';
import { HEAD_TERM_PROFILES } from '@/lib/head-terms/profiles';
import {
  DISCLOSURE_COLUMNS,
  DISCLOSURE_LABEL,
  disclosureMatrix,
  feeCategories,
  hiddenFeesAnswerSentence,
  unpublishedChargeCount,
  type FeeStatus,
} from '@/lib/head-terms/fees';

const TITLE = 'Sales tax software hidden fees: what each vendor charges and does not publish';

function StatusCell({ status }: { status: FeeStatus }) {
  const tone =
    status.kind === 'charged_unpublished'
      ? 'text-ink font-semibold'
      : status.kind === 'published'
        ? 'text-ink'
        : 'text-ink-subtle';
  const marker =
    status.kind === 'charged_unpublished'
      ? 'Unpublished'
      : status.kind === 'published'
        ? 'Published'
        : status.kind === 'none'
          ? 'Not charged'
          : 'Unknown';
  return (
    <>
      <span className={`block text-[10px] small-caps ${status.kind === 'charged_unpublished' ? 'text-accent' : 'text-ink-subtle'}`}>
        {marker}
      </span>
      <span className={`block text-sm mt-0.5 ${tone}`}>{status.value}</span>
    </>
  );
}

export function generateMetadata(): Metadata {
  const providers = getAllProviders();
  const cats = feeCategories(providers);
  return {
    title: 'Sales tax software hidden fees · every tracked vendor compared',
    description: hiddenFeesAnswerSentence(providers, cats).slice(0, 320),
    alternates: { canonical: '/sales-tax-software-hidden-fees' },
    openGraph: {
      title: TITLE,
      description: hiddenFeesAnswerSentence(providers, cats),
      url: absoluteUrl('/sales-tax-software-hidden-fees'),
      type: 'article',
    },
  };
}

export default function HiddenFeesPage() {
  const providers = getAllProviders();
  const providersMap = getProvidersMap();
  const date = lastUpdatedAcross(providers);
  const cats = feeCategories(providers);
  const matrix = disclosureMatrix(providers);
  const counts = unpublishedChargeCount(cats);
  const answer = hiddenFeesAnswerSentence(providers, cats);

  const taxcloudCount = counts.get('TaxCloud') ?? 0;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // Derived rather than asserted. An earlier draft claimed TaxCloud charged the
  // highest registration fee in the set as a piece of self-criticism; it is
  // third, and the table on this page said so two screens below.
  const registrationFees = providers
    .filter((p) => p.registrations.has_per_registration_fee && typeof p.registrations.base_cost?.amount === 'number')
    .map((p) => ({ name: p.provider.name, amount: p.registrations.base_cost!.amount as number }))
    .sort((a, b) => b.amount - a.amount);
  const registrationFeeCount = registrationFees.length;
  const taxcloudRegistrationIndex = registrationFees.findIndex((r) => r.name === 'TaxCloud');
  const ORDINALS = ['highest', 'second highest', 'third highest', 'fourth highest', 'fifth highest'];
  const taxcloudRegistrationRank =
    taxcloudRegistrationIndex >= 0 ? ORDINALS[taxcloudRegistrationIndex] ?? `${taxcloudRegistrationIndex + 1}th highest` : null;

  const taxcloudUpchargeStates = (
    providers.find((p) => p.provider.slug === 'taxcloud')?.filings.state_upcharges ?? []
  ).map((u) => u.state);
  const upchargeStates = [
    ...new Set(providers.flatMap((p) => (p.filings.state_upcharges ?? []).map((u) => u.state))),
  ].sort();

  const overageCharged = providers.filter((p) =>
    p.plans.some((pl) => pl.overage && pl.overage.model !== 'none'),
  );
  const overageUnpublished = overageCharged.filter(
    (p) =>
      !p.plans.some(
        (pl) => typeof pl.overage?.per_unit_cost === 'number' && (pl.overage!.per_unit_cost as number) > 0,
      ),
  );

  const faqs: Array<{ q: string; a: string }> = [
    { q: 'What hidden fees do sales tax software vendors charge?', a: answer },
    {
      q: 'What is the most commonly hidden fee in sales tax software?',
      a: `The overage rate above the included volume. Of the ${providers.length} platforms tracked here, ${overageCharged.length} have an overage concept in their pricing model and ${overageUnpublished.length} of those do not publish the rate. It is the number that decides what a strong quarter costs you, and it is the one you are least able to negotiate after signing. Two platforms have no overage concept at all, which is a different thing from not publishing one, and the category table below keeps them apart.`,
    },
    {
      q: 'Which sales tax vendors publish the most about their fees?',
      a: `Scored on four disclosures, filing fees, registration fees, overage rates and implementation fees, counting only the ones that apply to each vendor and only where an actual figure exists: ${matrix
        .map((m) => `${m.provider.provider.name} ${m.score}/${m.applicable}`)
        .join(', ')}. A vendor whose pricing page addresses a fee without naming an amount scores as unpublished, including the publisher of this site. Publishing more is not the same as charging less, and this page keeps the two questions separate.`,
    },
    {
      q: 'Are there per-state surcharges in sales tax software?',
      a: (() => {
        const published = (cats.find((c) => c.key === 'state-upcharges')?.cells ?? []).filter(
          (c) => c.status.kind === 'published',
        );
        const listed = published.length
          ? `${published.map((c) => `${c.provider} (${c.status.value})`).join('; ')}.`
          : 'No tracked vendor publishes one.';
        return `Yes, at some vendors. Colorado home-rule cities and Louisiana parishes require additional local filings that cost more to prepare, and some vendors pass that through as a per-filing upcharge in those states. Recorded on this site: ${listed} Where no upcharge is recorded, that means none was found in public sources, not that none exists.`;
      })(),
    },
    {
      q: 'Do sales tax software vendors charge to cancel?',
      a: (() => {
        const multiYear = providers.filter(
          (p) => ((p.commitments as any)?.contract_length_options ?? []).includes('multi_year'),
        );
        const monthToMonth = providers.filter((p) =>
          ((p.commitments as any)?.contract_length_options ?? []).includes('month_to_month'),
        );
        const noMonthToMonth = providers.filter(
          (p) => !((p.commitments as any)?.contract_length_options ?? []).includes('month_to_month'),
        );
        const lead =
          `${monthToMonth.length} of the ${providers.length} platforms here publish month-to-month terms, where leaving carries no contractual penalty. ` +
          (noMonthToMonth.length
            ? `The ${noMonthToMonth.length} that do not are ${noMonthToMonth.map((p) => p.provider.name).join(' and ')}.`
            : '');
        if (multiYear.length === 0) {
          return `${lead} No tracked vendor publishes a multi-year term. Read your own paperwork rather than a comparison page for this one, because the term and the notice window are what actually bind you.`;
        }
        const names = multiYear.map((p) => p.provider.name);
        return `${lead} ${names.join(' and ')} ${names.length === 1 ? 'sells' : 'sell'} multi-year terms, which usually means an early-termination clause. Read your own paperwork rather than a comparison page for this one, because the term and the notice window are what actually bind you.`;
      })(),
    },
    {
      q: 'Does the publisher of this site charge hidden fees?',
      a: `TaxCloud, which operates this site, charges something unpublished in ${taxcloudCount} of the ${cats.length} categories checked, and it is the only vendor in the set with a published credit card surcharge. It also offers guided onboarding "for an additional fee" without publishing the fee, which is exactly what this page defines as hidden. All of it is in the tables above, computed the same way as every other row.`,
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
      url: absoluteUrl('/sales-tax-software-hidden-fees'),
      ...(date ? { dateModified: date, datePublished: date } : {}),
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
      name: 'Sales tax software fee disclosure matrix',
      description: `Which of the ${providers.length} tracked platforms publish a number for filing fees, registration fees, overage rates and implementation fees.`,
    },
  ];

  return (
    <article className="mx-auto max-w-5xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }} />
      ))}

      <header className="max-w-3xl">
        <p className="small-caps text-xs text-ink-subtle">Fee reference</p>
        <h1 className="text-hed mt-2">Sales tax software hidden fees</h1>
        <div className="mt-3">
          <UpdatedBadge date={date} />
        </div>
      </header>

      <div className="max-w-3xl">
        <Tldr>{answer}</Tldr>
      </div>

      <section className="my-10 max-w-3xl">
        <h2 className="text-subhed mb-3">What &ldquo;hidden&rdquo; means on this page</h2>
        <p className="text-ink-muted text-sm">
          One narrow definition, applied identically to all {providers.length} platforms:{' '}
          <strong className="text-ink">
            a charge that exists and that the vendor does not put a number on
          </strong>
          . Not &ldquo;expensive&rdquo;. Not &ldquo;deceptive&rdquo;. A vendor can publish every fee
          it charges and still be the priciest option in the category, and the disclosure scores
          below are ordered independently of the{' '}
          <Link href="/cheapest-sales-tax-software" className="no-underline hover:text-accent">
            cost ranking
          </Link>{' '}
          for exactly that reason.
        </p>
        <p className="text-ink-muted text-sm mt-3">
          Every cell below is built from a recorded field with a source, so this page cannot say a
          vendor hides something the data does not support. Where nothing is recorded, the cell says
          so rather than guessing.
        </p>
      </section>

      <OwnershipNote heading="The publisher charges some of these">
        <p>
          This site is operated by TaxCloud. TaxCloud charges something unpublished in{' '}
          {taxcloudCount} of the {cats.length} categories checked below, charges{' '}
          {taxcloudRegistrationRank
            ? `the ${taxcloudRegistrationRank} per-state registration fee of the ${registrationFeeCount} vendors that publish one`
            : 'a per-state registration fee'}
          , applies per-filing upcharges in {taxcloudUpchargeStates.length} states
          {taxcloudUpchargeStates.length > 0 ? ` (${taxcloudUpchargeStates.join(', ')})` : ''}, and is
          the only vendor here with a published credit card surcharge. All of that is in the tables,
          computed by the same functions as everyone else&apos;s rows.
        </p>
        <p>
          Every cell in the tables below is produced by the same function for every vendor, from the
          same recorded fields, with no per-vendor exceptions. If you want to test that, check the
          publisher&apos;s rows against its own{' '}
          <Link href="/taxcloud-pricing" className="no-underline hover:text-accent">
            pricing page
          </Link>
          .
        </p>
      </OwnershipNote>

      {/* Disclosure matrix — the most liftable table on the page. */}
      <section className="my-12">
        <h2 className="text-subhed mb-4">Which vendors publish a number, and for what</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          Four disclosures, scored over the ones that apply to each vendor. This is a transparency
          measure and not a price measure, and the two orderings are different.
        </p>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          A cell counts as published only when a number exists, not when the vendor says it
          publishes one. &ldquo;Claimed, no figure&rdquo; is a vendor whose own pricing page
          addresses the fee without putting an amount on it, and it scores as unpublished.
          &ldquo;Not charged&rdquo; means the fee does not exist in that vendor&apos;s pricing model,
          so it is excluded from the denominator rather than counted as a disclosure. The publisher
          of this site is scored by the same rule, which is why it is not at four out of four.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Platform</th>
                {DISCLOSURE_COLUMNS.map((c) => (
                  <th key={c.key} className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">
                    {c.label}
                  </th>
                ))}
                <th className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">Score</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.provider.provider.slug} className="rule-bottom">
                  <td className="py-3 pr-4">
                    <Link href={providerPath(row.provider.provider.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                      {row.provider.provider.name}
                    </Link>
                  </td>
                  {DISCLOSURE_COLUMNS.map((c) => {
                    const state = row[c.key];
                    return (
                      <td key={c.key} className="py-3 px-3">
                        <span className={state === 'verified' ? 'text-ink' : 'text-ink-subtle'}>
                          {DISCLOSURE_LABEL[state]}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 px-3 font-mono text-ink">
                    {row.score}/{row.applicable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The count of unpublished charges, per vendor. */}
      <section className="my-12">
        <h2 className="text-subhed mb-4">How many charges exist without a published number</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          Counted across the {cats.length} fee categories on this page. A higher number means more
          charges the vendor levies or offers without saying what they cost, not a higher bill.
        </p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providers
            .map((p) => ({ name: p.provider.name, slug: p.provider.slug, n: counts.get(p.provider.name) ?? 0 }))
            .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
            .map((row) => (
              <li key={row.slug} className="card p-4">
                <Link href={providerPath(row.slug)} className="font-semibold text-ink no-underline hover:text-accent text-sm">
                  {row.name}
                </Link>
                <p className="font-mono text-2xl font-semibold text-ink mt-1">{row.n}</p>
                <p className="text-[11px] text-ink-subtle small-caps">
                  of {cats.length} categories
                </p>
              </li>
            ))}
        </ul>
        {ranked.length > 0 && (
          <p className="text-xs text-ink-subtle mt-4 max-w-prose">
            Both ends of that list need care. A low number can mean genuine disclosure, or it can
            mean a vendor that does not offer the service at all and so has nothing to disclose,
            which is why the category tables below keep &ldquo;not charged&rdquo; and
            &ldquo;unpublished&rdquo; apart.
          </p>
        )}
      </section>

      {/* Category-by-category detail. */}
      <section className="my-12">
        <h2 className="text-subhed mb-6">Every fee category, vendor by vendor</h2>
        <div className="space-y-14">
          {cats.map((cat) => (
            <div key={cat.key}>
              <h3 id={cat.key} className="font-sans text-base font-bold text-ink">
                {cat.label}
              </h3>
              <p className="text-sm text-ink-muted mt-1 max-w-prose">{cat.why}</p>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {cat.cells
                      .slice()
                      .sort((a, b) => {
                        const rank = (k: FeeStatus['kind']) =>
                          k === 'charged_unpublished' ? 0 : k === 'published' ? 1 : k === 'none' ? 2 : 3;
                        return rank(a.status.kind) - rank(b.status.kind) || a.provider.localeCompare(b.provider);
                      })
                      .map((cell) => (
                        <tr key={cell.slug} className="rule-bottom align-top">
                          <td className="py-3 pr-4 w-40">
                            <Link href={providerPath(cell.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                              {cell.provider}
                            </Link>
                          </td>
                          <td className="py-3 px-3">
                            <StatusCell status={cell.status} />
                            {cell.note && (
                              <span className="block text-xs text-ink-muted mt-1.5 max-w-prose">{cell.note}</span>
                            )}
                          </td>
                          <td className="py-3 pl-3 w-20 text-right">
                            {cell.source && (
                              <a
                                href={cell.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs no-underline text-ink-subtle hover:text-accent"
                              >
                                Source ↗
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="my-12 max-w-3xl">
        <h2 className="text-subhed mb-4">What to ask before you sign</h2>
        <p className="text-ink-muted text-sm mb-4">
          Six questions, covering the categories where the data most often runs out. Get the
          answers in writing, in the order of magnitude they matter.
        </p>
        <ol className="space-y-3 text-sm text-ink-muted list-decimal pl-5">
          <li>
            <strong className="text-ink">What is my rate above the included volume, per unit?</strong>{' '}
            The least-published number in the category and the one that decides what a good quarter costs.
          </li>
          <li>
            <strong className="text-ink">Which states carry an upcharge, and how much?</strong>{' '}
            {upchargeStates.length > 0
              ? `The states recorded with an upcharge anywhere in this set are ${upchargeStates.join(', ')}. Ask about those by name.`
              : 'Ask about home-rule and parish jurisdictions by name.'}
          </li>
          <li>
            <strong className="text-ink">What does a new state registration cost me, all in?</strong>{' '}
            Separate the vendor&apos;s service fee from the state&apos;s own permit fee, which passes through.
          </li>
          <li>
            <strong className="text-ink">Is there an implementation or onboarding charge, and is it waivable?</strong>{' '}
            It is free or unrecorded at most vendors in this set, and five figures at the enterprise end.
          </li>
          <li>
            <strong className="text-ink">What is the term, the notice window, and the renewal uplift?</strong>{' '}
            Auto-renewal with an undisclosed uplift is the fee nobody lists as a fee.
          </li>
          <li>
            <strong className="text-ink">What do back-filings and a voluntary disclosure cost?</strong>{' '}
            Offered by most, priced publicly by none, and usually needed exactly when you are least able to shop around.
          </li>
        </ol>
      </section>

      <section className="my-12 max-w-3xl">
        <h2 className="text-subhed mb-4">See it in a real bill</h2>
        <p className="text-ink-muted text-sm">
          The calculator applies every fee above that a vendor publishes, and says so when it cannot
          apply one because the rate is not public.
        </p>
        <p className="mt-4">
          <Link
            href="/calculator"
            className="inline-flex items-center px-5 py-2.5 bg-accent text-paper rounded-lg no-underline hover:bg-accent-hover font-semibold text-sm"
          >
            Model your own bill
          </Link>
        </p>
      </section>

      <section className="my-12 max-w-3xl">
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

      <nav className="my-12 rule-top pt-8 max-w-3xl">
        <p className="small-caps text-xs text-ink-subtle mb-4">Keep reading</p>
        <ul className="grid sm:grid-cols-2 gap-3 text-sm">
          <li>
            <Link href="/how-much-does-sales-tax-software-cost" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">How much does sales tax software cost?</span>
              <span className="text-ink-muted text-xs">The category range, and what drives it</span>
            </Link>
          </li>
          <li>
            <Link href="/cheapest-sales-tax-software" className="block p-4 card card-hover no-underline">
              <span className="font-semibold text-ink block">Cheapest sales tax software</span>
              <span className="text-ink-muted text-xs">
                Ranked across {HEAD_TERM_PROFILES.length} buyer profiles
              </span>
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}

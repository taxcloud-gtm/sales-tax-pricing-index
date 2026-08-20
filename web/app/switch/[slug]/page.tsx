import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PROVIDER_SLUGS, getProvider, getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { lastUpdated, lastUpdatedAcross } from '@/lib/last-updated';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { OwnershipNote } from '@/components/site/ownership-note';
import { providerPath, pairPath, switchPath } from '@/lib/slugs';
import { money, renderEstimate } from '@/lib/format';
import { absoluteUrl } from '@/lib/utils';
import { getProfile } from '@/lib/head-terms/profiles';
import {
  NOT_QUANTIFIED,
  switchingAnalysis,
  switchingAnswerSentence,
} from '@/lib/head-terms/switching';

export const dynamicParams = false;

export function generateStaticParams() {
  return PROVIDER_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProvider(slug);
  const profile = getProfile('mid-market');
  if (!p || !profile) return {};
  const analysis = switchingAnalysis(p, profile, getProvidersMap());
  const title = `What does it cost to switch from ${p.provider.name}?`;
  const description = analysis
    ? switchingAnswerSentence(analysis).slice(0, 320)
    : `What it costs to move off ${p.provider.name}, and what the alternatives cost.`;
  return {
    title: `Cost to switch from ${p.provider.name} · 2026`,
    description,
    alternates: { canonical: switchPath(slug) },
    openGraph: { title, description, url: absoluteUrl(switchPath(slug)), type: 'article' },
  };
}

export default async function SwitchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const from = getProvider(slug);
  if (!from) notFound();

  const profile = getProfile('mid-market');
  const providersMap = getProvidersMap();
  const allProviders = getAllProviders();
  if (!profile) notFound();

  const analysis = switchingAnalysis(from, profile, providersMap);
  if (!analysis) notFound();

  const date = lastUpdated(from) ?? lastUpdatedAcross(allProviders);
  const name = from.provider.name;
  const answer = switchingAnswerSentence(analysis);
  const cheaper = analysis.destinations.filter((d) => d.annualDelta < 0);
  const publisherDest = analysis.destinations.find((d) => d.isPublisher);
  const isPublisherPage = slug === 'taxcloud';

  const faqs: Array<{ q: string; a: string }> = [
    { q: `What does it cost to switch from ${name}?`, a: answer },
    {
      q: `Does ${name} charge a fee to leave?`,
      a: analysis.exit.opaque
        ? `${name} does not publish its cancellation terms, so the honest answer is that this cannot be established from public sources. ${analysis.exit.contractOptions.length ? `The contract terms it does publish are ${analysis.exit.contractOptions.map((t) => t.replace(/_/g, '-')).join(' and ')}.` : ''} Check your own agreement for the notice window and any early-termination clause.`
        : `${name}'s published position is: ${analysis.exit.cancellation}${analysis.exit.exitFees.length ? ` Separately recorded on this site: ${analysis.exit.exitFees.map((f) => f.name.toLowerCase()).join(', ')}.` : ''} Your own contract governs, not a comparison page.`,
    },
    {
      q: 'Do I have to re-register in each state when I switch sales tax software?',
      a: `Normally no. Your sales tax permits are registered to your business, not to your software vendor, so they stay with you and the new platform files under them. That is why per-state registration fees, which are a real cost when you are adding states, mostly do not apply to a switch. Two exceptions are worth checking: if you are enrolled in the Streamlined Sales Tax program your Certified Service Provider selection is recorded centrally and has to be reassigned, and if your current vendor registered you under its own filing arrangements rather than yours, ask specifically what transfers.`,
    },
    {
      q: `What is the cheapest alternative to ${name}?`,
      a: cheaper.length
        ? `On published pricing at the ${profile.inputSummary} profile, ${cheaper[0].name} at ${renderEstimate(cheaper[0].estimate.estimate).replace(/^From /, 'from ')} per year, against ${renderEstimate(analysis.fromEstimate.estimate).replace(/^From /, 'from ')} for ${name}. That is a difference of ${money(Math.abs(cheaper[0].annualDelta))} per year. ${cheaper.length - 1 > 0 ? `${cheaper.length - 1} other tracked platforms are also cheaper on this profile.` : ''} Adjust the profile with the calculator before treating any of this as your number.`
        : `On this profile, none of the ${analysis.destinations.length} tracked alternatives are cheaper than ${name} on published pricing. The closest is ${analysis.destinations[0]?.name ?? 'not computable'} at ${analysis.destinations[0] ? money(Math.abs(analysis.destinations[0].annualDelta)) : ''} per year more. Cost is one input among several, and the published-pricing comparison here says nothing about scope, support, or what a negotiated contract would look like. Change the profile in the calculator before drawing a conclusion from one row.`,
    },
    {
      q: 'When in the year should I switch sales tax software?',
      a: `The two constraints are your contract's notice window and your filing calendar. Cutting over at a period boundary, ideally at the start of a quarter or a year, keeps one vendor responsible for each complete filing period and avoids a split return. Against that, waiting for a clean boundary can mean paying for months you no longer use. Most teams also run both systems in parallel for one or two periods, which is a real cost this page does not attempt to price.`,
    },
    {
      q: 'What is the hardest part of switching sales tax platforms?',
      a: `Usually not the money. The parts that cost most are the ones no published price covers: ${NOT_QUANTIFIED.map((n) => n.item).join('; ')}. Product taxability mapping is the usual surprise, because it is the part that took longest to get right on the incumbent and it does not export cleanly.`,
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
      headline: `What does it cost to switch from ${name}?`,
      description: answer,
      url: absoluteUrl(switchPath(slug)),
      ...(date ? { dateModified: date, datePublished: date } : {}),
      about: { '@type': 'Thing', name: `${name} sales tax software migration cost` },
      publisher: { '@type': 'Organization', name: 'TaxCloud, Inc.', url: 'https://taxcloud.com' },
      isBasedOn: (from.sources ?? []).slice(0, 8).map((s) => ({
        '@type': 'WebPage',
        url: s.url,
        name: s.title ?? s.url,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Table',
      name: `Annual cost of alternatives to ${name}`,
      description: `Modeled annual cost of the ${analysis.destinations.length} tracked alternatives to ${name} on the ${profile.inputSummary} profile, with the difference in run-rate and any recorded one-time onboarding cost.`,
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }} />
      ))}

      <header>
        <p className="small-caps text-xs text-ink-subtle">Switching cost</p>
        <h1 className="text-hed mt-2">What does it cost to switch from {name}?</h1>
        <div className="mt-3 flex items-center gap-4">
          <UpdatedBadge date={date} />
          <Link href={providerPath(slug)} className="text-xs no-underline text-ink-subtle hover:text-accent">
            {name} pricing in full →
          </Link>
        </div>
      </header>

      <Tldr>{answer}</Tldr>

      <OwnershipNote
        heading={
          isPublisherPage
            ? 'This page is about leaving the site publisher'
            : 'One of the alternatives below publishes this site'
        }
      >
        {isPublisherPage ? (
          <p>
            This site is operated by TaxCloud, and this page models the cost of moving off TaxCloud.
            It exists because the switching-cost page is generated for all {allProviders.length}{' '}
            tracked platforms from one template, and excluding the publisher&apos;s own would make
            the set an argument rather than a reference. The numbers are produced by the same
            calculator as every other page here.
          </p>
        ) : (
          <p>
            This site is operated by TaxCloud, which appears below as one of the{' '}
            {analysis.destinations.length} alternatives
            {publisherDest
              ? `, ranked ${analysis.destinations.indexOf(publisherDest) + 1} of ${analysis.destinations.length} by modeled annual cost on this profile`
              : ''}
            . A &ldquo;cost to switch away from a competitor&rdquo; page published by a competitor is
            the most obviously self-interested page shape there is, so this one is built as a
            template that runs for every vendor including TaxCloud itself, and it is linked from
            every provider page in the set.
          </p>
        )}
        <p>
          It also refuses to quantify the parts that would flatter a switch if invented. The
          list below of what is not priced is the same on all {allProviders.length} pages.
        </p>
      </OwnershipNote>

      <section className="my-12">
        <h2 className="text-subhed mb-4">What a switch actually costs</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          Four components, only two of which anyone publishes. Getting the arithmetic right on the
          first two is worth doing before spending time on the second two.
        </p>
        <ol className="space-y-5 text-sm">
          <li className="rule-bottom pb-5">
            <p className="font-semibold text-ink">1. The run-rate you leave</p>
            <p className="text-ink-muted mt-1">
              {name} on this profile:{' '}
              {renderEstimate(analysis.fromEstimate.estimate).replace(/^From /, 'from ')} per year, on
              the {analysis.fromEstimate.recommendedPlan} plan.
            </p>
          </li>
          <li className="rule-bottom pb-5">
            <p className="font-semibold text-ink">2. The run-rate you arrive at</p>
            <p className="text-ink-muted mt-1">
              {cheaper.length
                ? `${cheaper.length} of ${analysis.destinations.length} tracked alternatives model cheaper on this profile, starting at ${renderEstimate(cheaper[0].estimate.estimate).replace(/^From /, '')} per year.`
                : `None of the ${analysis.destinations.length} tracked alternatives model cheaper on this profile.`}{' '}
              The full table is below.
            </p>
          </li>
          <li className="rule-bottom pb-5">
            <p className="font-semibold text-ink">3. One-time cost at the new vendor</p>
            <p className="text-ink-muted mt-1">
              Implementation or onboarding, where it exists. Most platforms in this set record none;
              the enterprise end of the market records five figures. Per-state registration fees
              usually do not apply, because your permits are yours already.
            </p>
          </li>
          <li>
            <p className="font-semibold text-ink">4. What is left on your current term</p>
            <p className="text-ink-muted mt-1">
              The variable that most often decides the timing, and the one no comparison page can
              read for you. {analysis.exit.opaque ? `${name} does not publish cancellation terms.` : `${name}'s published position is below.`}
            </p>
          </li>
        </ol>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Exit terms at {name}</h2>
        <dl className="space-y-4 text-sm">
          <div className="grid md:grid-cols-[12rem_1fr] gap-1 md:gap-6 rule-bottom pb-4">
            <dt className="small-caps text-xs text-ink-subtle">Contract terms offered</dt>
            <dd className="text-ink">
              {analysis.exit.contractOptions.length
                ? analysis.exit.contractOptions.map((t) => t.replace(/_/g, '-')).join(', ')
                : 'Not published'}
              {analysis.exit.multiYearDiscount && (
                <span className="text-ink-muted">
                  {' '}
                  · multi-year discounting is available, which normally implies a multi-year
                  commitment
                </span>
              )}
            </dd>
          </div>
          <div className="grid md:grid-cols-[12rem_1fr] gap-1 md:gap-6 rule-bottom pb-4">
            <dt className="small-caps text-xs text-ink-subtle">Cancellation, as recorded</dt>
            <dd className="text-ink">
              {analysis.exit.cancellation ?? 'Not published.'}
              <span className="block text-xs text-ink-subtle mt-1.5">
                Summarised from the vendor&apos;s own terms where it publishes them and from public
                buyer reports where it does not, in the language of those sources rather than ours.
              </span>
              {analysis.exit.source && (
                <a
                  href={analysis.exit.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs no-underline text-ink-subtle hover:text-accent mt-1.5"
                >
                  Source ↗
                </a>
              )}
            </dd>
          </div>
          {analysis.exit.exitFees.length > 0 && (
            <div className="grid md:grid-cols-[12rem_1fr] gap-1 md:gap-6 rule-bottom pb-4">
              <dt className="small-caps text-xs text-ink-subtle">Recorded exit-side fees</dt>
              <dd className="text-ink space-y-2">
                {analysis.exit.exitFees.map((f) => (
                  <p key={f.name}>
                    <strong className="text-ink">{f.name}.</strong>{' '}
                    <span className="text-ink-muted">{f.description}</span>
                    {f.source && (
                      <a
                        href={f.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs no-underline text-ink-subtle hover:text-accent ml-1"
                      >
                        ↗
                      </a>
                    )}
                  </p>
                ))}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-ink-subtle mt-4 max-w-prose">
          None of this is legal advice and none of it overrides your signed agreement. The two things
          worth finding in your own paperwork before anything else are the renewal date and the
          notice window.
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Where you would land, and what it changes</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          All {analysis.destinations.length} tracked alternatives at the{' '}
          {profile.inputSummary} profile, ordered by annual difference against {name}. Payback is the
          one-time onboarding cost divided by the annual saving. It is shown as a range wherever the
          onboarding cost is itself a range, because collapsing a buyer-reported spread of an order
          of magnitude into a single number would give a guess the appearance of a calculation. It
          reads &ldquo;not established&rdquo; where the vendor does not address onboarding cost at
          all, rather than assuming zero.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="rule-bottom">
                <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Alternative</th>
                <th className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">Annual</th>
                <th className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">vs {name}</th>
                <th className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">One-time onboarding</th>
                <th className="text-left py-3 px-3 small-caps text-xs text-ink-subtle">Payback</th>
              </tr>
            </thead>
            <tbody>
              {analysis.destinations.map((d) => (
                <tr key={d.slug} className="rule-bottom align-top">
                  <td className="py-4 pr-4">
                    <Link href={providerPath(d.slug)} className="font-semibold text-ink no-underline hover:text-accent">
                      {d.name}
                    </Link>
                    {d.isPublisher && (
                      <span className="block text-[10px] small-caps text-ink-subtle mt-0.5">Site publisher</span>
                    )}
                    <Link
                      href={pairPath(slug, d.slug)}
                      className="block text-xs no-underline text-ink-subtle hover:text-accent mt-1"
                    >
                      {name} vs {d.name} →
                    </Link>
                  </td>
                  <td className="py-4 px-3 font-mono text-ink whitespace-nowrap">
                    {renderEstimate(d.estimate.estimate)}
                  </td>
                  <td className="py-4 px-3 font-mono whitespace-nowrap">
                    {d.annualDelta === 0 ? (
                      <span className="text-ink-subtle">same</span>
                    ) : d.annualDelta < 0 ? (
                      <span className="text-accent">−{money(Math.abs(d.annualDelta))}</span>
                    ) : (
                      <span className="text-ink-muted">+{money(d.annualDelta)}</span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-ink-muted">
                    {d.entry.label}
                    {d.entry.unpricedExtras.length > 0 && (
                      <span className="block text-[11px] text-ink-subtle mt-1">
                        Also offers {d.entry.unpricedExtras.join(', ').toLowerCase()} for an
                        unpublished fee
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-ink-muted whitespace-nowrap">
                    {d.paybackMonths === null
                      ? d.annualDelta >= 0
                        ? 'No saving to pay back'
                        : 'Not established'
                      : d.paybackMonths.high === 0
                        ? 'Immediate'
                        : d.paybackMonths.low === d.paybackMonths.high
                          ? `${d.paybackMonths.high} mo`
                          : `${d.paybackMonths.low}–${d.paybackMonths.high} mo`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-subtle mt-3 max-w-prose">
          These rows are not like-for-like on scope. Each figure is the plan the calculator matched
          to this profile, and those plans differ in what they include:{' '}
          {analysis.destinations
            .slice(0, 3)
            .map((d) => `${d.name} on ${d.estimate.recommendedPlan}`)
            .join(', ')}
          , against {name} on {analysis.fromEstimate.recommendedPlan}. A cheaper row can be a
          narrower product.{' '}
          <Link href="/cheapest-sales-tax-software#scope" className="no-underline hover:text-accent">
            What each price actually buys
          </Link>
          .
        </p>
        <p className="text-xs text-ink-subtle mt-3 max-w-prose">
          Modeled on one profile. Your own footprint changes the ordering, sometimes substantially:
          the number of states you have physical presence in is the single biggest lever.{' '}
          <Link href="/calculator" className="no-underline hover:text-accent">
            Run your own
          </Link>
          .
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">What this page will not put a number on</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-6">
          These are real, frequently larger than the run-rate difference, and not derivable from
          published pricing. Any figure here would be invented, so there is none.
        </p>
        <dl className="space-y-5">
          {NOT_QUANTIFIED.map((n) => (
            <div key={n.item} className="rule-bottom pb-5">
              <dt className="font-sans font-bold text-ink text-sm">{n.item}</dt>
              <dd className="text-sm text-ink-muted mt-1 max-w-prose">{n.why}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Do your state registrations transfer?</h2>
        <p className="text-ink-muted text-sm max-w-prose">
          Yes, in the normal case. A sales tax permit is issued to your business, not to your
          software vendor, so it survives a change of platform and the new vendor files under it.
          That is why the per-state registration fees listed on{' '}
          <Link href="/sales-tax-software-hidden-fees" className="no-underline hover:text-accent">
            the fee reference
          </Link>{' '}
          are a cost of expanding rather than a cost of switching.
        </p>
        <p className="text-ink-muted text-sm max-w-prose mt-4">
          Two things to confirm anyway. If you are enrolled in the Streamlined Sales Tax program,
          your Certified Service Provider is recorded centrally and the selection has to be
          reassigned to the new provider, which is administrative rather than expensive. And if your
          current vendor set anything up under its own arrangements rather than yours, ask
          specifically what comes with you.{' '}
          <Link href="/sst-csp-savings" className="no-underline hover:text-accent">
            How CSP status works
          </Link>
          .
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
        <p className="small-caps text-xs text-ink-subtle mb-4">Switching cost from every tracked platform</p>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {allProviders
            .filter((p) => p.provider.slug !== slug)
            .map((p) => (
              <li key={p.provider.slug}>
                <Link
                  href={switchPath(p.provider.slug)}
                  className="block border border-rule px-3 py-2 no-underline text-ink-muted hover:border-accent hover:text-accent"
                >
                  From {p.provider.name}
                </Link>
              </li>
            ))}
        </ul>
        <p className="text-xs text-ink-subtle mt-5">
          Or start from the category level:{' '}
          <Link href="/how-much-does-sales-tax-software-cost" className="no-underline hover:text-accent">
            what sales tax software costs
          </Link>{' '}
          ·{' '}
          <Link href="/cheapest-sales-tax-software" className="no-underline hover:text-accent">
            which is cheapest
          </Link>
        </p>
      </nav>
    </article>
  );
}

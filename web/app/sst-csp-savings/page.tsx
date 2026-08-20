import type { Metadata } from 'next';
import Link from 'next/link';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { getAllProviders, getProvidersMap } from '@/lib/data/providers';
import { providerPath } from '@/lib/slugs';
import { money } from '@/lib/format';
import { absoluteUrl } from '@/lib/utils';
import {
  CSPS_OFFERING_FREE_SERVICE,
  CSPS_NOT_OFFERING_FREE_SERVICE,
  SST_ASSOCIATE_MEMBER_STATES,
  SST_FULL_MEMBER_STATES,
  SST_MEMBER_STATE_COUNT,
  SST_SOURCE_CSP_LIST,
  SST_SOURCE_FAQ,
  SST_SOURCE_WHAT_IS_CSP,
  splitByCspStatus,
  sstSavingsFor,
} from '@/lib/sst';

export const metadata: Metadata = {
  title: 'SST Certified Service Providers, and what CSP status is worth',
  description:
    'Five providers are Certified Service Providers in the Streamlined Sales Tax Program. What that means, who qualifies for state-funded filing, which of the eight tracked platforms are certified, and what qualifying is actually worth in dollars.',
  alternates: { canonical: '/sst-csp-savings' },
};

export default function SstCspSavingsPage() {
  const providers = getAllProviders();
  const providersMap = getProvidersMap();
  const date = lastUpdatedAcross(providers);
  const { csps, nonCsps } = splitByCspStatus(providers);
  const savings = sstSavingsFor('taxcloud', providersMap);

  const answer =
    `Five providers are Certified Service Providers (CSPs) in the Streamlined Sales Tax Program: ` +
    `${CSPS_OFFERING_FREE_SERVICE.join(', ')}. In the ${SST_MEMBER_STATE_COUNT} SST member states, ` +
    `those states pay the CSP directly for sales tax calculation, filing, and remittance on behalf of ` +
    `sellers who qualify, so a qualifying seller pays nothing for that work. ` +
    `Of the eight platforms tracked on this site, ${csps.length} are CSPs ` +
    `(${csps.map((p) => p.provider.name).join(' and ')}) and ${nonCsps.length} are not.`;

  const faqs: Array<{ q: string; a: string }> = [
    { q: 'What is an SST Certified Service Provider?', a: `A CSP is, in the Governing Board's words, "an agent certified under the Streamlined Sales and Use Tax Agreement to perform all the seller's sales and use tax functions, other than the seller's obligation to remit tax on its own purchases." In practice that means the CSP identifies what is taxable, applies the rate, keeps the transaction record, files the returns, remits the tax, and handles audits and notices.` },
    { q: 'Which providers are SST Certified Service Providers?', a: `${CSPS_OFFERING_FREE_SERVICE.join(', ')} are certified and currently offering free services under the program. ${CSPS_NOT_OFFERING_FREE_SERVICE.join(', ')} is certified but the Governing Board records it as not currently offering free services. No other sales tax platform is a CSP.` },
    { q: 'How many states are in the Streamlined Sales Tax Program?', a: `${SST_MEMBER_STATE_COUNT}: ${SST_FULL_MEMBER_STATES.length} full member states plus ${SST_ASSOCIATE_MEMBER_STATES.join(', ')}, the only associate member state.` },
    { q: 'Who qualifies for free CSP services?', a: `The Governing Board's rule is that a CSP "should not charge a seller for the CSP services for any Streamlined member state in which the seller meets the definition of 'CSP-compensated seller'". That definition lives in the CSP contract, and it turns on your connection to the state rather than your sales volume. The common shorthand is a seller with economic nexus only and no physical presence, but eligibility is determined state by state, not once for all of them. Confirm your own status with the state or your tax adviser before relying on it.` },
    { q: 'Is CSP status the same in every member state?', a: `No. Each state certifies CSP software and compensates CSPs separately, so free service is not uniform across all ${SST_MEMBER_STATE_COUNT} member states. Individual providers publish their own coverage claims, which may be broader or narrower than any single state's rules.` },
    ...(savings
      ? [{
          q: 'What is CSP status actually worth?',
          a: `For the mid-market profile used across this site (${savings.scenarioDescription}), running ${savings.provider} with ${savings.sstStates} SST states declared costs ${money(savings.withCredit)} per year against ${money(savings.withoutCredit)} with none declared, a difference of ${money(savings.savings)} per year. That is this site's calculator, not a vendor quote, and the figure moves with how many SST states you actually file in.`,
        }]
      : []),
    { q: 'Does being a CSP make a provider cheaper overall?', a: `Not necessarily. CSP status removes the filing cost in qualifying member states, but subscription pricing, per-registration fees, and non-SST state filings are unaffected. A non-CSP provider with lower subscription pricing can still come out ahead depending on your state footprint. On this site's calculator, returns in qualifying member states are left off the bill entirely rather than priced and credited back, so you can compare the whole bill rather than one line of it.` },
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
      headline: 'SST Certified Service Providers, and what CSP status is worth',
      description: answer,
      url: absoluteUrl('/sst-csp-savings'),
      ...(date ? { dateModified: date } : {}),
      isBasedOn: [SST_SOURCE_CSP_LIST, SST_SOURCE_WHAT_IS_CSP, SST_SOURCE_FAQ].map((u) => ({
        '@type': 'WebPage',
        url: u,
      })),
    },
  ];

  return (
    <article className="mx-auto max-w-prose px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }}
        />
      ))}

      <div className="space-y-3">
        <p className="small-caps text-xs text-ink-subtle">Reference</p>
        <h1 className="text-hed">
          SST Certified Service Providers, and what CSP status is worth
        </h1>
        <UpdatedBadge date={date} />
      </div>

      <aside
        className="my-8 border-l-4 border-accent bg-accent-subtle/40 pl-5 pr-4 py-4"
        aria-label="TL;DR"
      >
        <p className="small-caps text-[11px] text-accent mb-1.5">TL;DR</p>
        <p className="text-base text-ink leading-snug font-medium">{answer}</p>
      </aside>

      <div className="mt-12 space-y-12 text-ink-muted">
        <section>
          <h2 id="disclosure" className="text-subhed mb-4">
            Read this part first
          </h2>
          <p>
            This site is operated by TaxCloud, and TaxCloud is one of the five CSPs. That
            is a real conflict on this page more than any other, because CSP status is
            the thing TaxCloud sells against. So: every claim below is attributed to the
            Streamlined Sales Tax Governing Board rather than to us, the full CSP list is
            published rather than only the providers we track, and the limits on the
            benefit are stated as plainly as the benefit itself.{' '}
            <Link href="/methodology#ownership" className="text-accent hover:text-accent-hover">
              Full ownership disclosure
            </Link>
            .
          </p>
          <p className="mt-4">
            Nothing here is tax advice. Whether you qualify is determined state by state,
            and the definitive answer comes from the state or your tax adviser.
          </p>
        </section>

        <section>
          <h2 id="what-is-a-csp" className="text-subhed mb-4">
            What is a Certified Service Provider?
          </h2>
          <p>
            The Governing Board defines a CSP as{' '}
            <a href={SST_SOURCE_WHAT_IS_CSP} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
              &ldquo;an agent certified under the Streamlined Sales and Use Tax Agreement
              to perform all the seller&apos;s sales and use tax functions, other than the
              seller&apos;s obligation to remit tax on its own purchases.&rdquo;
            </a>
          </p>
          <p className="mt-4">
            Concretely, a CSP&apos;s software identifies which products and services are
            taxable, applies the right rate, keeps the transaction record, prepares and
            files returns, remits tax to each member state, and handles audits and notice
            resolution. The distinguishing feature is not the software. It is that in
            member states, the <em>state</em> compensates the CSP for that work rather
            than the seller.
          </p>
        </section>

        <section>
          <h2 id="who-is-certified" className="text-subhed mb-4">
            Which providers are Certified Service Providers?
          </h2>
          <p className="mb-5">
            Certification is granted by the SST Governing Board. A vendor cannot
            self-declare it. As of the last verification, the Board lists five providers
            certified and currently offering free services under the program:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="rule-bottom">
                  <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle">Provider</th>
                  <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">CSP status</th>
                  <th className="text-left py-3 px-4 small-caps text-xs text-ink-subtle">Tracked here</th>
                </tr>
              </thead>
              <tbody>
                {CSPS_OFFERING_FREE_SERVICE.map((name) => {
                  const tracked = providers.find((p) => p.provider.name === name);
                  return (
                    <tr key={name} className="rule-bottom">
                      <td className="py-3 pr-4 font-semibold text-ink">
                        {tracked ? (
                          <Link href={providerPath(tracked.provider.slug)} className="no-underline text-ink hover:text-accent">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="py-3 px-4">Certified, offering free services</td>
                      <td className="py-3 px-4 text-ink-subtle">{tracked ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
                {CSPS_NOT_OFFERING_FREE_SERVICE.map((name) => (
                  <tr key={name} className="rule-bottom">
                    <td className="py-3 pr-4 font-semibold text-ink">{name}</td>
                    <td className="py-3 px-4">Certified, not currently offering free services</td>
                    <td className="py-3 px-4 text-ink-subtle">No</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-subtle mt-3">
            Source:{' '}
            <a href={SST_SOURCE_CSP_LIST} target="_blank" rel="noopener noreferrer" className="no-underline hover:text-accent">
              SST Governing Board, Certified Service Providers list
            </a>
            .
          </p>
          <p className="mt-6">
            Of the eight platforms tracked on this site,{' '}
            <strong className="text-ink">{csps.map((p) => p.provider.name).join(' and ')}</strong>{' '}
            are CSPs. The other {nonCsps.length} are not:{' '}
            {nonCsps.map((p) => p.provider.name).join(', ')}. Those six bill their standard
            per-filing rates in SST member states like anywhere else.
          </p>
        </section>

        <section>
          <h2 id="member-states" className="text-subhed mb-4">
            Which states are in the program?
          </h2>
          <p>
            {SST_MEMBER_STATE_COUNT} states: {SST_FULL_MEMBER_STATES.length} full members
            plus {SST_ASSOCIATE_MEMBER_STATES.join(', ')}, the only associate member.
          </p>
          <p className="mt-4 text-sm">
            {SST_FULL_MEMBER_STATES.join(', ')}, and {SST_ASSOCIATE_MEMBER_STATES.join(', ')}.
          </p>
          <p className="text-xs text-ink-subtle mt-3">
            Source:{' '}
            <a href={SST_SOURCE_FAQ} target="_blank" rel="noopener noreferrer" className="no-underline hover:text-accent">
              SST Governing Board FAQ
            </a>
            . You will sometimes see a count of 25, which usually reflects a vendor adding
            a state with a similar arrangement outside SST membership. This page counts
            member states only.
          </p>
        </section>

        <section>
          <h2 id="who-qualifies" className="text-subhed mb-4">
            Who qualifies, and where it stops
          </h2>
          <p>
            The Board&apos;s rule is that a CSP{' '}
            <a href={SST_SOURCE_WHAT_IS_CSP} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
              &ldquo;should not charge a seller for the CSP services for any Streamlined
              member state in which the seller meets the definition of
              &lsquo;CSP-compensated seller&rsquo;.&rdquo;
            </a>{' '}
            That definition lives in the CSP contract rather than on the public site.
          </p>
          <p className="mt-4">
            Three limits are worth knowing before you build a business case on this:
          </p>
          <ul className="mt-4 space-y-3 list-disc pl-5">
            <li>
              <strong className="text-ink">It turns on your connection to the state, not your size.</strong>{' '}
              The common shorthand is a seller with economic nexus only and no physical
              presence. Physical presence, property, or payroll in a state generally takes
              you outside it.
            </li>
            <li>
              <strong className="text-ink">It is decided state by state.</strong> Each
              member state certifies software and compensates CSPs separately, so free
              service is not uniform across all {SST_MEMBER_STATE_COUNT} states.
            </li>
            <li>
              <strong className="text-ink">It only covers the CSP services.</strong>{' '}
              Subscription pricing, registrations, and filings in non-member states are
              unaffected. CSP status removes a line from the bill; it does not remove the
              bill.
            </li>
          </ul>
        </section>

        {savings && (
          <section>
            <h2 id="what-its-worth" className="text-subhed mb-4">
              What is CSP status actually worth?
            </h2>
            <p>
              Rather than assert a number, here is the same calculator this site uses
              everywhere else, run twice against {savings.provider} on the mid-market
              profile ({savings.scenarioDescription}): once with{' '}
              {savings.sstStates} SST states declared, once with none.
            </p>
            <div className="my-6 grid sm:grid-cols-3 gap-4">
              <div className="bg-paper-raised border border-rule p-4">
                <p className="small-caps text-[11px] text-ink-subtle">With {savings.sstStates} SST states</p>
                <p className="font-mono text-xl font-semibold text-ink mt-1">{money(savings.withCredit)}<span className="text-xs font-sans text-ink-subtle ml-1">/yr</span></p>
              </div>
              <div className="bg-paper-raised border border-rule p-4">
                <p className="small-caps text-[11px] text-ink-subtle">With none declared</p>
                <p className="font-mono text-xl font-semibold text-ink mt-1">{money(savings.withoutCredit)}<span className="text-xs font-sans text-ink-subtle ml-1">/yr</span></p>
              </div>
              <div className="bg-paper-raised border border-rule p-4">
                <p className="small-caps text-[11px] text-accent">Difference</p>
                <p className="font-mono text-xl font-semibold text-accent mt-1">{money(savings.savings)}<span className="text-xs font-sans text-ink-subtle ml-1">/yr</span></p>
              </div>
            </div>
            <p className="text-sm">
              That is this site&apos;s estimate, not a vendor quote, and it moves with how
              many SST states you actually file in.{' '}
              <Link href="/calculator" className="no-underline text-accent hover:text-accent-hover">
                Run your own footprint
              </Link>
              .
            </p>
          </section>
        )}

        <section>
          <h2 id="avalara-price-signal" className="text-subhed mb-4">
            The first public price on CSP economics
          </h2>
          <p>
            CSP compensation has never had a public number attached to it. In July 2026
            Avalara put one there by accident of packaging: its published plans price{' '}
            <Link href={providerPath('avalara')} className="text-accent hover:text-accent-hover">
              Core Compliance + SST Services
            </Link>{' '}
            at $69 per state per month against $79 for the same bundle without SST
            services. Avalara explains the inversion directly, saying states compensate it
            as a CSP for covered services.
          </p>
          <p className="mt-4">
            Read carefully, that $10 per state per month is what one CSP is willing to
            pass through to the customer. It is not the value of the program to a seller,
            and Avalara&apos;s own fine print limits the state-funded portion to qualifying
            transactions in participating states.
          </p>
        </section>

        <section>
          <h2 id="faq" className="text-subhed mb-6">
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-sans font-bold text-ink">{f.q}</dt>
                <dd className="mt-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </article>
  );
}

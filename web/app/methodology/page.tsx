import type { Metadata } from 'next';
import Link from 'next/link';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { lastUpdatedAcross } from '@/lib/last-updated';
import { getAllProviders } from '@/lib/data/providers';
import { methodologyJsonLd } from '@/lib/jsonld/methodology';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How Sales Tax Pricing Index gathers, rates, and verifies pricing data. Source priority, confidence ratings, transparency tiers, and our ownership disclosure.',
};

export default function MethodologyPage() {
  const date = lastUpdatedAcross(getAllProviders());
  const jsonLd = methodologyJsonLd();

  return (
    <article className="mx-auto max-w-prose px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="space-y-3">
        <p className="small-caps text-xs text-ink-subtle">Trust</p>
        <h1 className="text-hed">Methodology</h1>
        <UpdatedBadge date={date} />
      </div>

      <div className="mt-12 space-y-12 text-ink-muted">
        <section>
          <h2 className="text-subhed mb-4">What this site is</h2>
          <p>
            You&apos;re probably here because each of these eight providers (TaxCloud,
            Avalara, TaxJar, Numeral, Kintsugi, Anrok, Sphere, and Zamp) has a
            pricing page designed for a different conversation. The kind that ends in
            a quote, a follow-up email, and a calendar invite.
          </p>
          <p className="mt-4">
            This site does the cross-comparison their pricing pages won&apos;t. Every dollar
            figure is traceable to a public source: the vendor&apos;s pricing page, help
            center, third-party aggregators like Vendr and G2, or invoices customers
            have shared publicly. Confidence ratings tell you which.
          </p>
          <p className="mt-4">
            We don&apos;t accept payment from providers to appear here, rank higher, or
            smooth unfavorable numbers. When the owner&apos;s product (TaxCloud) costs more
            than a competitor for your business, the calculator shows it. That&apos;s the
            whole point.
          </p>
        </section>

        <section id="ownership" className="border-l-2 border-accent pl-6">
          <h2 className="text-subhed mb-4">Ownership disclosure</h2>
          <p>
            This site is operated by <strong className="text-ink">TaxCloud, Inc.</strong>,
            a sales tax compliance provider included in these comparisons.
            TaxCloud is a Certified Service Provider in the Streamlined Sales Tax (SST) Program.
          </p>
          <p className="mt-4">
            We disclose this because credibility requires it. The product&apos;s
            usefulness depends on the data being right, including in cases where
            it makes TaxCloud look worse. If you find pricing you believe is wrong
            or out of date, send a source URL to{' '}
            <a href="mailto:hello@taxcloud.com">hello@taxcloud.com</a> and we will
            correct or annotate it in the next update.
          </p>
          <p className="mt-4">
            That claim is checkable rather than rhetorical. Every correction this site has
            published is logged at{' '}
            <Link href="/corrections" className="no-underline hover:text-accent">
              /corrections
            </Link>
            , dated, with what the page used to say and which direction the error ran in. Several
            of them were errors that made TaxCloud look better than its own pricing supports,
            including one that understated TaxCloud&apos;s price by about 35%.
          </p>
        </section>

        <section>
          <h2 className="text-subhed mb-4">Confidence ratings</h2>
          <p>Every numeric field carries one of seven confidence ratings, applied to its source:</p>
          <dl className="mt-4 space-y-3">
            <ConfidenceRow letter="A" label="Provider&apos;s official pricing page" description="Canonical. Highest weight." />
            <ConfidenceRow letter="B" label="Provider&apos;s help center or product docs" description="Authoritative but secondary." />
            <ConfidenceRow letter="C" label="Reputable aggregator" description="G2, Capterra, Vendr, TrustRadius. Independent, dated." />
            <ConfidenceRow letter="D" label="Provider&apos;s blog, PR, or sales collateral" description="Useful but promotional." />
            <ConfidenceRow letter="E" label="Public forum or community post" description="Reddit, Hacker News, ProductHunt. Anecdotal." />
            <ConfidenceRow letter="F" label="Internal source" description="Customer-shared invoices, call notes. Verified but not public." />
            <ConfidenceRow letter="G" label="Estimated or inferred" description="Methodology disclosed in notes. Used for opaque vendors only." />
          </dl>
        </section>

        <section>
          <h2 className="text-subhed mb-4">Transparency tiers</h2>
          <dl className="space-y-3">
            <dt className="font-semibold text-ink">Transparent</dt>
            <dd>Full plan pricing is visible on the provider&apos;s website with specific dollar amounts. Filing fees, registration fees, and overage rates published.</dd>
            <dt className="font-semibold text-ink mt-3">Partial</dt>
            <dd>Some tiers are public; others require a quote. Pricing pages may show a starter tier and gate the rest.</dd>
            <dt className="font-semibold text-ink mt-3">Opaque</dt>
            <dd>Quote-only. No dollar amounts visible without contacting sales. We estimate using aggregator buyer data and disclose the range, never a point estimate.</dd>
          </dl>
        </section>

        <section>
          <h2 className="text-subhed mb-4">Estimate types</h2>
          <p>The calculator returns one of four estimate shapes per provider:</p>
          <ul className="mt-4 list-disc pl-6 space-y-2">
            <li><strong className="text-ink">Exact:</strong> a single dollar amount, used for fully transparent providers with no quote-required tier matched.</li>
            <li><strong className="text-ink">From X:</strong> a floor. Actual cost will be at least this much.</li>
            <li><strong className="text-ink">$X–$Y:</strong> a range. Used when methodology supports a range but not a point estimate.</li>
            <li><strong className="text-ink">Quote required:</strong> no public pricing exists for this customer profile. We do not invent a number.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-subhed mb-4">Update cadence</h2>
          <p>
            We re-verify provider pricing pages on a regular cadence. Every change
            shows up in the <a href="/changelog">changelog</a> with the date, the
            field, and the source URL we pulled it from. No silent edits; the trail
            is the product.
          </p>
        </section>

        <section>
          <h2 className="text-subhed mb-4">What this site is not</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>A quote. For quote-only providers, your actual contract will land somewhere inside the range we show. Confirm with the vendor before you sign.</li>
            <li>A recommendation. The calculator orders providers by estimated cost. Cheapest isn&apos;t always best; match what each one covers against what you actually need.</li>
            <li>Legal or tax advice.</li>
          </ul>
        </section>
      </div>
    </article>
  );
}

function ConfidenceRow({ letter, label, description }: { letter: string; label: string; description: string }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-3 items-baseline">
      <dt className="font-mono text-sm font-semibold text-accent">{letter}</dt>
      <dd>
        <span className="font-semibold text-ink">{label}.</span>{' '}
        <span>{description}</span>
      </dd>
    </div>
  );
}

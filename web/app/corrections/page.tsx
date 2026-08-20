import type { Metadata } from 'next';
import Link from 'next/link';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { formatDate } from '@/lib/last-updated';
import { absoluteUrl } from '@/lib/utils';
import {
  CORRECTIONS,
  DIRECTION_LABEL,
  correctionsByDirection,
  correctionsSummary,
  type CorrectionDirection,
} from '@/lib/corrections';

const TITLE = 'Corrections';

/** Display order for the count row: the uncomfortable column first. */
const DIRECTION_ORDER: CorrectionDirection[] = [
  'favoured-operator',
  'against-operator',
  'against-vendor',
  'mixed',
  'neutral',
];

export function generateMetadata(): Metadata {
  const description = correctionsSummary();
  return {
    title: 'Corrections · Sales Tax Pricing Index',
    description: description.slice(0, 320),
    alternates: { canonical: '/corrections' },
    openGraph: {
      title: 'Corrections to the Sales Tax Pricing Index',
      description,
      url: absoluteUrl('/corrections'),
      type: 'article',
    },
  };
}

export default function CorrectionsPage() {
  const by = correctionsByDirection();
  const summary = correctionsSummary();
  const latest = [...CORRECTIONS].map((c) => c.date).sort().reverse()[0] ?? null;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Corrections to the Sales Tax Pricing Index',
      description: summary,
      url: absoluteUrl('/corrections'),
      ...(latest ? { dateModified: latest } : {}),
      publisher: { '@type': 'Organization', name: 'TaxCloud, Inc.', url: 'https://taxcloud.com' },
      about: { '@type': 'Thing', name: 'Editorial corrections policy' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Table',
      name: 'Corrections log',
      description: `Every correction published by the Sales Tax Pricing Index, dated, with the direction each error ran in. ${CORRECTIONS.length} entries.`,
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }} />
      ))}

      <header>
        <p className="small-caps text-xs text-ink-subtle">Trust</p>
        <h1 className="text-hed mt-2">{TITLE}</h1>
        <div className="mt-3">
          <UpdatedBadge date={latest} />
        </div>
      </header>

      <Tldr>{summary}</Tldr>

      <section className="my-12">
        <h2 className="text-subhed mb-4">Why this page exists</h2>
        <div className="text-ink-muted space-y-4 max-w-prose">
          <p>
            This site publishes pricing for eight sales tax platforms and is operated by one of
            them. Every page says so. But a disclosure line only tells you that bias is{' '}
            <em>possible</em>. This page tells you what happened when it was real.
          </p>
          <p>
            Two rules keep the log worth reading. It records only things that were{' '}
            <strong className="text-ink">actually published</strong>, so errors caught in review
            before a page went live are not here, because padding the list would make the published
            record look worse than it was. And every entry says{' '}
            <strong className="text-ink">who the error favoured</strong>, because a plain list of
            corrections reads as diligence, and the direction is the part that can embarrass us.
          </p>
          <p>
            Routine data refreshes are not corrections and live in the{' '}
            <Link href="/changelog" className="no-underline hover:text-accent">
              pricing changelog
            </Link>{' '}
            instead. Sourcing rules and confidence ratings are on the{' '}
            <Link href="/methodology" className="no-underline hover:text-accent">
              methodology page
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-6">Corrections by direction</h2>
        <ul className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {DIRECTION_ORDER.map((d) => (
            <li key={d} className="card p-4">
              <p className="font-mono text-3xl font-semibold text-ink">{by[d].length}</p>
              <p className="text-[11px] text-ink-muted mt-1 leading-snug">{DIRECTION_LABEL[d]}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-subtle mt-4 max-w-prose">
          &ldquo;This site&apos;s operator&rdquo; means TaxCloud, Inc. A correction is counted once,
          against the direction its effect ran in. Where an error cut both ways it is counted as
          such rather than assigned to whichever column reads better.
        </p>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-6">The log</h2>
        <p className="text-ink-muted text-sm max-w-prose mb-8">
          Newest first. Every entry describes something that was live on this site and is not any
          more. Each has a permanent link.
        </p>
        <ol className="space-y-12">
          {CORRECTIONS.map((c) => (
            <li key={c.id} id={c.id} className="rule-bottom pb-10 scroll-mt-24">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                <time dateTime={c.date} className="small-caps text-xs text-ink-subtle">
                  {formatDate(c.date)}
                </time>
                <span
                  className={`small-caps text-[10px] px-2 py-0.5 rounded ${
                    c.direction === 'favoured-operator'
                      ? 'bg-accent-subtle text-accent'
                      : 'bg-paper-sunken text-ink-subtle'
                  }`}
                >
                  {DIRECTION_LABEL[c.direction]}
                </span>
                <a
                  href={`#${c.id}`}
                  className="text-[10px] no-underline text-ink-subtle hover:text-accent small-caps ml-auto"
                >
                  Link
                </a>
              </div>

              <h3 className="font-sans text-base font-bold text-ink max-w-prose">{c.headline}</h3>

              <dl className="mt-4 space-y-4 text-sm max-w-prose">
                <div>
                  <dt className="small-caps text-[11px] text-ink-subtle">What the site said</dt>
                  <dd className="text-ink-muted mt-1">{c.said}</dd>
                </div>
                <div>
                  <dt className="small-caps text-[11px] text-ink-subtle">What it says now</dt>
                  <dd className="text-ink-muted mt-1">{c.now}</dd>
                </div>
                {c.magnitude && (
                  <div>
                    <dt className="small-caps text-[11px] text-ink-subtle">What moved</dt>
                    <dd className="text-ink mt-1">{c.magnitude}</dd>
                  </div>
                )}
                <div>
                  <dt className="small-caps text-[11px] text-ink-subtle">Where it appeared</dt>
                  <dd className="text-ink-subtle mt-1">{c.surfaces}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className="my-12">
        <h2 className="text-subhed mb-4">How to report one</h2>
        <p className="text-ink-muted text-sm max-w-prose">
          If a figure on this site is wrong, including a figure about your own product, say so and
          it will be checked against the source and corrected here with the date. Vendors are
          welcome to dispute their own listings. A correction request does not need to come with
          anything more than a link to what the price actually is.
        </p>
        <p className="text-ink-muted text-sm max-w-prose mt-4">
          The standard applied is the same one on the{' '}
          <Link href="/methodology" className="no-underline hover:text-accent">
            methodology page
          </Link>
          : every figure traces to a public, dated source, and where a vendor publishes nothing this
          site says so rather than estimating.
        </p>
      </section>
    </article>
  );
}

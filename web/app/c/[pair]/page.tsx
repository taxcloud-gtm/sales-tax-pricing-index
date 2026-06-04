import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allPairs, parsePairSlug, pairPath, providerPath } from '@/lib/slugs';
import { getProvider } from '@/lib/data/providers';
import { lastUpdated } from '@/lib/last-updated';
import { absoluteUrl } from '@/lib/utils';
import { pairJsonLd } from '@/lib/jsonld/comparison';
import { pairSummary, pairTldr } from '@/lib/comparison-summary';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { PairSummary } from '@/components/comparison/pair-summary';
import { PairTable } from '@/components/comparison/pair-table';
import { ExampleScenarios } from '@/components/comparison/example-scenarios';
import { PairFaq } from '@/components/comparison/pair-faq';
import { PairSources } from '@/components/comparison/pair-sources';

export function generateStaticParams() {
  return allPairs().map(([a, b]) => ({ pair: `${a}-vs-${b}` }));
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params;
  const parsed = parsePairSlug(pair);
  if (!parsed) return {};
  const [aSlug, bSlug] = parsed;
  const a = getProvider(aSlug);
  const b = getProvider(bSlug);
  if (!a || !b) return {};
  const title = `${a.provider.name} vs ${b.provider.name} pricing · 2026`;
  const description = pairSummary(a, b);
  const canonical = absoluteUrl(pairPath(aSlug, bSlug));
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article' },
  };
}

export default async function PairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const parsed = parsePairSlug(pair);
  if (!parsed) notFound();
  const [aSlug, bSlug] = parsed;
  const a = getProvider(aSlug);
  const b = getProvider(bSlug);
  if (!a || !b) notFound();

  const date = [lastUpdated(a), lastUpdated(b)].filter(Boolean).sort().pop() ?? null;
  const jsonLd = pairJsonLd(a, b);

  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      {jsonLd.map((blob, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }}
        />
      ))}

      <header>
        <p className="small-caps text-xs text-ink-subtle">Pricing comparison</p>
        <h1 className="text-hed mt-2">
          {a.provider.name} vs {b.provider.name} pricing
        </h1>
        <UpdatedBadge date={date} />
      </header>

      <Tldr>{pairTldr(a, b)}</Tldr>
      <PairSummary a={a} b={b} />
      <ExampleScenarios a={a} b={b} />
      <PairTable a={a} b={b} />

      <section className="my-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProviderCallout p={a} />
        <ProviderCallout p={b} />
      </section>

      <PairFaq a={a} b={b} />
      <PairSources a={a} b={b} />

      <section className="my-12 rule-top pt-8 text-sm text-ink-muted max-w-prose">
        <p>
          Want a number specific to your business? The{' '}
          <Link href="/calculator" className="no-underline hover:text-accent">calculator</Link>{' '}
          ranks all eight providers, including {a.provider.name} and {b.provider.name}, by what they&apos;d
          actually cost given your volume, state footprint, and SST eligibility.
        </p>
      </section>
    </article>
  );
}

function ProviderCallout({ p }: { p: any }) {
  return (
    <div className="border border-rule p-5">
      <p className="small-caps text-xs text-ink-subtle">About</p>
      <h3 className="font-serif text-lg font-semibold mt-1">{p.provider.name}</h3>
      <p className="text-sm text-ink-muted mt-3">{p.provider.target_icp}</p>
      <Link
        href={providerPath(p.provider.slug)}
        className="inline-block mt-4 text-sm no-underline hover:text-accent"
      >
        Full {p.provider.name} pricing breakdown →
      </Link>
    </div>
  );
}

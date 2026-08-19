import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PROVIDER_SLUGS, getProvider, getAllProviders } from '@/lib/data/providers';
import { providerPath, pairPath, switchPath } from '@/lib/slugs';
import { lastUpdated } from '@/lib/last-updated';
import { absoluteUrl } from '@/lib/utils';
import { providerPageJsonLd } from '@/lib/jsonld';
import { howMuchDoesXCost, typicalMidMarketSentence } from '@/lib/summary';
import { UpdatedBadge } from '@/components/site/updated-badge';
import { Tldr } from '@/components/site/tldr';
import { SummaryProse } from '@/components/provider/summary-prose';
import { ProviderExampleScenarios } from '@/components/provider/example-scenarios';
import { PricingTable } from '@/components/provider/pricing-table';
import { TransparencyBlock } from '@/components/provider/transparency-block';
import { FeesSection } from '@/components/provider/fees-section';
import { BuyerObservations } from '@/components/provider/buyer-observations';
import { FaqSection } from '@/components/provider/faq-section';
import { SourcesList } from '@/components/provider/sources-list';

export function generateStaticParams() {
  return PROVIDER_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProvider(slug);
  if (!p) return {};
  const title = `${p.provider.name} pricing · 2026`;
  const description = howMuchDoesXCost(p);
  const canonical = absoluteUrl(providerPath(slug));
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article' },
  };
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = getProvider(slug);
  if (!provider) notFound();

  const date = lastUpdated(provider);
  const jsonLd = providerPageJsonLd(provider);
  const otherProviders = getAllProviders().filter((p) => p.provider.slug !== slug);

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
        <p className="small-caps text-xs text-ink-subtle">Provider</p>
        <h1 className="text-hed mt-2">{provider.provider.name} pricing</h1>
        <div className="mt-3 flex items-center gap-4">
          <UpdatedBadge date={date} />
          {provider.provider.pricing_url && (
            <a
              href={provider.provider.pricing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs no-underline text-ink-subtle hover:text-accent"
            >
              Vendor pricing page ↗
            </a>
          )}
        </div>
      </header>

      <Tldr>{typicalMidMarketSentence(provider)}</Tldr>
      <SummaryProse provider={provider} />
      <ProviderExampleScenarios provider={provider} />
      <PricingTable provider={provider} />
      <TransparencyBlock provider={provider} />
      <FeesSection provider={provider} />
      <BuyerObservations slug={slug} />
      <FaqSection provider={provider} />
      <SourcesList provider={provider} />

      <section className="my-12 rule-top pt-8">
        <p className="small-caps text-xs text-ink-subtle">Compare</p>
        <h2 className="text-subhed mt-2 mb-4">{provider.provider.name} vs the alternatives</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {otherProviders.map((other) => (
            <li key={other.provider.slug}>
              <Link
                href={pairPath(slug, other.provider.slug)}
                className="block border border-rule px-3 py-2 no-underline hover:border-accent hover:text-accent"
              >
                vs {other.provider.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-subtle mt-4">
          Or <Link href="/calculator" className="no-underline hover:text-accent">run the calculator</Link> to see how {provider.provider.name} stacks up against all eight for your business.
        </p>
        <p className="text-xs text-ink-subtle mt-2">
          Already on {provider.provider.name}?{' '}
          <Link href={switchPath(slug)} className="no-underline hover:text-accent">
            What it costs to switch from {provider.provider.name}
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

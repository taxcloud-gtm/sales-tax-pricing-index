import type { ProviderData } from '../../../calculator/src/data/types';
import { absoluteUrl } from '../utils';
import { lastUpdatedAcross } from '../last-updated';

/**
 * schema.org/Dataset for the Sales Tax Pricing Index.
 *
 * Why this matters for AEO:
 *   LLMs and Google's data surfaces preferentially cite declared datasets for
 *   "how much does X cost" queries. Marking up the corpus as a Dataset tells
 *   crawlers this is structured, sourced, dated pricing data — not marketing
 *   copy — and puts it in the same citation tier as Vendr or G2.
 *
 * Key fields chosen:
 *   - variableMeasured: names the specific price metrics tracked (per-filing,
 *     per-registration, subscription, SST eligibility). This is the field
 *     agents use to understand *what* the dataset measures.
 *   - temporalCoverage: the rolling date coverage from the oldest source date
 *     to the most recently verified. Freshness signal.
 *   - distribution: the methodology page as the human-readable data spec, plus
 *     the llms.txt as the machine-readable index — both are already live.
 *   - measurementTechnique: source-hierarchy (A = vendor page, B = help center,
 *     C = aggregator) that the site already implements. Citing it here tells
 *     crawlers the data is methodologically rigorous.
 */
export function datasetJsonLd(providers: ProviderData[]) {
  const base = absoluteUrl('/').replace(/\/$/, '');

  // Derive dateModified from the most recently verified source across all
  // providers — same logic as the UpdatedBadge on the homepage.
  const dateModified = lastUpdatedAcross(providers) ?? new Date().toISOString().slice(0, 10);

  // Oldest source_date across the corpus — the start of temporal coverage.
  const allDates = providers
    .flatMap((p) => (p.sources ?? []).map((s) => s.accessed_date))
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort();
  const dateCreated = allDates[0] ?? '2026-01-01';

  const providerNames = providers.map((p) => p.provider.name);

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${base}/#dataset`,
    name: 'Sales Tax Pricing Index — US Sales Tax Compliance Platform Pricing Data',
    description:
      `Sourced, dated pricing data for ${providerNames.length} US sales tax compliance platforms: ` +
      `${providerNames.join(', ')}. ` +
      `Tracks subscription fees, per-state filing fees, per-state registration fees, ` +
      `per-transaction rates, SST Certified Service Provider status, and annual cost ` +
      `estimates for SMB and mid-market ecommerce profiles. ` +
      `Every figure cites its primary source with an A–G confidence rating.`,
    url: absoluteUrl('/'),
    sameAs: absoluteUrl('/methodology'),
    creator: {
      '@type': 'Organization',
      '@id': `${base}/#publisher`,
      name: 'TaxCloud, Inc.',
      url: 'https://taxcloud.com',
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${base}/#publisher`,
      name: 'TaxCloud, Inc.',
      url: 'https://taxcloud.com',
    },
    license: absoluteUrl('/methodology#ownership'),
    dateCreated,
    dateModified,
    temporalCoverage: `${dateCreated}/${dateModified}`,
    inLanguage: 'en-US',
    keywords: [
      'sales tax software pricing',
      'sales tax compliance platform cost',
      'Avalara pricing',
      'TaxJar pricing',
      'TaxCloud pricing',
      'Numeral pricing',
      'Kintsugi pricing',
      'Anrok pricing',
      'Sphere pricing',
      'Zamp pricing',
      'AutoFile cost',
      'per-filing fee',
      'SST Certified Service Provider',
      'sales tax automation comparison',
    ],
    // variableMeasured tells agents exactly what price metrics the dataset
    // tracks. Each PropertyValue names one metric and cites the methodology.
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'Monthly subscription fee',
        description: 'Base monthly subscription price for the entry paid plan, in USD. Labeled /mo.',
        unitText: 'USD per month',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'Per-state filing fee',
        description:
          'Per-state filing fee charged each time the platform submits a sales tax return on the customer\'s behalf, in USD. Labeled per filing.',
        unitText: 'USD per filing',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'Per-state registration fee',
        description:
          'One-time fee charged per state to register a new sales tax permit on the customer\'s behalf, in USD.',
        unitText: 'USD per registration',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'Per-transaction fee',
        description:
          'Per-transaction or basis-point fee charged on taxable revenue or transaction volume, where applicable.',
        unitText: 'basis points or USD per transaction',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'Annual cost estimate — SMB profile',
        description:
          'Modeled annual total cost for a representative SMB ecommerce business: 50,000 orders/year, 120 filings, 10 states with 5 SST states, Shopify integration.',
        unitText: 'USD per year',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'Annual cost estimate — mid-market profile',
        description:
          'Modeled annual total cost for a representative mid-market ecommerce business: 250,000 orders/year, 200 filings, 20 states with 10 SST states, Shopify integration.',
        unitText: 'USD per year',
        measurementTechnique: absoluteUrl('/methodology'),
      },
      {
        '@type': 'PropertyValue',
        name: 'SST Certified Service Provider status',
        description:
          'Whether the platform holds SST CSP designation, entitling eligible sellers to free filing in the 24 SST member states (economic nexus only, no physical nexus).',
        unitText: 'boolean',
        measurementTechnique: 'https://www.streamlinedsalestax.org/certified-service-providers',
      },
      {
        '@type': 'PropertyValue',
        name: 'Pricing transparency tier',
        description:
          'Categorization of how openly the vendor publishes pricing: Transparent (full pricing public), Partial (some pricing public), or Opaque (quote-only).',
        unitText: 'categorical: Transparent | Partial | Opaque',
        measurementTechnique: absoluteUrl('/methodology'),
      },
    ],
    // distribution surfaces the methodology and llms.txt as machine-readable
    // and human-readable data specs — both already live.
    distribution: [
      {
        '@type': 'DataDownload',
        name: 'Dataset methodology and source documentation',
        contentUrl: absoluteUrl('/methodology'),
        encodingFormat: 'text/html',
        description:
          'Human-readable documentation of data sources, confidence ratings (A–G), and editorial methodology.',
      },
      {
        '@type': 'DataDownload',
        name: 'LLM-optimized index (llms.txt)',
        contentUrl: absoluteUrl('/llms.txt'),
        encodingFormat: 'text/plain',
        description:
          'Machine-readable index of the dataset for LLM and AI agent crawlers: publisher identity, key claims, provider list, and canonical URL map.',
      },
    ],
    measurementTechnique:
      'Each price point is assigned an A–G confidence rating based on source type: ' +
      'A = vendor official pricing page, B = vendor help center or product documentation, ' +
      'C = third-party aggregator (Vendr, G2, Capterra, TrustRadius), ' +
      'D = vendor blog or press release, E = public forum (Reddit, Hacker News), ' +
      'F = customer-shared invoice or call notes (verified but not public), ' +
      'G = estimate with disclosed methodology (used for opaque/quote-only vendors). ' +
      'Full methodology: ' + absoluteUrl('/methodology'),
    isAccessibleForFree: true,
    isBasedOn: providers
      .flatMap((p) => p.sources ?? [])
      .filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i)
      .slice(0, 20)
      .map((s) => ({
        '@type': 'WebPage',
        url: s.url,
        name: s.title ?? s.url,
      })),
  };
}

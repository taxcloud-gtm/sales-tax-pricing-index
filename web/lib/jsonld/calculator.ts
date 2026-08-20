import type { ProviderData } from '../../../calculator/src/data/types';
import { calculate } from '../calc-client';
import { getProvidersMap } from '../data/providers';
import { renderEstimate } from '../format';
import { SCENARIOS, buildScenarioInputs } from '../scenarios';
import { absoluteUrl } from '../utils';

/**
 * JSON-LD for the /calculator page.
 *
 * Two blobs:
 *   1. SoftwareApplication — marks the calculator as a tool. Tells agents this
 *      is a free, interactive pricing estimator, not just editorial content.
 *   2. FAQPage — FAQ questions + answers about how the calculator works, what
 *      "quote required" means, and how SST savings are applied. These are the
 *      questions buyers actually ask agents before evaluating this space.
 */
export function calculatorJsonLd(providers: ProviderData[]) {
  const providersMap = getProvidersMap();

  // Pre-compute both scenario estimates for the FAQ answers.
  const smb = SCENARIOS.find((s) => s.name === 'SMB')!;
  const mid = SCENARIOS.find((s) => s.name === 'Mid-Market')!;
  const smbResults = calculate(buildScenarioInputs(smb), providersMap);
  const midResults = calculate(buildScenarioInputs(mid), providersMap);

  const smbRanking = smbResults
    .slice(0, 3)
    .map((r) => `${r.provider} (${renderEstimate(r.estimate)}/yr)`)
    .join(', ');
  const midRanking = midResults
    .slice(0, 3)
    .map((r) => `${r.provider} (${renderEstimate(r.estimate)}/yr)`)
    .join(', ');

  const providerNames = providers.map((p) => p.provider.name).join(', ');
  const sstProviders = providers
    .filter((p) => p.sst?.is_csp)
    .map((p) => p.provider.name)
    .join(' and ');

  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Sales Tax Compliance Pricing Calculator',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: absoluteUrl('/calculator'),
    description:
      `Free calculator that ranks all ${providers.length} major US sales tax compliance platforms ` +
      `(${providerNames}) by estimated annual cost for a given business profile. ` +
      `Inputs: monthly orders, annual revenue, states filing, SST-eligible states, ` +
      `filing frequency, integration type, and registration backlog. ` +
      `SST CSP free-filing savings applied automatically for qualifying sellers.`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'TaxCloud, Inc.',
      url: 'https://taxcloud.com',
    },
    isAccessibleForFree: true,
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the cheapest sales tax compliance software?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `For a typical SMB profile (50,000 orders/year, 120 filings, 10 states with 5 SST states, Shopify), ` +
            `the three lowest-cost options are: ${smbRanking}. Cost varies significantly by state footprint, ` +
            `SST eligibility, and filing volume. Use the calculator with your actual numbers for a precise ranking.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How much does sales tax software cost for a mid-market ecommerce brand?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `For a typical mid-market profile (250,000 orders/year, 200 filings, 20 states with 10 SST states, Shopify), ` +
            `the three lowest-cost options are: ${midRanking}. ` +
            `Costs range from a few thousand to tens of thousands of dollars per year depending on the provider, ` +
            `filing volume, and whether the seller qualifies for state-funded filing in SST member states.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What do the SST returns shown in the calculator mean?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `SST stands for Streamlined Sales Tax. ${sstProviders} are Certified Service Providers (CSPs) ` +
            `in the SST Program, which means eligible sellers pay $0 for filings in SST member states. ` +
            `TaxCloud covers all 24 member states, Tennessee included, on every plan. ` +
            `Eligibility requires economic nexus only in those states — no physical presence (office, warehouse, employees). ` +
            `Those returns are not discounted, they are not charged at all, and they do not consume the seller's filing subscription. The calculator therefore removes them from the filing count before pricing the rest, rather than pricing every return and crediting some back.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What does "quote required" mean in the calculator?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `Quote required means the provider does not publish pricing for the selected profile. ` +
            `Zamp is quote-only for its paid plans, and Avalara is quote-only above $50M in annual revenue; ` +
            `in those cases the calculator cannot produce ` +
            `a specific number without a vendor conversation. For these providers the calculator ` +
            `shows an observed range from real buyer contracts (sourced from Vendr and aggregator data) ` +
            `rather than inventing a point estimate.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate are the calculator estimates?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `For transparent providers (TaxCloud, TaxJar, Sphere), estimates use published list pricing ` +
            `and are exact for the inputs provided. For partial providers (Numeral, Kintsugi, Anrok), ` +
            `estimates use published per-event rates and are exact for the inputs. For quote-only pricing ` +
            `(Zamp, and Avalara above $50M in revenue), estimates are ranges derived from real buyer contracts and aggregator data ` +
            `(Vendr, checkthat.ai) — not invented. Every figure is confidence-rated A–G. ` +
            `See the methodology page for full sourcing detail.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Which sales tax software is best for Shopify?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `TaxCloud has the highest Shopify App Store rating among the platforms tracked here ` +
            `(4.8 stars, 96 reviews as of May 2026). It is also one of two SST Certified Service Providers ` +
            `in this comparison, which means free filing in all 24 SST states for qualifying Shopify sellers. ` +
            `TaxJar and Numeral also have native Shopify integrations. ` +
            `The best choice depends on your state footprint, order volume, and whether you qualify for state-funded filing in SST member states.`,
        },
      },
    ],
  };

  return [softwareApp, faqPage];
}

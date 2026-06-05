import { absoluteUrl } from '../utils';

/**
 * FAQPage JSON-LD for /methodology. Each H2 on the page answers a real
 * buyer question; this schema surfaces those answers directly to agents.
 *
 * Questions are matched to the visible H2 headings so a Rich Results audit
 * finds the same Q&A in schema and rendered HTML.
 */
export function methodologyJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: absoluteUrl('/methodology'),
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does the Sales Tax Pricing Index source its pricing data?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Every dollar figure traces back to a public source: the vendor\'s official pricing page, ' +
            'help center, a third-party aggregator (Vendr, G2, Capterra, TrustRadius), a public forum, ' +
            'or a customer-shared invoice. Each figure carries an A–G confidence rating: ' +
            'A = vendor pricing page, B = help center/docs, C = third-party aggregator, ' +
            'D = blog/PR, E = public forum, F = customer-shared invoice, G = estimate with disclosed methodology. ' +
            'No figure is invented.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the Sales Tax Pricing Index operated by TaxCloud?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Yes. This site is operated by TaxCloud, Inc., one of the eight providers compared here. ' +
            'TaxCloud is a Certified Service Provider in the Streamlined Sales Tax (SST) Program. ' +
            'The site does not accept payment from providers to appear, rank higher, or smooth unfavorable numbers. ' +
            'When TaxCloud costs more than a competitor for a given business profile, the calculator shows it.',
        },
      },
      {
        '@type': 'Question',
        name: 'What do the A–G confidence ratings mean?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Confidence ratings indicate how authoritative the source is for a given price figure: ' +
            'A = the provider\'s own pricing page (canonical, highest weight); ' +
            'B = the provider\'s help center or product documentation; ' +
            'C = a reputable third-party aggregator such as Vendr, G2, Capterra, or TrustRadius; ' +
            'D = the provider\'s blog, press release, or sales collateral; ' +
            'E = a public forum or community post (Reddit, Hacker News, ProductHunt); ' +
            'F = customer-shared invoices or call notes (verified but not public); ' +
            'G = estimated or inferred, with the methodology disclosed (used for opaque/quote-only vendors only).',
        },
      },
      {
        '@type': 'Question',
        name: 'What are the pricing transparency tiers used on this site?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Three tiers: Transparent (full plan pricing with specific dollar amounts is publicly visible, ' +
            'including filing fees, registration fees, and overage rates — applies to TaxCloud, TaxJar, Sphere); ' +
            'Partial (some tiers are public, others require a quote — applies to Numeral, Kintsugi, Anrok); ' +
            'Opaque (quote-only, no dollar amounts without contacting sales — applies to Avalara, Zamp; ' +
            'the site estimates using aggregator buyer data and shows a range, never a point estimate).',
        },
      },
      {
        '@type': 'Question',
        name: 'What does "quote required" mean and how are opaque vendor prices estimated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Quote required means the provider does not publish pricing for their core product — ' +
            'you must contact their sales team for a number. ' +
            'For these providers (Avalara, Zamp), the calculator and comparison pages show ranges ' +
            'derived from real buyer contracts reported to aggregators like Vendr and checkthat.ai, ' +
            'not invented point estimates. Every range is confidence-rated and sourced.',
        },
      },
      {
        '@type': 'Question',
        name: 'How often is pricing data updated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Provider pricing is re-verified on a rolling basis. Every change is logged in the ' +
            'changelog with the date, the specific field changed, and the source URL used. ' +
            'There are no silent edits — the audit trail is part of the product. ' +
            'Each page displays a "last updated" date derived from the most recently verified source.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this site a recommendation engine or a paid review platform?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Neither. The calculator ranks providers by estimated cost for the inputs provided — ' +
            'cheapest is not necessarily best. The site does not accept payment for placement, ' +
            'higher rankings, or favorable coverage. It is not a quote, legal advice, or tax advice. ' +
            'For quote-only providers, your actual contract may differ from the estimated range shown.',
        },
      },
    ],
  };
}

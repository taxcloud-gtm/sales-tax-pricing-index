import type { ProviderData } from '../../../calculator/src/data/types';
import { productJsonLd } from './product';
import { pairSummary, whichIsCheaper } from '../comparison-summary';
import { money, terminate } from '../format';
import { absoluteUrl } from '../utils';
import { pairPath } from '../slugs';

export interface PairFaqEntry {
  q: string;
  a: string;
}

export function pairFaqEntries(a: ProviderData, b: ProviderData): PairFaqEntry[] {
  const aName = a.provider.name;
  const bName = b.provider.name;
  const entries: PairFaqEntry[] = [];

  entries.push({
    q: `How does ${aName} pricing compare to ${bName}?`,
    // includeQuestion: false — the question is this entry's `q`.
    a: pairSummary(a, b, { includeQuestion: false }),
  });

  entries.push({
    q: `Which is cheaper, ${aName} or ${bName}?`,
    a: whichIsCheaper(a, b),
  });

  // SST head-to-head
  if (a.sst && b.sst) {
    if (a.sst.is_csp && b.sst.is_csp) {
      entries.push({
        q: `Are both ${aName} and ${bName} SST certified?`,
        a: `Yes. Both are Certified Service Providers in the Streamlined Sales Tax (SST) Program, which means free filings in SST member states for customers who qualify.${a.sst.sst_member_states_covered_free ? ` ${aName} publishes free filing in all ${a.sst.sst_member_states_covered_free} member states.` : ''}${b.sst.sst_member_states_covered_free ? ` ${bName} publishes free filing in all ${b.sst.sst_member_states_covered_free} member states.` : ''}`,
      });
    } else if (a.sst.is_csp || b.sst.is_csp) {
      const csp = a.sst.is_csp ? aName : bName;
      const not = a.sst.is_csp ? bName : aName;
      const cspCovered = (a.sst.is_csp ? a.sst : b.sst).sst_member_states_covered_free;
      entries.push({
        q: `Is ${aName} or ${bName} SST certified?`,
        a: `${csp} is. ${not} isn't. SST certification means free filings in SST member states for customers who qualify (no physical nexus in those states)${cspCovered ? `, and ${csp} covers all ${cspCovered} of them` : ''}, which materially shifts the math against ${not} for high-volume sellers.`,
      });
    } else {
      entries.push({
        q: `Are ${aName} or ${bName} SST certified?`,
        a: `Neither. Without SST certification, you'll pay full per-filing fees in every state, including the 24 SST member states.`,
      });
    }
  }

  // International
  const aIntl = (a.international?.supports_vat || a.international?.supports_gst);
  const bIntl = (b.international?.supports_vat || b.international?.supports_gst);
  if (aIntl && bIntl) {
    entries.push({
      q: `Do ${aName} and ${bName} both support international VAT and GST?`,
      a: `Yes. Both extend beyond US sales tax. ${aName} covers ${a.international?.countries_covered ?? 'multiple'} countries; ${bName} covers ${b.international?.countries_covered ?? 'multiple'}.`,
    });
  } else if (aIntl || bIntl) {
    const intl = aIntl ? aName : bName;
    const us = aIntl ? bName : aName;
    entries.push({
      q: `Does ${aName} or ${bName} support international VAT and GST?`,
      a: `${intl} does. ${us} is US sales tax only. If you sell internationally, you'll need a separate solution.`,
    });
  }

  // Per-filing comparison — always answerable
  entries.push({
    q: `Does ${aName} or ${bName} charge per filing?`,
    a: perFilingAnswer(a, b),
  });

  // Target-customer fit — always answerable
  entries.push({
    q: `Who is each one built for?`,
    a: `${aName} targets ${terminate(a.provider.target_icp ?? 'a broad customer base')} ${bName} targets ${terminate(b.provider.target_icp ?? 'a broad customer base')} The fit question matters more than the price one. Buy the product that actually covers your situation.`,
  });

  // Transparency
  if (a.transparency.tier !== b.transparency.tier) {
    entries.push({
      q: `Is ${aName} or ${bName} more transparent on pricing?`,
      a: tierComparisonAnswer(a, b),
    });
  }

  return entries;
}

function perFilingAnswer(a: ProviderData, b: ProviderData): string {
  const aName = a.provider.name;
  const bName = b.provider.name;
  const aHas = a.filings?.has_per_filing_fee;
  const bHas = b.filings?.has_per_filing_fee;
  const aAmt = a.filings?.base_cost?.amount;
  const bAmt = b.filings?.base_cost?.amount;
  const dollarsFor = (has: boolean | undefined, amt: number | null | undefined) =>
    has && typeof amt === 'number' ? ` (${money(amt)}/filing)` : '';

  if (aHas && bHas) {
    return `Yes. Both charge per-state filing fees on top of subscription. ${aName}${dollarsFor(aHas, aAmt)}, ${bName}${dollarsFor(bHas, bAmt)}. That cost compounds across every state you file in.`;
  }
  if (aHas) {
    return `${aName} does${dollarsFor(aHas, aAmt)}. ${bName} doesn't; its subscription includes filings, so cost scales with volume instead.`;
  }
  if (bHas) {
    return `${bName} does${dollarsFor(bHas, bAmt)}. ${aName} doesn't; its subscription includes filings, so cost scales with volume instead.`;
  }
  return `Neither one does. Both bundle filings into the subscription; cost scales with volume rather than per-state count.`;
}

function tierComparisonAnswer(a: ProviderData, b: ProviderData): string {
  const aName = a.provider.name;
  const bName = b.provider.name;
  const rank = { transparent: 3, partial: 2, opaque: 1 } as const;
  const aRank = rank[a.transparency.tier];
  const bRank = rank[b.transparency.tier];
  const more = aRank > bRank ? aName : bName;
  const less = aRank > bRank ? bName : aName;
  const moreTier = aRank > bRank ? a.transparency.tier : b.transparency.tier;
  const lessTier = aRank > bRank ? b.transparency.tier : a.transparency.tier;
  return `${more} is ${moreTier} on pricing; ${less} is ${lessTier}. Translation: ${more === a.provider.name && moreTier === 'transparent' || more === b.provider.name && moreTier === 'transparent' ? `you can find ${more}'s real prices without a sales call` : `${more} shows more`}; ${less} requires more back-and-forth with their sales team to get a number you can budget around.`;
}

export function pairJsonLd(a: ProviderData, b: ProviderData) {
  const url = absoluteUrl(pairPath(a.provider.slug, b.provider.slug));
  const productA = productJsonLd(a);
  const productB = productJsonLd(b);
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairFaqEntries(a, b).map((e) => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: { '@type': 'Answer', text: e.a },
    })),
  };
  const table = {
    '@context': 'https://schema.org',
    '@type': 'Table',
    name: `${a.provider.name} vs ${b.provider.name} pricing comparison`,
    description: `Side-by-side comparison of subscription pricing, filing fees, registration fees, transaction fees, and supported features for ${a.provider.name} and ${b.provider.name}.`,
    url,
  };
  return [productA, productB, faqPage, table];
}

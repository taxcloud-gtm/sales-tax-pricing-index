/**
 * corrections.ts — the site's public corrections log.
 *
 * Why this exists. This site asks readers to trust dated, sourced pricing
 * published by a vendor that appears in its own comparison. The single
 * strongest thing it can do to earn that is keep a public, permanent record of
 * every time it got something wrong, including and especially the times the
 * error ran in the operator's favour. A disclosure line says "we might be
 * biased". A corrections log shows what happened when we were.
 *
 * Two rules keep the log honest rather than decorative:
 *
 *   1. ONLY LOG WHAT WAS PUBLISHED. Errors caught in review before a page
 *      shipped do not belong here. Including near-misses would pad the list
 *      and make the published record look worse than it is, which is its own
 *      kind of dishonesty. Pre-publication catches belong in the internal
 *      changelogs.
 *
 *   2. STATE WHO THE ERROR FAVOURED. A flat list of corrections is easy to
 *      read as thoroughness. Classifying each one by direction is the part
 *      that can embarrass the publisher, which is why the page counts them.
 *
 * Add an entry whenever a published figure, claim, or characterisation changes
 * because it was wrong. Not for routine data refreshes, which belong in
 * /changelog, and not for new pages or features.
 *
 * ONE MANUAL DEPENDENCY: public/llms.txt restates the per-direction counts in
 * prose, because it is a static file and cannot read this array. Update the
 * "## Corrections" section there when you add an entry, or it will drift.
 */

export type CorrectionDirection =
  /** The error made TaxCloud, which operates this site, look better. */
  | 'favoured-operator'
  /** The error made TaxCloud look worse. */
  | 'against-operator'
  /** The error misstated another vendor to that vendor's disadvantage. */
  | 'against-vendor'
  /** The error cut both ways, or had no directional advantage. */
  | 'mixed'
  /** Accuracy or consistency, with no advantage to anyone. */
  | 'neutral';

export const DIRECTION_LABEL: Record<CorrectionDirection, string> = {
  'favoured-operator': 'Favoured this site’s operator',
  'against-operator': 'Worked against this site’s operator',
  'against-vendor': 'Misstated another vendor',
  mixed: 'Cut both ways',
  neutral: 'No directional advantage',
};

export interface Correction {
  /** Stable slug, so a correction can be linked to directly and forever. */
  id: string;
  /** ISO date the correction shipped. */
  date: string;
  /** One line naming what was wrong, in the reader's terms. */
  headline: string;
  /** What the site said before. */
  said: string;
  /** What it says now, and why. */
  now: string;
  direction: CorrectionDirection;
  /** The figures that moved, where any did. Omit when nothing numeric changed. */
  magnitude?: string;
  /** Where the reader would have seen it. */
  surfaces: string;
}

/**
 * Newest first. Every entry below describes something that was live on
 * salestaxpricingindex.org and is no longer.
 */
export const CORRECTIONS: readonly Correction[] = [
  {
    id: 'sst-free-filing-basis-2026-08-19',
    date: '2026-08-19',
    headline: 'We understated TaxCloud’s own price by about 35%',
    said:
      'Filings in Streamlined Sales Tax member states were priced and then credited back at the pay-as-you-go rate for a single return, most recently $45. Correcting that rate upward in August 2026 made the error larger rather than smaller, which is how it was eventually noticed. That credit was subtracted from a tiered annual filing subscription whose effective rate is $20 to $33 per return, so the credit was worth more than the cost it was reducing and grew faster than it.',
    now:
      'Returns in SST member states are not charged at all and do not consume the filing subscription, so they leave the filing count before the subscription is priced. There is no credit line, because there is no discount: the returns are simply not billed. Confirmed with TaxCloud directly.',
    direction: 'favoured-operator',
    magnitude:
      'Mid-market profile: TaxCloud $4,598 → $6,998 per year. SMB profile: $3,298 → $4,298. The spread across all eight platforms narrowed from 7.8× to 5.1×. The value of qualifying for CSP status fell from $5,400 to $3,000 per year.',
    surfaces:
      'The homepage price table, the TaxCloud pricing page, all 28 comparison pages, the calculator, and the structured data those pages publish for AI answer engines.',
  },
  {
    id: 'sst-credit-filing-frequency-2026-08-19',
    date: '2026-08-19',
    headline: 'Quarterly filers were credited three times the returns they actually file',
    said:
      'The free-filing calculation assumed twelve returns per year in every SST state regardless of the filing cadence entered, so a business filing quarterly in ten member states was credited 120 free returns.',
    now:
      'Free returns are derived from the filing count actually entered. A quarterly filer in ten member states is credited forty.',
    direction: 'favoured-operator',
    magnitude:
      'At a 20-state, 80-return profile the effect was severe enough to zero out TaxCloud’s entire filing subscription. It now prices at $5,298 per year.',
    surfaces: 'The calculator, for anyone who selected quarterly or annual filing.',
  },
  {
    id: 'sst-registrations-not-free-2026-08-19',
    date: '2026-08-19',
    headline: 'We charged for state registrations that TaxCloud does not charge for',
    said:
      'Every new state registration was priced at $249, including registrations in SST member states, which are covered under CSP enrollment at no charge.',
    now: 'Member-state registrations are excluded, matching the treatment already applied to the other certified provider in the set.',
    direction: 'against-operator',
    magnitude:
      'No published figure moved, because both of the buyer profiles this site publishes assume no new registrations. It affected anyone who entered a registration backlog in the calculator.',
    surfaces: 'The calculator only.',
  },
  {
    id: 'zamp-plan-name-2026-08-19',
    date: '2026-08-19',
    headline: 'We were still calling a Zamp plan by a name Zamp had retired',
    said: 'Three descriptive fields referred to Zamp’s "Global plan".',
    now:
      'Zamp renamed that tier "U.S. + Canada" in April 2026. The site had recorded the rename in its changelog but three surrounding fields kept the old name.',
    direction: 'neutral',
    surfaces: 'The Zamp pricing page and the calculator’s notes on Zamp.',
  },
  {
    id: 'taxcloud-own-pricing-2026-08-18',
    date: '2026-08-18',
    headline: 'Our own listing was wrong in both directions at once',
    said:
      'The site advertised a TaxCloud Free plan that no longer existed, an order-volume tier that does not exist at all, five incorrect values in the Starter price ladder and six in Premium, and a pay-as-you-go filing fee of $39.',
    now:
      'Every plan, tier and fee was re-verified against TaxCloud’s published pricing page. The Free plan is gone, both ladders are corrected, and the pay-as-you-go filing fee is $45.',
    direction: 'mixed',
    magnitude:
      'A free plan that does not exist flattered us. The phantom higher tiers made us look more expensive than we are. On the mid-market profile the net correction moved TaxCloud from about $8,118 to $4,598.',
    surfaces: 'The TaxCloud pricing page, the homepage, every comparison page, and the calculator.',
  },
  {
    id: 'order-tier-ceiling-silent-2026-08-18',
    date: '2026-08-18',
    headline: 'Buyers past the top published tier were quietly quoted the ceiling price',
    said:
      'A business with more orders than the largest published tier covers was shown that tier’s price with no indication that its real cost would be higher.',
    now:
      'The estimate carries a caveat naming the ceiling it hit and saying plainly that volume above it is billed extra.',
    direction: 'favoured-operator',
    magnitude:
      'It understated cost for any buyer past the ladder. The mid-market profile on this site is one of them.',
    surfaces: 'The calculator and the TaxCloud pricing page.',
  },
  {
    id: 'avalara-overstated-2026-08-18',
    date: '2026-08-18',
    headline: 'We overstated Avalara by roughly three times',
    said:
      'Avalara was modeled as quote-only at every revenue level, with a mid-market range of $44,640 to $75,385 per year drawn from buyer-reported contract data.',
    now:
      'Avalara published per-state list pricing on 30 July 2026. Buyers under $50M in revenue on a supported non-ERP integration are now priced from that published rate. Enterprise and ERP buyers, who remain quote-only, still get the range.',
    direction: 'against-vendor',
    magnitude:
      'Mid-market Avalara: $44,640–$75,385 → from $14,980 per year. Avalara moved from second-most-expensive to fourth, and the gap between TaxCloud and Avalara closed from roughly five times to about three.',
    surfaces: 'The Avalara pricing page, the homepage, all seven Avalara comparison pages, and the calculator.',
  },
  {
    id: 'sphere-invented-figure-2026-08-18',
    date: '2026-08-18',
    headline: 'We published a Sphere price we had invented ourselves',
    said:
      'A $1,200 annual figure for Sphere, carrying this site’s highest confidence rating. It was not a Sphere price. It was our own arithmetic, multiplying a published monthly rate by twelve, presented as though a vendor had published it.',
    now:
      'Removed. Sphere’s published rate is stated as a rate, and where Sphere does not publish a price the site says so. This is the specific failure this site exists to avoid, and it happened here.',
    direction: 'against-vendor',
    surfaces: 'The Sphere pricing page and every Sphere comparison page.',
  },
  {
    id: 'sphere-transparency-tier-2026-08-18',
    date: '2026-08-18',
    headline: 'We rated Sphere fully transparent after it stopped being',
    said: 'Sphere was rated "transparent", the site’s top pricing-disclosure rating.',
    now:
      'Sphere had added a quote-only Growth tier and capped its published Starter rate below ten regions. Downgraded to "partial", with the reasoning stated on its page.',
    direction: 'against-vendor',
    surfaces: 'The Sphere pricing page and its comparison pages.',
  },
  {
    id: 'taxjar-filing-bundles-2026-08-18',
    date: '2026-08-18',
    headline: 'We overstated TaxJar at high filing volumes',
    said:
      'Filings were priced at TaxJar’s per-return rate multiplied by volume, ignoring the discounted filing bundles TaxJar publishes in its help centre.',
    now: 'The calculator takes whichever is cheaper for the buyer, pay-as-you-go or the best-fitting bundle.',
    direction: 'against-vendor',
    magnitude: 'The correction lowered TaxJar’s modeled cost at high filing counts.',
    surfaces: 'The TaxJar pricing page, its comparison pages, and the calculator.',
  },
  {
    id: 'kintsugi-misquote-2026-08-18',
    date: '2026-08-18',
    headline: 'We put words in Kintsugi’s mouth',
    said:
      'A quotation attributed to Kintsugi’s pricing page about having no fees, in wording that was no longer on the page.',
    now:
      'The current wording, quoted verbatim with the date it was read. The substance of Kintsugi’s claim had not changed, but we were presenting our paraphrase as their quotation.',
    direction: 'against-vendor',
    surfaces: 'The Kintsugi pricing page and its comparison pages.',
  },
  {
    id: 'sst-plan-gating-2026-08-18',
    date: '2026-08-18',
    headline: 'We said TaxCloud’s SST coverage was narrower than it is',
    said:
      'That SST free filing required TaxCloud’s Premium plan, and hedged coverage as "up to 24" member states.',
    now:
      'SST is available on every TaxCloud plan and covers all 24 member states including Tennessee. An intermediate draft of the correction got this wrong in the same direction by treating a TaxCloud help-centre article as authoritative; that article is itself incorrect and is flagged for fixing.',
    direction: 'against-operator',
    surfaces: 'The TaxCloud pricing page, the calculator’s structured data, and every comparison page mentioning SST.',
  },
  {
    id: 'csp-count-2026-08-18',
    date: '2026-08-18',
    headline: 'We miscounted the certified providers',
    said: 'That TaxCloud was one of six providers offering free services under the SST programme.',
    now:
      'Five: Avalara, TaxCloud, Sovos, AccurateTax and Avior. Exactor is certified but the Governing Board records it as not currently offering free services, which is where the sixth came from.',
    direction: 'neutral',
    surfaces: 'Every page describing SST certification.',
  },
  {
    id: 'calculator-zero-state-2026-08-18',
    date: '2026-08-18',
    headline: 'The calculator told search engines the cheapest provider was free',
    said:
      'With no inputs entered, the calculator ranked providers that charge no fixed platform fee at $0 per year and put them first. That empty state was server-rendered, so crawlers and AI answer engines read "the cheapest option costs $0" directly above a static table saying otherwise.',
    now:
      'No ranking is shown until real inputs are entered. The static table above it, which is correct, is the only ranking a crawler sees.',
    direction: 'neutral',
    surfaces: 'The calculator, in what search engines and AI crawlers indexed rather than what a person saw.',
  },
  {
    id: 'uncaveated-estimates-2026-08-18',
    date: '2026-08-18',
    headline: 'The most-quoted numbers on the site appeared without their qualifications',
    said:
      'Caveats were rendered only on the calculator’s own result cards. Provider and comparison pages showed the headline figure alone, stripped of the assumptions and limits that make it defensible.',
    now: 'Every estimate carries its caveats on every page that shows it.',
    direction: 'neutral',
    surfaces: 'All eight provider pages and 25 comparison pages.',
  },
  {
    id: 'faq-template-defects-2026-08-18',
    date: '2026-08-18',
    headline: 'Generated answers repeated their own questions and stopped mid-sentence',
    said:
      'Across 36 generated pages: answers that began by restating the question they were answering, five pages whose answers were cut off mid-sentence with an ellipsis, a summary sentence printed twice in a row, and stray double full stops.',
    now: 'All fixed, and the generators no longer truncate text at all. An answer is included whole or not included.',
    direction: 'neutral',
    surfaces: 'All eight provider pages and all 28 comparison pages, in both the visible text and the structured data.',
  },
];

export function correctionsByDirection(): Record<CorrectionDirection, Correction[]> {
  const out: Record<CorrectionDirection, Correction[]> = {
    'favoured-operator': [],
    'against-operator': [],
    'against-vendor': [],
    mixed: [],
    neutral: [],
  };
  for (const c of CORRECTIONS) out[c.direction].push(c);
  return out;
}

/** The liftable answer, computed so it cannot drift from the log. */
export function correctionsSummary(): string {
  const by = correctionsByDirection();
  const total = CORRECTIONS.length;
  const dates = CORRECTIONS.map((c) => c.date).sort();
  return (
    `The Sales Tax Pricing Index has published ${total} corrections to date, between ` +
    `${dates[0]} and ${dates[dates.length - 1]}. ` +
    `${by['favoured-operator'].length} were errors that made TaxCloud, which operates this site, ` +
    `look better than its own published pricing supports. ` +
    `${by['against-operator'].length} made TaxCloud look worse. ` +
    `${by['against-vendor'].length} misstated a competitor to that competitor's disadvantage. ` +
    `${by.mixed.length} cut both ways and ${by.neutral.length} were accuracy or consistency fixes ` +
    `with no advantage to anyone. The largest single correction understated TaxCloud's own price ` +
    `by about 35%.`
  );
}

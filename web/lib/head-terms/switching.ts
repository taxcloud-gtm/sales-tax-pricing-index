/**
 * switching.ts — derivations behind /cost-to-switch-from-{provider}.
 *
 * Built as one engine over every tracked provider rather than as a page about
 * Avalara. The site's publisher competes with every vendor here, so a
 * switching-cost page that exists only for the largest competitor is an
 * argument, not a reference. Eight identical pages generated from the same
 * function are a reference.
 *
 * What the model does and does not claim:
 *
 *   Quantified   the annual run-rate you leave, the annual run-rate you arrive
 *                at, the difference, and any one-time entry fee that is
 *                actually recorded.
 *   Named        exit friction that is recorded: contract term options,
 *                cancellation language, multi-year discounting (which usually
 *                implies a multi-year term).
 *   Refused      internal hours, parallel-run periods, historical data
 *                migration, and re-implementation effort. Real, often dominant,
 *                and not derivable from published pricing. Inventing a number
 *                for them is the exact failure mode this site exists to avoid.
 *
 * One structural point the page should make and the data supports: switching
 * sales tax software does not usually mean re-registering. Your state permits
 * are yours; the vendor files under them. That is why per-registration fees
 * mostly do not apply to a switch, and the model leaves them out unless the
 * buyer is adding states at the same time.
 */
import type { ProviderData } from '../../../calculator/src/data/types';
import type { ProviderEstimate } from '../../../calculator/src/types';
import { calculate } from '../calc-client';
import { estimateFloor, money, renderEstimate } from '../format';

/**
 * renderEstimate() capitalises "From $X" because it is normally rendered as a
 * standalone table cell. Mid-sentence that reads as a typo, so prose uses this.
 */
function inProse(e: ProviderEstimate['estimate']): string {
  return renderEstimate(e).replace(/^From /, 'from ');
}
import type { HeadTermProfile } from './profiles';

export interface ExitTerms {
  contractOptions: string[];
  cancellation: string | null;
  multiYearDiscount: boolean;
  /** Recorded fees that only bite on the way out. */
  exitFees: Array<{ name: string; description: string; source?: string }>;
  source?: string;
  /** True when the vendor publishes no cancellation language at all. */
  opaque: boolean;
}

export function exitTerms(p: ProviderData): ExitTerms {
  const c = (p.commitments as any) ?? {};
  const a = (p.add_ons as any) ?? {};
  const cancellation: string | null = c.cancellation_terms ?? null;
  const exitFees = (Array.isArray(a.other_fees) ? a.other_fees : [])
    .filter((f: any) => f?.name && /termination|cancel|exit|renewal/i.test(`${f.name} ${f.description ?? ''}`))
    .map((f: any) => ({ name: f.name, description: f.description ?? '', source: f.source }));
  return {
    contractOptions: c.contract_length_options ?? [],
    cancellation,
    multiYearDiscount: (p.discounts as any)?.multi_year_discount_available === true,
    exitFees,
    source: c.source,
    opaque: !cancellation || /not publicly disclosed|not published/i.test(cancellation),
  };
}

export interface EntryCost {
  /** Published or buyer-reported one-time cost of getting live, if any. */
  label: string;
  low: number | null;
  high: number | null;
  published: boolean;
  source?: string;
  /**
   * Optional services the destination offers without a published price, from
   * add_ons.other_fees. Kept separate from the implementation fee because they
   * are not mandatory, but shown, because an "onboarding: none" cell next to an
   * unpriced "guided onboarding" service is the same omission this site exists
   * to close. The publisher is one of the vendors this applies to.
   */
  unpricedExtras: string[];
}

export function entryCost(p: ProviderData): EntryCost {
  const impl = (p.add_ons as any)?.implementation_fee;
  const unpricedExtras = (((p.add_ons as any)?.other_fees ?? []) as any[])
    .filter((f) => f?.name && (typeof f.cost !== 'number' || f.cost === 0))
    .filter((f) => /onboard|implement|migrat|setup|set-up|training/i.test(`${f.name} ${f.description ?? ''}`))
    .map((f) => f.name as string);

  if (!impl) {
    return { label: 'Nothing recorded either way', low: null, high: null, published: false, unpricedExtras };
  }
  if (impl.has_fee === false) {
    const statesIt = p.transparency.publishes_implementation_fees === true;
    return {
      label: statesIt
        ? 'No implementation fee, stated on the pricing page'
        : 'No implementation fee on record, and the vendor does not address it',
      // Only treat zero as a known zero when the vendor actually says so.
      // Inferring $0 from an absence turned every silent vendor into an
      // "Immediate" payback, which is a guess wearing a calculation's clothes.
      low: statesIt ? 0 : null,
      high: statesIt ? 0 : null,
      published: statesIt,
      source: impl.source,
      unpricedExtras,
    };
  }
  if (typeof impl.amount === 'number' && impl.amount > 0) {
    return {
      label: `${money(impl.amount)} one-time`,
      low: impl.amount,
      high: impl.amount,
      published: true,
      source: impl.source,
      unpricedExtras,
    };
  }
  if (typeof impl.range_min === 'number' && typeof impl.range_max === 'number') {
    return {
      label: `${money(impl.range_min)}–${money(impl.range_max)} reported by buyers, nothing published`,
      low: impl.range_min,
      high: impl.range_max,
      published: false,
      source: impl.source,
      unpricedExtras,
    };
  }
  return { label: 'Charged, amount not published', low: null, high: null, published: false, source: impl.source, unpricedExtras };
}

export interface Destination {
  slug: string;
  name: string;
  estimate: ProviderEstimate;
  /** Annual difference vs the incumbent, by floor. Negative means cheaper. */
  annualDelta: number;
  entry: EntryCost;
  /**
   * Months for the annual saving to cover the one-time entry cost, as a range
   * when the entry cost is itself a range. Null when the saving or the entry
   * cost is unknown.
   *
   * Deliberately a range and not a midpoint: the one recorded implementation
   * figure in this set spans $2,500 to $50,000, a factor of twenty, sourced
   * from buyer reports rather than the vendor. Collapsing that to a single
   * payback month would present a guess with the confidence of a calculation.
   */
  paybackMonths: { low: number; high: number } | null;
  isPublisher: boolean;
}

export interface SwitchingAnalysis {
  from: ProviderData;
  fromEstimate: ProviderEstimate;
  profile: HeadTermProfile;
  exit: ExitTerms;
  destinations: Destination[];
  cheaperCount: number;
  pricierCount: number;
}

export function switchingAnalysis(
  from: ProviderData,
  profile: HeadTermProfile,
  providers: Map<string, ProviderData>,
): SwitchingAnalysis | null {
  let results: ProviderEstimate[];
  try {
    results = calculate(profile.inputs, providers);
  } catch {
    return null;
  }
  const fromEstimate = results.find((r) => r.slug === from.provider.slug);
  if (!fromEstimate) return null;
  const fromFloor = estimateFloor(fromEstimate.estimate);

  const destinations: Destination[] = results
    .filter((r) => r.slug !== from.provider.slug)
    .map((r) => {
      const data = providers.get(r.slug);
      const entry: EntryCost = data
        ? entryCost(data)
        : { label: 'Nothing recorded either way', low: null, high: null, published: false, unpricedExtras: [] };
      const delta = estimateFloor(r.estimate) - fromFloor;
      const saving = -delta;
      const paybackMonths =
        saving > 0 && entry.low != null && entry.high != null
          ? {
              low: entry.low === 0 ? 0 : Math.ceil((entry.low / saving) * 12),
              high: entry.high === 0 ? 0 : Math.ceil((entry.high / saving) * 12),
            }
          : null;
      return {
        slug: r.slug,
        name: r.provider,
        estimate: r,
        annualDelta: delta,
        entry,
        paybackMonths,
        isPublisher: r.slug === 'taxcloud',
      };
    })
    .sort((a, b) => a.annualDelta - b.annualDelta);

  return {
    from,
    fromEstimate,
    profile,
    exit: exitTerms(from),
    destinations,
    cheaperCount: destinations.filter((d) => d.annualDelta < 0).length,
    pricierCount: destinations.filter((d) => d.annualDelta > 0).length,
  };
}

/** The liftable answer, complete with its own qualifiers. */
export function switchingAnswerSentence(a: SwitchingAnalysis): string {
  const cheapest = a.destinations[0];
  // When nothing is cheaper, say so. Reporting destinations[0] as "the largest
  // saving" regardless of sign produced a sentence that contradicted the count
  // in the same breath ("0 of 7 are cheaper... largest saving is $4,035").
  const outcome =
    a.cheaperCount === 0
      ? `no tracked alternative is cheaper on published pricing. The closest is ` +
        `${cheapest ? `${cheapest.name} at ${money(Math.abs(cheapest.annualDelta))} per year more` : 'not computable'}`
      : `${a.cheaperCount} of ${a.destinations.length} ${a.cheaperCount === 1 ? 'alternatives is' : 'alternatives are'} cheaper on published pricing. ` +
        `The largest modeled saving is ${cheapest ? `${money(Math.abs(cheapest.annualDelta))} per year with ${cheapest.name}` : 'none'}`;
  const termNote = a.exit.contractOptions.includes('multi_year')
    ? `${a.from.provider.name} sells annual and multi-year terms, so the timing of a switch matters more than the mechanics of it`
    : a.exit.contractOptions.includes('month_to_month')
      ? `${a.from.provider.name} publishes month-to-month terms, so there is usually no contractual penalty for leaving`
      : a.exit.contractOptions.includes('annual')
        ? `${a.from.provider.name} publishes annual terms`
        : `${a.from.provider.name} publishes no contract term, so read your own agreement before assuming one`;
  // Counts a destination if it charges an onboarding fee, does not say whether
  // it charges one, or offers an onboarding-type service without pricing it.
  // Omitting the third case let the publisher out of its own count on seven of
  // the eight pages, because it records optional guided onboarding "for an
  // additional fee" with no amount.
  const withOnboarding = a.destinations.filter(
    (d) => (d.entry.low ?? 0) > 0 || d.entry.low === null || d.entry.unpricedExtras.length > 0,
  ).length;
  return (
    `No tracked alternative to ${a.from.provider.name} charges a migration or transfer fee, but ` +
    `${withOnboarding} of the ${a.destinations.length} either charge a one-time onboarding cost or do not say. ` +
    `The cost of a switch is the difference in run-rate, plus that one-time cost, plus whatever remains on ` +
    `your current term. On the ${a.profile.inputSummary} profile, ` +
    `${a.from.provider.name} runs ${inProse(a.fromEstimate.estimate)} per year, and ${outcome[0].toLowerCase()}${outcome.slice(1)}. ` +
    `${termNote}. Your state sales tax permits stay yours in a switch, so there is normally nothing to re-register.`
  );
}

/** Things the model deliberately refuses to price. Same list on every page. */
export const NOT_QUANTIFIED: ReadonlyArray<{ item: string; why: string }> = [
  {
    item: 'Implementation hours from your own team',
    why: 'Re-mapping product taxability, re-testing checkout, and reconciling the first few filing periods. Usually the largest real cost of a switch and impossible to derive from published pricing.',
  },
  {
    item: 'A parallel run',
    why: 'Most finance teams run both systems for one or two filing periods before cutting over. That is a period of paying twice, and its length is a decision you make rather than a price a vendor sets.',
  },
  {
    item: 'Historical data migration',
    why: 'Exporting transaction history and filed returns from the incumbent. Export capability varies and is rarely documented publicly.',
  },
  {
    item: 'Remaining term on your current contract',
    why: 'The single biggest variable, and specific to your paperwork. Check your renewal date and any auto-renewal notice window before anything else.',
  },
  {
    item: 'Open state notices and audits',
    why: 'Work in progress does not transfer cleanly. Who answers a notice about a return your old vendor filed is a question to settle in writing before you move.',
  },
];

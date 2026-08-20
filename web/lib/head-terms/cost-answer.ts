/**
 * cost-answer.ts — derivations behind /how-much-does-sales-tax-software-cost.
 *
 * The page answers one query and nothing else: what does this category cost.
 * Everything here is computed from the same provider YAML and the same
 * calculator the rest of the site uses, so the head-term page can never drift
 * from the provider pages it links to.
 */
import type { ProviderData, PricingModel } from '../../../calculator/src/data/types';
import type { ProviderEstimate } from '../../../calculator/src/types';
import { calculate } from '../calc-client';
import { estimateFloor, money, renderEstimate } from '../format';

/**
 * renderEstimate() capitalises "From $X" for standalone table cells. Used
 * mid-sentence that reads as a typo, so all prose in this module goes through
 * here. Today the priciest provider happens to be an exact price, so the bug
 * would not show; it would appear the moment a "from" price is the ceiling.
 */
function inProse(e: ProviderEstimate['estimate']): string {
  return renderEstimate(e).replace(/^From /, 'from ');
}
import { CANONICAL_PROFILES, type HeadTermProfile } from './profiles';

/** Highest defensible figure for an estimate: top of a range, else the point. */
export function estimateCeiling(e: ProviderEstimate['estimate']): number {
  switch (e.type) {
    case 'exact':
    case 'starting_at':
      return e.annualCostUSD;
    case 'range':
      return e.annualCostMaxUSD;
    case 'quote_required':
      // Not NEGATIVE_INFINITY: a non-finite ceiling makes profileBand() return
      // null, which silently removes the profile from the band table, the
      // headline range, the meta description and the FAQ. Fall back to the
      // floor so an unpriced provider narrows the range rather than deleting it.
      return e.startingAtUSD ?? estimateFloor(e);
  }
}

export interface ProfileBand {
  profile: HeadTermProfile;
  results: ProviderEstimate[];
  low: number;
  high: number;
  multiple: number;
  cheapest: ProviderEstimate;
  priciest: ProviderEstimate;
  /** Middle of the ranked list, by floor. A more honest "typical" than a mean. */
  median: number;
}

export function profileBand(
  profile: HeadTermProfile,
  providers: Map<string, ProviderData>,
): ProfileBand | null {
  let results: ProviderEstimate[];
  try {
    results = calculate(profile.inputs, providers);
  } catch {
    return null;
  }
  if (results.length === 0) return null;

  const sorted = [...results].sort((a, b) => estimateFloor(a.estimate) - estimateFloor(b.estimate));
  const floors = sorted.map((r) => estimateFloor(r.estimate)).filter(Number.isFinite);
  const cheapest = sorted[0];
  // Highest by ceiling, not by floor. A quote-only vendor whose observed range
  // tops out above the highest published price is genuinely the top of the
  // category range, and ranking by floor would hide that.
  const priciest = [...sorted].sort((a, b) => estimateCeiling(a.estimate) - estimateCeiling(b.estimate))[
    sorted.length - 1
  ];
  const low = estimateFloor(cheapest.estimate);
  const high = estimateCeiling(priciest.estimate);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0) return null;

  const mid = floors.length
    ? floors.length % 2 === 1
      ? floors[(floors.length - 1) / 2]
      : Math.round((floors[floors.length / 2 - 1] + floors[floors.length / 2]) / 2)
    : low;

  return {
    profile,
    results: sorted,
    low,
    high,
    multiple: high / low,
    cheapest,
    priciest,
    median: mid,
  };
}

export function canonicalBands(providers: Map<string, ProviderData>): ProfileBand[] {
  return CANONICAL_PROFILES.map((p) => profileBand(p, providers)).filter(
    (b): b is ProfileBand => b !== null,
  );
}

/**
 * The single liftable answer. Every qualifier is inline so the sentence
 * survives being quoted without the page around it.
 */
export function costAnswerSentence(
  bands: ProfileBand[],
  providerCount: number,
  families: PricingFamily[] = [],
): string {
  if (bands.length === 0) return '';
  const low = Math.min(...bands.map((b) => b.low));
  const high = Math.max(...bands.map((b) => b.high));
  const parts = bands
    .map((b) => `${b.profile.name} (${b.profile.inputSummary}) runs ${money(b.low)} to ${money(b.high)}`)
    .join(', and ');
  const modelList = families.length
    ? families.map((f) => f.label.toLowerCase()).join(', ')
    : 'per-state, per-filing, per-order and quote-only';
  return (
    `Sales tax compliance software costs roughly ${money(low)} to ${money(high)} per year for a US ` +
    `ecommerce business filing in 10 to 20 states, across the ${providerCount} platforms tracked here. ` +
    `On the two profiles this site publishes, ${parts}. ` +
    `The spread is driven less by features than by pricing model: the ${providerCount} platforms use ` +
    `${families.length || 4} incompatible ones (${modelList}), which produce very different bills for the same work.`
  );
}

// -----------------------------------------------------------------------------
// Pricing model families — "what actually drives your bill"
// -----------------------------------------------------------------------------
export interface PricingFamily {
  model: PricingModel;
  label: string;
  /** What the bill moves with, in buyer language. */
  driver: string;
  /** Who it suits and who it punishes. Stated symmetrically. */
  suits: string;
  punishes: string;
  members: ProviderData[];
}

const FAMILY_COPY: Record<
  string,
  { label: string; driver: string; suits: string; punishes: string }
> = {
  subscription_tiered: {
    label: 'Tiered subscription on order volume',
    driver: 'How many orders you process, plus how many returns you file.',
    suits: 'Predictable order volume. You know the bill a year out, and the price per order falls as you grow into a tier.',
    punishes: 'Spiky volume. Crossing a tier boundary in one strong month re-prices the whole subscription, and overage handling differs by vendor.',
  },
  per_filing: {
    label: 'Per filing and per registration',
    driver: 'The number of returns filed and permits registered. Nothing else.',
    suits: 'A narrow state footprint, or a quarterly filing cadence. Ten states filing quarterly costs a quarter of ten states filing monthly.',
    punishes: 'A wide footprint. At 45 states filing monthly, per-filing pricing is the most expensive model in the set.',
  },
  per_region_flat: {
    label: 'Flat rate per state or region',
    driver: 'How many states you are registered in. Volume within a state is mostly irrelevant until a threshold.',
    suits: 'High volume in few states. Order count can grow a long way before the bill moves.',
    punishes: 'A wide, thin footprint. Twenty small states cost the same as twenty large ones.',
  },
  per_transaction: {
    label: 'Percentage of taxable revenue',
    driver: 'Taxable transaction volume in dollars, charged in basis points.',
    suits: 'Low revenue with many jurisdictions. The bill starts near zero.',
    punishes: 'Growth. The bill scales with revenue whether or not the compliance work got harder.',
  },
  custom_quote: {
    label: 'Quote only',
    driver: 'Whatever the sales team scopes: volume, states, integrations, and how much of the bundle you take.',
    suits: 'Buyers with leverage and time. Discounts are real and multi-product bundling is where they come from.',
    punishes: 'Buyers who need to budget before they buy, and anyone who cannot benchmark what they were quoted.',
  },
  hybrid: {
    label: 'Hybrid',
    driver: 'A subscription plus per-event charges.',
    suits: 'Buyers whose usage sits comfortably inside the included allowances.',
    punishes: 'Buyers who exceed them, because the marginal rate is usually the unpublished part.',
  },
  percent_of_revenue: {
    label: 'Percentage of revenue',
    driver: 'Total revenue rather than transaction count.',
    suits: 'Small revenue bases.',
    punishes: 'Growth, for the same reason as basis-point pricing.',
  },
};

export function pricingFamilies(providers: ProviderData[]): PricingFamily[] {
  const byModel = new Map<PricingModel, ProviderData[]>();
  for (const p of providers) {
    const m = p.pricing_model.primary;
    byModel.set(m, [...(byModel.get(m) ?? []), p]);
  }
  return [...byModel.entries()]
    .map(([model, members]) => {
      const copy = FAMILY_COPY[model] ?? {
        label: model.replace(/_/g, ' '),
        driver: 'Not characterized.',
        suits: 'Not characterized.',
        punishes: 'Not characterized.',
      };
      return { model, ...copy, members: [...members].sort((a, b) => a.provider.name.localeCompare(b.provider.name)) };
    })
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label));
}

// -----------------------------------------------------------------------------
// Entry points — the cheapest published way to start with each provider
// -----------------------------------------------------------------------------
/**
 * Vendors whose published monthly rate is per jurisdiction, with the vendor's
 * own word for that jurisdiction. Absent means the rate is a plan total.
 */
const RATE_UNIT: Record<string, string> = {
  anrok: 'market',
  sphere: 'region',
  avalara: 'state',
};

export interface EntryPoint {
  provider: ProviderData;
  /** Human string: "Free tier", "$19/mo", "Quote required". */
  headline: string;
  /** What that entry price does and does not include. */
  covers: string;
}

export function entryPoints(providers: ProviderData[]): EntryPoint[] {
  return providers
    .map((p) => {
      const free = p.plans.find((pl) => pl.is_free);
      const paid = p.plans
        .filter((pl) => !pl.is_free && !pl.is_quote_only && typeof pl.monthly_price.amount === 'number')
        .sort((a, b) => (a.monthly_price.amount ?? 0) - (b.monthly_price.amount ?? 0));
      const cheapestPaid = paid[0];

      // Some vendors quote a rate per jurisdiction rather than a total, each
      // using its own word for the unit. Rendering "$50/mo" for a per-market
      // rate understates the bill by the number of jurisdictions the buyer
      // files in, which on the mid-market profile is a factor of twenty.
      //
      // This is a lookup rather than a derivation because the provider schema
      // has no field for the pricing unit: `included_states` is null on every
      // per-unit plan in the set, so there is nothing to read. Each label below
      // is the vendor's own term, taken from its pricing page. Worth replacing
      // with a `monthly_price.unit` field in the YAML schema.
      const unit = `/${RATE_UNIT[p.provider.slug] ?? ''}${RATE_UNIT[p.provider.slug] ? '/' : ''}mo`;

      let headline: string;
      if (cheapestPaid) {
        const amt = cheapestPaid.monthly_price.amount as number;
        headline =
          amt === 0
            ? `${cheapestPaid.name}, no subscription fee`
            : `${cheapestPaid.name}, ${money(amt)}${unit}`;
      } else if (free) {
        headline = `${free.name} tier only, ${money(0)}/mo`;
      } else {
        headline = 'Quote required';
      }

      // What the entry price does and does not cover. Filing language is driven
      // by whether the vendor actually publishes filing fees: asserting "$X per
      // filing on top" for a vendor whose published plans bundle returns would
      // contradict the calculator on the same site.
      const bits: string[] = [];
      const publishesFilings = p.transparency.publishes_filing_fees === true;
      const tiers = p.filings.tier_pricing ?? [];
      const perFiling = p.filings.base_cost?.amount;
      const perReg = p.registrations.has_per_registration_fee ? p.registrations.base_cost?.amount : null;

      if (!cheapestPaid && free) {
        bits.push('no paid tier published, so filing is quote-only');
      } else if (tiers.length > 0) {
        const lo = tiers[0];
        const hi = tiers[tiers.length - 1];
        bits.push(
          `filings bought as an annual tier, ${money(Math.round(hi.annual_price / hi.filings))}–${money(Math.round(lo.annual_price / lo.filings))} effective per filing`,
        );
      } else if (!p.filings.has_per_filing_fee) {
        bits.push('filings included in the rate');
      } else if (publishesFilings && typeof perFiling === 'number' && perFiling > 0) {
        bits.push(`${money(perFiling)} per filing on top`);
      } else if (cheapestPaid?.features.multi_state_filing) {
        // The vendor charges for filing somewhere in its range but does not
        // publish the rate, and this particular plan bundles returns. Saying
        // "filing terms not published" here would imply filing might be extra
        // on a plan where the published price includes it.
        bits.push('returns bundled into this plan, per-filing rates elsewhere not published');
      } else {
        bits.push('filing charged separately, rate not published');
      }

      if (free && cheapestPaid) bits.push(`a free tier exists but does not file`);
      if (typeof perReg === 'number' && perReg > 0) bits.push(`${money(perReg)} per state registration`);
      else if (p.registrations.has_per_registration_fee) bits.push('registration charged, amount not published');

      return { provider: p, headline, covers: bits.join(', ') };
    })
    .sort((a, b) => a.provider.provider.name.localeCompare(b.provider.provider.name));
}

/**
 * Cost items that exist across the set but are widely unpriced. Derived, not
 * asserted: an item only appears if at least one provider records it, and the
 * count of providers that publish a number for it is computed.
 */
export interface UnpricedItem {
  label: string;
  detail: string;
  /** Heading for the `clear` column. Differs per item, so it can be accurate. */
  clearLabel: string;
  clear: string[];
  /** Heading for the `unclear` column. */
  unclearLabel: string;
  unclear: string[];
}

export function unpricedItems(providers: ProviderData[]): UnpricedItem[] {
  const out: UnpricedItem[] = [];

  const implNone: string[] = [];
  const implExists: string[] = [];
  const implUnrecorded: string[] = [];
  for (const p of providers) {
    const impl = (p.add_ons as any)?.implementation_fee;
    const name = p.provider.name;
    const saysSo = p.transparency.publishes_implementation_fees === true;
    if (!impl) { implUnrecorded.push(name); continue; }
    if (impl.has_fee === false) {
      implNone.push(saysSo ? `${name} (says so on its pricing page)` : `${name} (no fee found, not stated either way)`);
    } else if (typeof impl.amount === 'number' && impl.amount > 0) {
      implExists.push(`${name} (${money(impl.amount)}, published)`);
    } else if (typeof impl.range_min === 'number' && typeof impl.range_max === 'number') {
      implExists.push(`${name} (buyer-reported ${money(impl.range_min)}\u2013${money(impl.range_max)}; the vendor publishes nothing)`);
    } else {
      implExists.push(`${name} (charged, amount not published)`);
    }
  }
  out.push({
    label: 'Implementation and onboarding',
    detail:
      `The one-time cost of getting live: connecting the platform, mapping product taxability, and importing history. ` +
      `${implNone.length} of the ${providers.length} tracked platforms have no implementation fee on record, though only ` +
      `${providers.filter((p) => p.transparency.publishes_implementation_fees).length} address it explicitly on a pricing page. ` +
      `Where a figure exists for the rest it comes from buyer aggregators, not the vendor.`,
    clearLabel: 'No fee on record',
    clear: implNone,
    unclearLabel: 'Fee exists',
    unclear: [
      ...implExists,
      ...implUnrecorded.map((n) => `${n} (nothing recorded either way)`),
    ],
  });

  // Verified against the fields, not the self-reported transparency flag. An
  // earlier version listed three vendors under "rate published" on the strength
  // of a boolean while the fee page, reading the same data properly, showed all
  // three with no rate attached. "No overage in the model" is also kept apart
  // from "rate not published": they are different facts.
  const overageWithRate: string[] = [];
  const overageNoRate: string[] = [];
  const overageNotApplicable: string[] = [];
  for (const p of providers) {
    const models = p.plans.filter((pl) => pl.overage && pl.overage.model !== 'none');
    if (models.length === 0) { overageNotApplicable.push(p.provider.name); continue; }
    const rate = models.find(
      (pl) => typeof pl.overage?.per_unit_cost === 'number' && (pl.overage!.per_unit_cost as number) > 0,
    );
    if (rate) overageWithRate.push(`${p.provider.name} (${money(rate.overage!.per_unit_cost as number)} per unit)`);
    else overageNoRate.push(p.provider.name);
  }
  out.push({
    label: 'Overage, once you pass the included volume',
    detail:
      `Every volume-priced plan has a ceiling and a rate beyond it. The rate is the part that decides what a good ` +
      `year costs you, and it is the least published number in the category. ` +
      `${overageWithRate.length === 0
        ? `Not one of the ${overageNoRate.length} platforms whose pricing model has an overage concept attaches a rate to it in public.`
        : `${overageNoRate.length} of the ${overageWithRate.length + overageNoRate.length} platforms whose pricing model has an overage concept attach no rate to it in public.`} ` +
      (overageNotApplicable.length
        ? `The other ${overageNotApplicable.length} (${overageNotApplicable.join(', ')}) have no overage concept, which is a different thing from not publishing one.`
        : ''),
    clearLabel: 'Rate published',
    clear: overageWithRate,
    unclearLabel: 'Overage applies, no rate published',
    unclear: overageNoRate,
  });

  out.push({
    label: 'State permit fees',
    detail:
      'Charged by the state, not the software vendor, when you register for a sales tax permit. They range from nothing to a few hundred dollars per state and pass straight through. No provider on this site includes them in a subscription price, and this site does not model them.',
    clearLabel: '',
    clear: [],
    unclearLabel: 'Passed through by all',
    unclear: providers.map((p) => p.provider.name),
  });

  out.push({
    label: 'Your own team\'s hours',
    detail:
      'Reviewing returns, reconciling what the platform filed against your books, chasing exemption certificates, and answering state notices. This is usually the largest line in the real cost of compliance and no vendor can price it for you. This site does not estimate it, because any number would be invented.',
    clearLabel: '',
    clear: [],
    unclearLabel: '',
    unclear: [],
  });

  return out;
}

/** Short, complete answer for the FAQ and meta description. */
export function shortCostAnswer(bands: ProfileBand[]): string {
  if (bands.length === 0) return '';
  const low = Math.min(...bands.map((b) => b.low));
  const high = Math.max(...bands.map((b) => b.high));
  const smb = bands[0];
  const mid = bands[bands.length - 1];
  return (
    `${money(low)} to ${money(high)} per year, depending on your order volume, how many states you file in, ` +
    `and which pricing model the vendor uses. For a business doing ${smb.profile.inputSummary}, the ` +
    `${smb.results.length} tracked platforms range from ${inProse(smb.cheapest.estimate)} to ` +
    `${inProse(smb.priciest.estimate)}. For ${mid.profile.inputSummary}, ${inProse(mid.cheapest.estimate)} to ` +
    `${inProse(mid.priciest.estimate)}.`
  );
}

/**
 * fees.ts — derivations behind /sales-tax-software-hidden-fees.
 *
 * "Hidden" is used here in one narrow, defensible sense: a charge that exists
 * and that the vendor does not put a number on. It is not used to mean
 * "expensive", and it is not used as an accusation. Every row is built from a
 * recorded field, so the page cannot say a vendor hides something the data
 * does not support.
 *
 * The publisher of this site charges several of the fees below, including the
 * only credit card surcharge in the set. Those rows are computed the same way
 * as everyone else's and appear in the same tables.
 */
import type { ProviderData } from '../../../calculator/src/data/types';
import { money } from '../format';

// -----------------------------------------------------------------------------
// What each vendor publishes — the disclosure matrix
// -----------------------------------------------------------------------------
/**
 * Three states per cell, not two.
 *
 *   verified        the vendor addresses this fee in public AND the underlying
 *                   data carries the number, so the claim checks out
 *   claimed_only    the vendor's own transparency flag says it publishes this,
 *                   but no number is recorded anywhere in its data
 *   not_published   the vendor does not address it
 *   n/a             the fee does not exist in this vendor's pricing model, so
 *                   there is nothing to publish
 *
 * The `claimed_only` state exists because the transparency booleans in the
 * provider YAML are a description of each vendor's disclosure, and for the
 * publisher's own file they are self-reported. Scoring them without checking
 * them against the fields gave two vendors a perfect score while the category
 * tables on the same page showed an unpublished overage rate. Score counts
 * verified cells only, over the categories that apply to that vendor.
 */
export type DisclosureState = 'verified' | 'claimed_only' | 'not_published' | 'n/a';

export interface DisclosureRow {
  provider: ProviderData;
  filings: DisclosureState;
  registrations: DisclosureState;
  overage: DisclosureState;
  implementation: DisclosureState;
  /** Verified cells. */
  score: number;
  /** Cells that apply to this vendor at all. */
  applicable: number;
}

export const DISCLOSURE_LABEL: Record<DisclosureState, string> = {
  verified: 'Published',
  claimed_only: 'Claimed, no figure',
  not_published: 'Not published',
  'n/a': 'Not charged',
};

function resolve(claims: boolean, exists: boolean, hasNumber: boolean): DisclosureState {
  if (!exists) return 'n/a';
  if (hasNumber) return 'verified';
  return claims ? 'claimed_only' : 'not_published';
}

export function disclosureMatrix(providers: ProviderData[]): DisclosureRow[] {
  return providers
    .map((p) => {
      const t = p.transparency;

      const filingExists = p.filings.has_per_filing_fee === true;
      const filingNumber =
        typeof p.filings.base_cost?.amount === 'number' || (p.filings.tier_pricing ?? []).length > 0;
      const filings = resolve(t.publishes_filing_fees === true, filingExists, filingNumber && t.publishes_filing_fees === true);

      const regExists = p.registrations.has_per_registration_fee === true;
      const regNumber = typeof p.registrations.base_cost?.amount === 'number';
      const registrations = resolve(
        t.publishes_registration_fees === true,
        regExists,
        regNumber && t.publishes_registration_fees === true,
      );

      const overageModels = p.plans.filter((pl) => pl.overage && pl.overage.model !== 'none');
      const overageNumber = overageModels.some(
        (pl) => typeof pl.overage?.per_unit_cost === 'number' && (pl.overage!.per_unit_cost as number) > 0,
      );
      const overage = resolve(t.publishes_overage_rates === true, overageModels.length > 0, overageNumber);

      const impl = (p.add_ons as any)?.implementation_fee;
      const implExists = impl?.has_fee === true;
      const implNumber =
        typeof impl?.amount === 'number' && impl.amount > 0
          ? true
          : typeof impl?.range_min === 'number' && t.publishes_implementation_fees === true;
      // A vendor that states "no implementation fee" on its pricing page has
      // disclosed it, so that counts as verified rather than not-applicable.
      const implementation: DisclosureState = !impl
        ? 'not_published'
        : impl.has_fee === false
          ? t.publishes_implementation_fees === true
            ? 'verified'
            : 'not_published'
          : resolve(t.publishes_implementation_fees === true, implExists, implNumber);

      const cells: DisclosureState[] = [filings, registrations, overage, implementation];
      return {
        provider: p,
        filings,
        registrations,
        overage,
        implementation,
        score: cells.filter((c) => c === 'verified').length,
        applicable: cells.filter((c) => c !== 'n/a').length,
      };
    })
    .sort(
      (a, b) =>
        b.score / Math.max(1, b.applicable) - a.score / Math.max(1, a.applicable) ||
        b.score - a.score ||
        a.provider.provider.name.localeCompare(b.provider.provider.name),
    );
}

export const DISCLOSURE_COLUMNS = [
  { key: 'filings', label: 'Filing fee' },
  { key: 'registrations', label: 'Registration fee' },
  { key: 'overage', label: 'Overage rate' },
  { key: 'implementation', label: 'Implementation fee' },
] as const;

// -----------------------------------------------------------------------------
// Fee categories across the whole set
// -----------------------------------------------------------------------------
export type FeeStatus =
  | { kind: 'published'; value: string }
  | { kind: 'charged_unpublished'; value: string }
  | { kind: 'none'; value: string }
  | { kind: 'unknown'; value: string };

export interface FeeCategory {
  key: string;
  label: string;
  /** Why a buyer should care, in one sentence. */
  why: string;
  cells: Array<{ slug: string; provider: string; status: FeeStatus; source?: string; note?: string }>;
}

function pub(value: string): FeeStatus { return { kind: 'published', value }; }
function hidden(value: string): FeeStatus { return { kind: 'charged_unpublished', value }; }
function none(value = 'None'): FeeStatus { return { kind: 'none', value }; }
function unknown(value = 'Not recorded'): FeeStatus { return { kind: 'unknown', value }; }

export function feeCategories(providers: ProviderData[]): FeeCategory[] {
  const cats: FeeCategory[] = [];

  // Per-filing
  cats.push({
    key: 'per-filing',
    label: 'Per-state filing fee',
    why: 'The charge that turns a cheap subscription into an expensive year. Twenty states filing monthly is 240 returns.',
    cells: providers.map((p) => {
      const amt = p.filings.base_cost?.amount;
      const tiers = p.filings.tier_pricing ?? [];
      if (!p.filings.has_per_filing_fee) {
        return { slug: p.provider.slug, provider: p.provider.name, status: none('Included in the rate'), note: p.filings.notes };
      }
      if (tiers.length > 0) {
        // Sort by effective rate, not by tier index: the ladder runs from the
        // smallest tier (highest effective rate) to the largest, so reading it
        // in index order renders the range backwards.
        const rates = tiers.map((t) => Math.round(t.annual_price / t.filings)).sort((a, b) => a - b);
        const lo = tiers[0];
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: pub(
            `${money(rates[0])}–${money(rates[rates.length - 1])} effective, sold as an annual filing tier`,
          ),
          source: lo.source,
          note: `Pay-as-you-go without a filing subscription is ${amt != null ? money(amt) : 'not published'} per filing.`,
        };
      }
      const publishes = p.transparency.publishes_filing_fees === true;
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        // A figure the vendor does not publish is not a published fee, even
        // when this site has a third-party number for it. Marking an
        // aggregator figure "Published" would overstate a competitor's
        // disclosure and its cost in the same cell.
        status:
          amt != null && publishes
            ? pub(`${money(amt)} per filing`)
            : amt != null
              ? hidden(`${money(amt)} per filing reported by third parties, nothing published by the vendor`)
              : hidden('Charged, amount not published'),
        source: p.filings.base_cost?.source,
        note: !publishes && amt != null
          ? 'The vendor does not publish a per-filing rate. Where its published plans bundle returns, this figure does not apply to them.'
          : undefined,
      };
    }),
  });

  // State upcharges — the genuinely under-reported one
  cats.push({
    key: 'state-upcharges',
    label: 'Per-state upcharges',
    why: 'Some states cost the vendor more to file, and some vendors pass that through. Colorado home-rule cities and Louisiana parishes are the usual culprits.',
    cells: providers.map((p) => {
      const ups = p.filings.state_upcharges ?? [];
      if (ups.length === 0) {
        return { slug: p.provider.slug, provider: p.provider.name, status: unknown('None recorded') };
      }
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: pub(ups.map((u) => `${u.state} +${money(u.additional_cost)}`).join(', ')),
        source: ups[0]?.source,
        note: ups.map((u) => `${u.state}: ${u.reason}`).join('. '),
      };
    }),
  });

  // Registrations
  cats.push({
    key: 'registrations',
    label: 'Per-state registration fee',
    why: 'A one-time cost per state, paid at onboarding when you are least able to compare. Ten new states can cost more than a year of subscription.',
    cells: providers.map((p) => {
      const amt = p.registrations.base_cost?.amount;
      if (!p.registrations.has_per_registration_fee) {
        return { slug: p.provider.slug, provider: p.provider.name, status: none('Not separately priced'), note: p.registrations.notes };
      }
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: amt != null ? pub(`${money(amt)} per state`) : hidden('Charged, amount not published'),
        source: p.registrations.base_cost?.source,
        note: p.registrations.includes_state_fees === false ? 'State permit fees are passed through on top.' : undefined,
      };
    }),
  });

  // Overage
  cats.push({
    key: 'overage',
    label: 'Overage above the included volume',
    why: 'The rate that decides what a good quarter costs you. It is the least-published number in the category.',
    cells: providers.map((p) => {
      const models = p.plans
        .map((pl) => pl.overage)
        .filter((o): o is NonNullable<typeof o> => !!o && o.model !== 'none');
      const withUnit = models.find((o) => typeof o.per_unit_cost === 'number' && o.per_unit_cost! > 0);
      if (models.length === 0) {
        return { slug: p.provider.slug, provider: p.provider.name, status: none('No overage concept in the model') };
      }
      // "Published" requires a number. The transparency flag alone is a claim,
      // and printing the overage *model* name in the value column made three
      // vendors read as having published a rate they have not published.
      if (withUnit) {
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: pub(`${money(withUnit.per_unit_cost as number)} per unit over`),
          note: withUnit.description,
        };
      }
      const uniqueModels = [...new Set(models.map((o) => o.model.replace(/_/g, ' ')))];
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: hidden(`Applies (${uniqueModels.join(', ')}), rate not published`),
        note: models[0]?.description,
      };
    }),
  });

  // Transaction fees
  cats.push({
    key: 'transaction',
    label: 'Per-transaction or basis-point fee',
    why: 'A charge on volume rather than on work done. It grows with the business whether or not compliance got harder.',
    cells: providers.map((p) => {
      const tf = p.transaction_fees;
      if (!tf?.has_transaction_fee) {
        return { slug: p.provider.slug, provider: p.provider.name, status: none() };
      }
      if (tf.rate == null) {
        return { slug: p.provider.slug, provider: p.provider.name, status: hidden('Applies, rate not published'), note: tf.notes };
      }
      const unit = tf.rate_unit === 'bps' ? ' bps' : tf.rate_unit === 'percent' ? '%' : ' per transaction';
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: pub(`${tf.rate}${unit} ${tf.applies_to === 'taxable_only' ? 'on taxable transactions' : 'on all transactions'}`),
        note: tf.notes,
      };
    }),
  });

  // Implementation
  cats.push({
    key: 'implementation',
    label: 'Implementation and onboarding',
    why: 'A one-time number that is easy to leave out of a comparison and hard to find out before a contract.',
    cells: providers.map((p) => {
      const impl = (p.add_ons as any)?.implementation_fee;
      if (!impl) return { slug: p.provider.slug, provider: p.provider.name, status: unknown() };
      if (impl.has_fee === false) {
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: none(p.transparency.publishes_implementation_fees ? 'None, stated on the pricing page' : 'None on record'),
          source: impl.source,
        };
      }
      if (typeof impl.amount === 'number' && impl.amount > 0) {
        return { slug: p.provider.slug, provider: p.provider.name, status: pub(`${money(impl.amount)} one-time`), source: impl.source };
      }
      if (typeof impl.range_min === 'number' && typeof impl.range_max === 'number') {
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: hidden(`${money(impl.range_min)}–${money(impl.range_max)} reported by buyers, nothing published`),
          source: impl.source,
        };
      }
      return { slug: p.provider.slug, provider: p.provider.name, status: hidden('Charged, amount not published'), source: impl.source };
    }),
  });

  // Payment method surcharge
  cats.push({
    key: 'payment-surcharge',
    label: 'Credit card surcharge',
    why: 'A percentage added for paying by card rather than ACH. Rare in this category, and easy to miss until the first invoice.',
    cells: providers.map((p) => {
      const pct = (p.add_ons as any)?.payment_method_fees?.credit_card_surcharge_pct;
      if (typeof pct === 'number' && pct > 0) {
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: pub(`${pct}% on card payments`),
          source: (p.add_ons as any)?.payment_method_fees?.source,
          note: 'Paying by ACH avoids it.',
        };
      }
      return { slug: p.provider.slug, provider: p.provider.name, status: unknown('None disclosed') };
    }),
  });

  // Contract lock-in
  cats.push({
    key: 'lock-in',
    label: 'Contract term and exit',
    why: 'Not a fee until you want to leave. Then it is the only one that matters.',
    cells: providers.map((p) => {
      const c = (p.commitments as any) ?? {};
      const terms: string[] = c.contract_length_options ?? [];
      const label = terms.length ? terms.map((t) => t.replace(/_/g, '-')).join(' or ') : 'Not published';
      const multiYear = (p.discounts as any)?.multi_year_discount_available === true;
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: terms.length ? pub(label + (multiYear ? ', multi-year discounted' : '')) : unknown('Not published'),
        note: c.cancellation_terms,
        source: c.source,
      };
    }),
  });

  // Optional extras recorded in add_ons.other_fees. Reading only
  // implementation_fee let a vendor record "guided onboarding available for an
  // additional fee" with no amount and still score clean on this page. The
  // publisher is one of the vendors that does exactly that.
  cats.push({
    key: 'optional-extras',
    label: 'Optional extras with no published price',
    why: 'Named services and gated features a vendor offers without saying what they cost. Individually small, collectively the difference between a quoted price and an invoice.',
    cells: providers.map((p) => {
      const others = (((p.add_ons as any)?.other_fees ?? []) as any[]).filter((f) => f?.name);
      if (others.length === 0) {
        return { slug: p.provider.slug, provider: p.provider.name, status: none('None recorded') };
      }
      const priced = others.filter((f) => typeof f.cost === 'number' && f.cost > 0);
      const unpriced = others.filter((f) => typeof f.cost !== 'number' || f.cost === 0);
      if (unpriced.length === 0) {
        return {
          slug: p.provider.slug,
          provider: p.provider.name,
          status: pub(priced.map((f) => `${f.name} ${money(f.cost)}`).join('; ')),
          source: priced[0]?.source,
        };
      }
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: hidden(
          `${unpriced.length} unpriced: ${unpriced.map((f) => f.name).join('; ')}` +
            (priced.length ? `. Priced: ${priced.map((f) => `${f.name} ${money(f.cost)}`).join('; ')}` : ''),
        ),
        note: unpriced.map((f) => f.description).filter(Boolean).join(' '),
        source: unpriced[0]?.source,
      };
    }),
  });

  // Unpriced services that exist
  cats.push({
    key: 'backfile-vda',
    label: 'Back-filing and voluntary disclosure',
    why: 'Cleaning up prior exposure. Almost always sold as a service on top, and almost never priced in public.',
    cells: providers.map((p) => {
      const a = (p.add_ons as any) ?? {};
      const vda = a.vda_pricing;
      const back = a.backfile_pricing;
      const offered: string[] = [];
      if (vda?.has_service) offered.push('VDA');
      if (back?.has_service) offered.push('back-filing');
      if (offered.length === 0) return { slug: p.provider.slug, provider: p.provider.name, status: none('Not offered') };
      const priced = typeof back?.base_cost === 'number' ? `${money(back.base_cost)} per return reported by a buyer` : null;
      return {
        slug: p.provider.slug,
        provider: p.provider.name,
        status: priced ? hidden(`${offered.join(' and ')}; ${priced}, nothing published`) : hidden(`${offered.join(' and ')} offered, no published price`),
        source: vda?.source ?? back?.source,
      };
    }),
  });

  return cats;
}

/** Count of categories where a provider charges something it does not price. */
export function unpublishedChargeCount(cats: FeeCategory[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cats) {
    for (const cell of c.cells) {
      if (cell.status.kind === 'charged_unpublished') {
        out.set(cell.provider, (out.get(cell.provider) ?? 0) + 1);
      }
    }
  }
  return out;
}

/** The liftable answer for the page. */
export function hiddenFeesAnswerSentence(providers: ProviderData[], cats: FeeCategory[]): string {
  const counts = unpublishedChargeCount(cats);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // Include everyone tied at the cut, so the sentence can't name two of three
  // vendors on the same score and imply the third is cleaner.
  const cut = ranked[2]?.[1] ?? ranked[ranked.length - 1]?.[1] ?? 0;
  const top = ranked.filter(([, n]) => n >= cut);
  const clean = providers.filter((p) => !counts.has(p.provider.name)).map((p) => p.provider.name);
  const topPhrase = top.length
    ? `the platforms with the most charges that exist without a published number are ` +
      `${top.map(([name, n]) => `${name} (${n} of ${cats.length})`).join(', ')}.`
    : `No tracked platform charges a fee it does not publish.`;
  const cleanPhrase = clean.length
    ? ` ${clean.length === 1 ? `${clean[0]} has none.` : `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]} have none.`}`
    : '';
  return (
    `The costs that do not appear on a sales tax software pricing page are per-state filing fees, ` +
    `per-state registration fees, overage rates above the included volume, per-state upcharges for ` +
    `home-rule and parish jurisdictions, implementation and onboarding, back-filing and voluntary ` +
    `disclosure work, credit card surcharges, and contract term and early-termination language. ` +
    `Across the ${providers.length} platforms tracked here, checked against ${cats.length} fee ` +
    `categories, ${topPhrase}${cleanPhrase} ` +
    `Publishing a fee is not the same as charging less. Disclosure score and cost rank are different ` +
    `orderings, and this page reports only the first.`
  );
}

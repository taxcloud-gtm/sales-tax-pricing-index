/**
 * cheapest.ts — derivations behind /cheapest-sales-tax-software.
 *
 * This is the page on the site with the worst conflict of interest, because
 * TaxCloud publishes the site and the calculator ranks TaxCloud cheapest on
 * both canonical profiles. Three design decisions handle that, and all three
 * are structural rather than editorial:
 *
 *   1. The ranking is computed, never authored. Nothing here can put a
 *      provider anywhere the same calculator wouldn't put it on the
 *      calculator page.
 *   2. The page runs the whole HEAD_TERM_PROFILES set, not one profile, and
 *      publishes the winner of each including the profiles where TaxCloud does
 *      not win. `variantRankings()` exists specifically so the losses are as
 *      prominent as the wins. Never hardcode the profile count in copy; read
 *      `allRankings(...).length`, because the set changes.
 *   3. Capability gates are reported before price. A provider that cannot do
 *      the job at any price is not a cheap option, and `capabilityGates()`
 *      derives that from the data rather than from a sales argument.
 */
import type { ProviderData } from '../../../calculator/src/data/types';
import type { ProviderEstimate } from '../../../calculator/src/types';
import { calculate } from '../calc-client';
import { estimateFloor, money, renderEstimate, terminate } from '../format';
import { CANONICAL_PROFILES, HEAD_TERM_PROFILES, VARIANT_PROFILES, type HeadTermProfile } from './profiles';

export interface Ranking {
  profile: HeadTermProfile;
  results: ProviderEstimate[];
  winner: ProviderEstimate;
  runnerUp: ProviderEstimate | null;
  /** Gap between winner and runner-up, by floor. */
  gap: number;
  /** True when the winner's floor comes from a quote-only range rather than a published price. */
  winnerIsEstimated: boolean;
  /**
   * Providers removed from this ranking because they cannot serve the profile's
   * requirement at any price, with the reason. Always rendered next to the
   * ranking: a cheap platform that cannot do the job is not an answer, and
   * leaving it in the list to win on price would be the single most misleading
   * thing this page could do.
   */
  excluded: Array<{ name: string; reason: string }>;
}

/**
 * Providers that cannot serve a profile's hard requirement, so must not appear
 * in its ranking. Only hard, data-backed capability gaps qualify: a feature the
 * provider does not have at any tier or any price. Anything softer (depth of a
 * feature, quality of support) is a judgement call and is left out.
 */
function ineligibleFor(
  profile: HeadTermProfile,
  providers: Map<string, ProviderData>,
): Array<{ slug: string; name: string; reason: string }> {
  const out: Array<{ slug: string; name: string; reason: string }> = [];
  if (profile.inputs.requiresInternationalVatGst) {
    for (const [slug, p] of providers) {
      if (!p.international?.supports_vat && !p.international?.supports_gst) {
        out.push({
          slug,
          name: p.provider.name,
          // A noun phrase, not a clause. Callers interpolate this after a
          // colon or "because of", and a clause with a pronoun in it breaks
          // agreement as soon as two providers are excluded at once. Do not
          // lowercase it either: it contains acronyms.
          reason: 'US sales tax only, with no VAT or GST coverage at any tier',
        });
      }
    }
  }
  return out;
}

function rank(profile: HeadTermProfile, providers: Map<string, ProviderData>): Ranking | null {
  let results: ProviderEstimate[];
  try {
    results = calculate(profile.inputs, providers);
  } catch {
    return null;
  }
  const ineligible = ineligibleFor(profile, providers);
  const blocked = new Set(ineligible.map((x) => x.slug));
  const sorted = [...results]
    .filter((r) => !blocked.has(r.slug))
    .sort((a, b) => estimateFloor(a.estimate) - estimateFloor(b.estimate));
  if (sorted.length === 0) return null;
  const winner = sorted[0];
  const runnerUp = sorted[1] ?? null;
  return {
    profile,
    results: sorted,
    winner,
    runnerUp,
    gap: runnerUp ? estimateFloor(runnerUp.estimate) - estimateFloor(winner.estimate) : 0,
    winnerIsEstimated: winner.estimate.type === 'range' || winner.estimate.type === 'quote_required',
    excluded: ineligible.map(({ name, reason }) => ({ name, reason })),
  };
}

export function allRankings(providers: Map<string, ProviderData>): Ranking[] {
  return HEAD_TERM_PROFILES.map((p) => rank(p, providers)).filter((r): r is Ranking => r !== null);
}

export function canonicalRankings(providers: Map<string, ProviderData>): Ranking[] {
  return CANONICAL_PROFILES.map((p) => rank(p, providers)).filter((r): r is Ranking => r !== null);
}

export function variantRankings(providers: Map<string, ProviderData>): Ranking[] {
  return VARIANT_PROFILES.map((p) => rank(p, providers)).filter((r): r is Ranking => r !== null);
}

/** Distinct winners across every profile. If this is length 1, say so plainly. */
export function distinctWinners(rankings: Ranking[]): string[] {
  return [...new Set(rankings.map((r) => r.winner.provider))];
}

/**
 * The liftable answer. Deliberately leads with the qualifier rather than the
 * name, because "cheapest by published pricing on a stated profile" is the
 * only claim the data supports.
 */
export function cheapestAnswerSentence(rankings: Ranking[]): string {
  if (rankings.length === 0) return '';
  const canonical = rankings.filter((r) => r.profile.canonical);
  const others = rankings.filter((r) => !r.profile.canonical);
  const winners = distinctWinners(rankings);
  const lead = canonical
    .map(
      (r) =>
        `${r.winner.provider} at ${renderEstimate(r.winner.estimate).replace(/^From /, 'from ')} per year for ${r.profile.inputSummary}`,
    )
    .join(', and ');
  const anyExcluded = others.some((r) => r.excluded.length > 0);
  return (
    `Measured on published pricing, the cheapest sales tax compliance platform is ${lead}. ` +
    `That answer is profile-dependent: across the ${rankings.length} buyer profiles modeled on this page, ` +
    `${winners.length === 1
      ? 'one platform comes out cheapest on every one, which is a reason to read the assumptions rather than the ranking'
      : `${winners.length} different platforms come out cheapest depending on the profile (${winners.join(', ')})`}. ` +
    `${anyExcluded ? 'On profiles with a hard requirement, platforms that cannot meet it are removed from the ranking rather than allowed to win on price. ' : ''}` +
    `Cheapest by list price is also not the same as cheapest available: the vendors that publish least ` +
    `are the ones that negotiate most, and this site can only compare what is published.`
  );
}

// -----------------------------------------------------------------------------
// Capability gates — where price is the wrong question
// -----------------------------------------------------------------------------
export interface CapabilityGate {
  requirement: string;
  question: string;
  /** Providers that cannot serve it at all. */
  cannot: string[];
  /** Providers that serve it only on a higher or quote-only tier. */
  gated: string[];
  /** Providers that serve it on their entry paid tier. */
  included: string[];
  note: string;
}

/**
 * The plan a buyer would land on if they wanted the cheapest paid option. May
 * be quote-only: Zamp's cheapest non-free plan has no published price, so
 * anything describing it as an "entry price" has to say so.
 */
function cheapestNonFreePlan(p: ProviderData) {
  return p.plans
    .filter((pl) => !pl.is_free)
    .sort(
      (a, b) =>
        (a.monthly_price.amount ?? Number.POSITIVE_INFINITY) -
        (b.monthly_price.amount ?? Number.POSITIVE_INFINITY),
    )[0];
}

export function capabilityGates(providers: ProviderData[]): CapabilityGate[] {
  const gates: CapabilityGate[] = [];

  // 1. International VAT / GST.
  //
  // Computed per plan, not per provider. The provider-level `international`
  // block says whether the vendor sells VAT/GST coverage at all; the plan
  // feature flag says whether the plan a buyer would actually land on includes
  // it. An earlier version read only the provider block and printed four
  // vendors under "on the entry paid plan" whose entry plans do not have it.
  const intlNone: string[] = [];
  const intlGated: string[] = [];
  const intlEntry: string[] = [];
  for (const p of providers) {
    const sellsIt = p.international?.supports_vat || p.international?.supports_gst;
    // Formatted as "Name: plan, N+ countries" and joined with semicolons at the
    // render site. Parenthesising both the country count and the plan name
    // produced nested brackets, and plan names in this set contain brackets of
    // their own.
    const countries = p.international?.countries_covered
      ? `, ${p.international.countries_covered}+ countries`
      : '';
    if (!sellsIt) { intlNone.push(p.provider.name); continue; }
    const plansWithIt = p.plans.filter((pl) => pl.features.international_vat_gst);
    const entryPaid = cheapestNonFreePlan(p);
    if (entryPaid && entryPaid.features.international_vat_gst) {
      intlEntry.push(`${p.provider.name}: ${entryPaid.name}${countries}`);
    } else if (plansWithIt.length > 0) {
      intlGated.push(`${p.provider.name}: ${plansWithIt.map((pl) => pl.name).join(' or ')} only${countries}`);
    } else {
      // Sells it as a product but no plan in the data carries the feature.
      intlGated.push(`${p.provider.name}: not attached to any published plan${countries}`);
    }
  }
  gates.push({
    requirement: 'VAT or GST outside the US',
    question: 'Do you sell outside the United States?',
    cannot: intlNone,
    gated: intlGated,
    included: intlEntry,
    note:
      `This is a capability, not a price. ${intlNone.length} of the ${providers.length} tracked platforms are US-only by design, which means their position in a cost ranking is irrelevant to a business that needs VAT or GST coverage. Of the rest, most attach it to a higher or quote-only tier rather than the entry plan, so the relevant question is not whether the vendor offers it but what plan it puts you on. Coverage here means the vendor offers it at all; depth by country is not something this site measures.`,
  });

  // 2. Exemption certificate management — from plan features, so tier-aware.
  const certNone: string[] = [];
  const certGated: string[] = [];
  const certEntry: string[] = [];
  for (const p of providers) {
    const withCerts = p.plans.filter((pl) => pl.features.exemption_certificate_mgmt);
    if (withCerts.length === 0) { certNone.push(p.provider.name); continue; }
    const entryPaid = cheapestNonFreePlan(p);
    if (entryPaid && entryPaid.features.exemption_certificate_mgmt) certEntry.push(`${p.provider.name}: ${entryPaid.name}`);
    else certGated.push(`${p.provider.name}: ${withCerts.map((pl) => pl.name).join(' or ')} only`);
  }
  // Where a vendor publishes a certificate allowance or fee outside the plan
  // feature matrix, the two disagree. Say so rather than letting the feature
  // matrix stand alone.
  const certFeeNotes = providers
    .flatMap((p) =>
      (((p.add_ons as any)?.other_fees ?? []) as any[])
        .filter((f) => /certificat/i.test(`${f?.name ?? ''} ${f?.description ?? ''}`))
        .map((f) => `${p.provider.name}: ${terminate(f.description ?? f.name)}`),
    );
  gates.push({
    requirement: 'Exemption certificate management',
    question: 'Do you sell wholesale, or to resellers and exempt institutions?',
    cannot: certNone,
    gated: certGated,
    included: certEntry,
    note:
      'Recorded here as whether the plan lists the feature, which is not the same as depth. Full certificate lifecycle management, meaning solicitation, validation, expiry tracking and audit-ready storage at volume, is a different product from a place to upload a PDF, and no provider in this set publishes enough detail to rank that. If certificates are central to your business, treat this row as a shortlist filter and not an answer.' +
      (certFeeNotes.length
        ? ` The plan feature matrix is also not the whole story where a vendor prices certificates separately. ${certFeeNotes.join(' ')}`
        : ''),
  });

  // 3. ERP integration.
  //
  // This one is deliberately NOT presented as a capability gate across the set.
  // An earlier version listed Avalara as the only ERP option, which was wrong
  // twice over: the provider data records NetSuite support at other vendors,
  // and the ERP buyer profile on this same page prices seven of the eight. The
  // real, narrow, sourced finding is about one vendor's published pricing
  // disappearing on an ERP input, so it is stated as that and nothing more.
  const erpQuoteOnly = providers
    .filter((p) => /Custom-plan-only|ERP/.test(p.transparency.rationale ?? ''))
    .map((p) => p.provider.name);
  if (erpQuoteOnly.length > 0) {
    gates.push({
      requirement: 'A published price on an ERP stack',
      question: 'Does your tax data live in an ERP (NetSuite, SAP, Oracle, Dynamics) rather than a storefront or billing system?',
      cannot: [],
      gated: erpQuoteOnly.map((n) => `${n}: published per-state plans cover a fixed list of non-ERP integrations, so every ERP routes to a quote`),
      included: [],
      note:
        'Several platforms here serve ERP stacks, so this is not a question of who can do the work. It is a question of who will still show you a price once you tell them what you run. The ERP row in the profile table above shows the effect: compare it to the mid-market row.',
    });
  }

  return gates;
}

// -----------------------------------------------------------------------------
// The "cheapest is not the whole question" framing
// -----------------------------------------------------------------------------
export interface ScopeDifference {
  provider: string;
  slug: string;
  /** What the price does not include, in the vendor's own structure. */
  buys: string;
}

/**
 * What each provider's number actually covers, so a reader comparing two rows
 * knows whether they are comparing the same thing. Derived from plan features
 * and the filings/registrations blocks rather than authored per provider.
 */
export function scopeDifferences(providers: ProviderData[]): ScopeDifference[] {
  return providers.map((p) => {
    const bits: string[] = [];
    const entry = cheapestNonFreePlan(p);
    if (entry?.is_quote_only) bits.push(`cheapest paid plan (${entry.name}) is quote-only`);
    if (p.filings.has_per_filing_fee) bits.push('filings billed separately');
    else bits.push('filings in the rate');
    if (p.registrations.has_per_registration_fee) {
      const amt = p.registrations.base_cost?.amount;
      bits.push(amt != null ? `registrations ${money(amt)} each` : 'registrations billed separately');
    } else bits.push('registrations not separately priced');
    if (entry?.features.audit_support) bits.push('audit support on this plan');
    if (entry?.features.dedicated_csm) bits.push('named CSM');
    if (entry?.features.phone_support) bits.push('phone support');
    if (p.sst?.is_csp) bits.push('SST Certified Service Provider');
    // Plan-level, not provider-level: several vendors sell VAT/GST coverage but
    // not on the plan a buyer at this profile would land on, and saying
    // otherwise on a row-by-row scope table would be wrong in the buyer's face.
    if (entry?.features.international_vat_gst) bits.push('international VAT/GST on this plan');
    else if (p.international?.supports_vat || p.international?.supports_gst)
      bits.push('international VAT/GST only on a higher tier');
    return { provider: p.provider.name, slug: p.provider.slug, buys: bits.join(' · ') };
  });
}

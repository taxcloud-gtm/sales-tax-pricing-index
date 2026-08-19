/**
 * profiles.ts — the buyer profiles the head-term pages run the calculator
 * against.
 *
 * Why this file exists separately from lib/scenarios.ts:
 *   SCENARIOS holds the two canonical profiles the whole site publishes (SMB
 *   and Mid-Market, both Shopify ecommerce). Those two are the site's public
 *   commitment and must not change casually, because every provider page,
 *   comparison page and the homepage table quote them.
 *
 *   The head-term pages need more than two, for one specific reason: with only
 *   Shopify ecommerce profiles in the set, the answer to "which is cheapest"
 *   never changes, and a page that only ever produces one winner is not
 *   answering the question — it's asserting a conclusion. The variants below
 *   are the shapes where the answer genuinely moves: no SST eligibility, an
 *   ERP stack, a wide state footprint, a quarterly filer.
 *
 * Every variant is derived from the canonical Mid-Market inputs by patch, so
 * when the canonical profile changes the variants follow it.
 */
import type { UserInputs } from '../../../calculator/src/types';
import { SCENARIOS, buildScenarioInputs } from '../scenarios';

export interface HeadTermProfile {
  key: string;
  /** Short label for a table header or row. */
  name: string;
  /** The input line, so a lifted row carries its own assumptions. */
  inputSummary: string;
  /** Why this profile is in the set. Reads as editorial justification. */
  why: string;
  /** True for the two profiles the rest of the site publishes. */
  canonical: boolean;
  inputs: UserInputs;
}

function canonicalProfile(name: 'SMB' | 'Mid-Market'): HeadTermProfile {
  const s = SCENARIOS.find((x) => x.name === name) ?? SCENARIOS[0];
  return {
    key: name === 'SMB' ? 'smb' : 'mid-market',
    name: name === 'SMB' ? 'SMB ecommerce' : 'Mid-market ecommerce',
    inputSummary: s.description,
    why:
      name === 'SMB'
        ? 'The profile a business crossing thresholds in ten states actually has.'
        : 'The profile this site publishes everywhere else, so the number is comparable across every page.',
    canonical: true,
    inputs: buildScenarioInputs(s),
  };
}

const MID = canonicalProfile('Mid-Market');

function variant(
  key: string,
  name: string,
  inputSummary: string,
  why: string,
  patch: Partial<UserInputs>,
): HeadTermProfile {
  return { key, name, inputSummary, why, canonical: false, inputs: { ...MID.inputs, ...patch } };
}

/**
 * The full profile set, canonical first. Order is display order.
 */
export const HEAD_TERM_PROFILES: readonly HeadTermProfile[] = [
  canonicalProfile('SMB'),
  MID,
  variant(
    'physical-nexus',
    'Mid-market, physical presence everywhere',
    '250K orders · 200 filings · 20 states · 0 SST-eligible · Shopify',
    'Warehouses, offices or remote employees in every filing state. Nobody qualifies for state-funded CSP filing here, which takes the largest single line off the two certified providers\' advantage and is the fastest way to see how much of their position depends on it.',
    { sstEligibleStates: 0, statesPhysicalNexus: MID.inputs.statesFiling },
  ),
  variant(
    'erp',
    'Mid-market on NetSuite',
    '250K orders · 200 filings · 20 states · 10 SST · NetSuite',
    'An ERP rather than a storefront. Integration changes which plan a buyer lands on, and for one vendor it moves a published price to a quote.',
    // Only integrationType is patched, so order count and taxable-revenue share
    // stay at the Shopify-derived values. That is inert today because no
    // provider in the set is priced on transaction volume, and it would need
    // revisiting the moment one is.
    { integrationType: 'netsuite' },
  ),
  // A 45-state / 540-filing profile is deliberately NOT in this set yet.
  //
  // It should be: it is the shape where per-filing and per-state pricing
  // separate hardest. It is held back because running it surfaced a defect in
  // the shared TaxCloud calculator, not in this file. The SST free-filing
  // credit is computed as (eligible states x 12 x the $45 pay-as-you-go rate)
  // and then subtracted from a *tiered* annual filing price whose effective
  // rate is $20-$33 per filing. Crediting at the higher basis means the credit
  // grows faster than the cost it offsets, so at 22 eligible states the credit
  // very nearly cancels the entire filing subscription and TaxCloud comes out
  // cheaper at 45 states than at 20. That is not a real property of TaxCloud's
  // pricing, it is a mixed-basis arithmetic error, and it runs in the
  // publisher's favour.
  //
  // The defect affects every page on the site, not this profile, so fixing it
  // belongs in its own change with its own verification. Add this profile back
  // once the credit is computed on the same basis as the price it reduces.
  // A quarterly-filer profile is held back for the same reason as the 45-state
  // one, and it is a second, separate defect in the shared TaxCloud calculator.
  // SST_FILINGS_PER_STATE_PER_YEAR is the constant 12 regardless of
  // inputs.filingFrequency, so a quarterly filer with 10 eligible states is
  // credited 120 free filings against a total of 80 returns. The credit then
  // caps at the whole filing tier and TaxCloud's filing line goes to zero,
  // which is why it won that profile. The correct count is 10 x 4.
  //
  // Add this profile back once the credit is scaled by filing frequency.
  variant(
    'international',
    'Mid-market selling internationally',
    '250K orders · 200 filings · 20 states · 10 SST · Shopify · needs VAT/GST',
    'US sales tax plus VAT or GST. This is a capability question before it is a price question: a platform with no international coverage cannot serve it at any price, so it is removed from the ranking rather than left in to win on cost.',
    { requiresInternationalVatGst: true },
  ),
];

export function getProfile(key: string): HeadTermProfile | undefined {
  return HEAD_TERM_PROFILES.find((p) => p.key === key);
}

export const CANONICAL_PROFILES = HEAD_TERM_PROFILES.filter((p) => p.canonical);
export const VARIANT_PROFILES = HEAD_TERM_PROFILES.filter((p) => !p.canonical);

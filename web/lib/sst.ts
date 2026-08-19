/**
 * sst.ts — SST / CSP facts and the arithmetic behind "what is CSP status worth".
 *
 * Everything here is either (a) sourced to the Streamlined Sales Tax Governing
 * Board, or (b) computed by the same calculator the rest of the site uses, so
 * the savings figure is reproducible rather than asserted.
 *
 * Editorial note: this site is operated by TaxCloud, which is one of the five
 * CSPs. That makes this the page where neutrality matters most. Every claim
 * below is attributed, the full CSP list is published (not just the two we
 * track), and the eligibility limits are stated as prominently as the benefit.
 */
import type { ProviderData } from '../../calculator/src/data/types';
import type { UserInputs } from '../../calculator/src/types';
import { calculate } from './calc-client';
import { SCENARIOS, buildScenarioInputs } from './scenarios';
import { estimateFloor } from './format';

export const SST_SOURCE_CSP_LIST =
  'https://www.streamlinedsalestax.org/certified-service-providers/certified-service-providers-list';
export const SST_SOURCE_WHAT_IS_CSP =
  'https://www.streamlinedsalestax.org/certified-service-providers/what-is-a-csp';
export const SST_SOURCE_FAQ =
  'https://www.streamlinedsalestax.org/Shared-Pages/faqs/faqs---about-streamlined';

/** Verified against the Governing Board's CSP list, 2026-08-18. */
export const CSPS_OFFERING_FREE_SERVICE = [
  'Avalara',
  'TaxCloud',
  'Sovos',
  'AccurateTax',
  'Avior',
] as const;

/** Certified, but the Board records it as not currently offering free services. */
export const CSPS_NOT_OFFERING_FREE_SERVICE = ['Exactor'] as const;

/** 23 full members plus Tennessee, the only associate member. Verified 2026-08-18. */
export const SST_FULL_MEMBER_STATES = [
  'Arkansas', 'Georgia', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Michigan',
  'Minnesota', 'Nebraska', 'Nevada', 'New Jersey', 'North Carolina',
  'North Dakota', 'Ohio', 'Oklahoma', 'Rhode Island', 'South Dakota', 'Utah',
  'Vermont', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
] as const;
export const SST_ASSOCIATE_MEMBER_STATES = ['Tennessee'] as const;
export const SST_MEMBER_STATE_COUNT =
  SST_FULL_MEMBER_STATES.length + SST_ASSOCIATE_MEMBER_STATES.length;

export interface SstSavings {
  provider: string;
  slug: string;
  withCredit: number;
  withoutCredit: number;
  savings: number;
  sstStates: number;
  scenarioDescription: string;
}

/**
 * What the CSP credit is worth, computed rather than claimed: run the
 * mid-market profile twice against the same provider, once with its SST states
 * declared and once with none, and diff the result.
 */
export function sstSavingsFor(
  slug: string,
  providers: Map<string, ProviderData>,
): SstSavings | null {
  const scenario = SCENARIOS.find((s) => s.name === 'Mid-Market') ?? SCENARIOS[SCENARIOS.length - 1];
  if (!scenario) return null;

  const withInputs = buildScenarioInputs(scenario);
  const withoutInputs: UserInputs = { ...withInputs, sstEligibleStates: 0 };

  try {
    const a = calculate(withInputs, providers).find((r) => r.slug === slug);
    const b = calculate(withoutInputs, providers).find((r) => r.slug === slug);
    if (!a || !b) return null;
    const withCredit = estimateFloor(a.estimate);
    const withoutCredit = estimateFloor(b.estimate);
    if (!Number.isFinite(withCredit) || !Number.isFinite(withoutCredit)) return null;
    return {
      provider: a.provider,
      slug,
      withCredit,
      withoutCredit,
      savings: withoutCredit - withCredit,
      sstStates: withInputs.sstEligibleStates ?? 0,
      scenarioDescription: scenario.description,
    };
  } catch {
    return null;
  }
}

/** The tracked providers that are CSPs, and those that are not. */
export function splitByCspStatus(providers: ProviderData[]) {
  return {
    csps: providers.filter((p) => p.sst?.is_csp),
    nonCsps: providers.filter((p) => !p.sst?.is_csp),
  };
}

import type { ProviderData } from '../../../calculator/src/data/types';
import { howMuchDoesXCost } from '../summary';
import { money, renderEstimate } from '../format';
import { SCENARIOS, buildScenarioInputs } from '../scenarios';
import { calculate } from '../calc-client';
import { getProvidersMap } from '../data/providers';

export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * Generate 5+ FAQ entries per provider, fully derived from YAML. Used both
 * for the on-page <FaqSection/> AND for the FAQPage JSON-LD, same source of
 * truth, so a Rich Results audit on the JSON-LD matches what readers see.
 */
export function faqEntries(p: ProviderData): FaqEntry[] {
  const name = p.provider.name;
  const out: FaqEntry[] = [];

  // 1. How much does X cost, answered with the summary prose
  out.push({ q: `How much does ${name} cost?`, a: howMuchDoesXCost(p) });

  // 2. Cheapest plan
  const cheapest = cheapestPaid(p);
  if (cheapest) {
    out.push({
      q: `What is the cheapest ${name} plan?`,
      a: cheapest.amount != null
        ? cheapest.amount === 0
          ? `${cheapest.name} has no monthly subscription fee. You pay per event instead.${cheapest.tagline ? ' ' + cheapest.tagline + '.' : ''}`
          : `${cheapest.name} at ${money(cheapest.amount)}/month.${cheapest.tagline ? ' ' + cheapest.tagline + '.' : ''}`
        : `The cheapest published plan is ${cheapest.name}. You'll need a quote for the actual price.`,
    });
  }

  // 3. Per-filing fees
  if (p.filings?.has_per_filing_fee) {
    const cost = p.filings.base_cost?.amount;
    out.push({
      q: `Does ${name} charge per filing?`,
      a: cost != null
        ? `Yes. ${money(cost)} per state filing, on top of subscription.${p.filings.notes ? ' ' + truncate(p.filings.notes, 200) : ''}`
        : `Yes. ${name} charges a per-filing fee on top of subscription, but doesn't publish the amount.`,
    });
  } else {
    out.push({
      q: `Does ${name} charge per filing?`,
      a: `No. Filings are included in ${name}'s subscription. Cost scales with ${describeScalesWith(p) || 'volume'} instead.`,
    });
  }

  // 4. SST certification
  if (p.sst) {
    out.push({
      q: `Is ${name} SST certified?`,
      a: p.sst.is_csp
        ? `Yes. ${name} is a Certified Service Provider in the Streamlined Sales Tax (SST) Program${p.sst.sst_member_states_covered_free ? `. That means free filings in all ${p.sst.sst_member_states_covered_free} SST member states for customers who qualify (no physical nexus in those states, enrolled in SST)` : ''}.`
        : `No. ${name} isn't an SST Certified Service Provider, so you won't get free filings in SST member states with ${name}.`,
    });
  }

  // 5. Free trial / free plan
  const freePlan = p.plans.find((pl) => pl.is_free);
  const trial = (p.commitments as any)?.free_trial;
  if (freePlan) {
    out.push({
      q: `Does ${name} have a free plan?`,
      a: `Yes. ${name} has a ${freePlan.name} plan${freePlan.tagline ? `: ${freePlan.tagline.toLowerCase()}` : ''}.`,
    });
  } else if (trial?.has_trial) {
    out.push({
      q: `Does ${name} offer a free trial?`,
      a: `Yes. ${trial.length_days || ''}-day free trial${trial.plan_during_trial ? ` of the ${trial.plan_during_trial} plan` : ''}.`,
    });
  } else {
    out.push({
      q: `Does ${name} offer a free trial?`,
      a: `No published free trial. Reach out to ${name} directly if you want one.`,
    });
  }

  // 6. International support (always present; useful filter for buyers)
  const intl = p.international;
  if (intl) {
    if (intl.supports_vat || intl.supports_gst) {
      out.push({
        q: `Does ${name} support international VAT and GST?`,
        a: intl.countries_covered
          ? `Yes. ${name} covers ${intl.countries_covered}+ countries.${intl.pricing_model_international ? ' ' + truncate(intl.pricing_model_international, 200) : ''}`
          : `Yes. ${name} supports international VAT and GST alongside US sales tax.`,
      });
    } else {
      out.push({
        q: `Does ${name} support international VAT and GST?`,
        a: `No. ${name} is US sales tax only, with no VAT or GST coverage. If you sell internationally, you'll need a separate solution for those jurisdictions.`,
      });
    }
  }

  // 7 + 8. Scenario-based typical cost drives what LLMs cite when buyers
  // ask "how much for an SMB / mid-market ecommerce brand."
  const providersMap = getProvidersMap();
  for (const scenario of SCENARIOS) {
    const inputs = buildScenarioInputs(scenario);
    const results = calculate(inputs, providersMap);
    const result = results.find((r) => r.slug === p.provider.slug);
    if (!result) continue;
    const audienceLabel =
      scenario.name === 'SMB' ? 'a typical SMB' : 'a typical mid-market';
    const profile =
      `${scenario.annualOrders.toLocaleString()} orders/year, ${scenario.annualFilings} filings ` +
      `across ${scenario.statesFiling} states (${scenario.sstEligibleStates} of them SST member states), on Shopify`;
    out.push({
      q: `How much does ${name} cost for ${audienceLabel} ecommerce brand?`,
      a:
        `For ${audienceLabel} ecommerce profile (${profile}), ${name} costs approximately ` +
        `${renderEstimate(result.estimate)} per year on the ${result.recommendedPlan} plan. ` +
        `This is the calculator's estimate using ${name}'s published pricing` +
        `${result.estimate.type === 'range' ? ' and buyer-reported contract ranges' : ''}; ` +
        `actual cost will vary with your specific order volume, state footprint, and SST eligibility.`,
    });
  }

  return out;
}

/**
 * FAQPage JSON-LD blob for the provider page.
 */
export function faqJsonLd(p: ProviderData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries(p).map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.a,
      },
    })),
  };
}

function cheapestPaid(p: ProviderData) {
  const paid = p.plans.filter((pl) => !pl.is_free);
  if (paid.length === 0) return null;
  const sorted = [...paid].sort(
    (a, b) => (a.monthly_price.amount ?? Number.POSITIVE_INFINITY) - (b.monthly_price.amount ?? Number.POSITIVE_INFINITY),
  );
  return {
    name: sorted[0].name,
    amount: sorted[0].monthly_price.amount,
    tagline: sorted[0].tagline,
  };
}

function describeScalesWith(p: ProviderData): string {
  return (p.pricing_model?.scales_with ?? []).slice(0, 3).join(', ');
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

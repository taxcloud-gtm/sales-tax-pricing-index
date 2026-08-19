'use client';

import { useMemo, useState } from 'react';
import type { ProviderData } from '../../../calculator/src/data/types';
import type { UserInputs } from '../../../calculator/src/types';
import { calculate } from '@/lib/calc-client';
import { getAssumptions } from '@/lib/integration-assumptions';
import { LogSlider } from './inputs/log-slider';
import { NumberStepper } from './inputs/number-stepper';
import { IntegrationSelect } from './inputs/integration-select';
import { SstStateGrid } from './inputs/sst-state-grid';
import { ProviderCard } from './provider-card';

const REVENUE_STOPS = [0, 500_000, 1_000_000, 5_000_000, 25_000_000, 100_000_000, 500_000_000];
const ORDER_STOPS = [0, 1_000, 5_000, 25_000, 100_000, 250_000, 1_000_000, 5_000_000];

// Form-visible inputs. The other UserInputs fields are filled with sensible
// defaults below (annual billing, monthly cadence, no special requirements).
interface FormState {
  integrationType: UserInputs['integrationType'];
  annualFilings: number;
  annualOrders: number;
  annualRevenueUSD: number;
  statesFiling: number;
  registrationBacklog: number;
}

// Land in a zero state: every quantity starts empty so the buyer builds up
// their own scenario. integrationType has no "none" option and doesn't affect
// cost while volumes are zero, so it keeps a default selection.
const INITIAL_FORM: FormState = {
  integrationType: 'shopify',
  annualFilings: 0,
  annualOrders: 0,
  annualRevenueUSD: 0,
  statesFiling: 0,
  registrationBacklog: 0,
};

function formatShortMoney(v: number): string {
  if (v >= 1_000_000) return `$${v / 1_000_000}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatShortCount(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

/**
 * Build the full UserInputs object the calculator expects, filling in the
 * fields the form no longer asks about with sensible defaults derived from
 * the visible inputs and integration-specific assumptions.
 */
function buildUserInputs(form: FormState, sstCount: number): UserInputs {
  const { taxableShare } = getAssumptions(form.integrationType);

  // Order count comes directly from the buyer. Drives TaxJar's, TaxCloud's,
  // and Avalara's order-tier pickers — providers whose subscription plans
  // are priced by volume.
  const monthlyOrders = Math.round(form.annualOrders / 12);

  // Taxable transaction volume for bps pricers (Anrok). Applies the
  // integration's typical taxable share rather than treating 100% of revenue
  // as taxable — SaaS profiles drop to ~50%, ERP/B2B to ~50-60%, DTC ecom
  // stays around 85%.
  const monthlyTransactionVolumeUSD = Math.round((form.annualRevenueUSD * taxableShare) / 12);

  return {
    monthlyOrders,
    monthlyTransactionVolumeUSD,
    annualRevenueUSD: form.annualRevenueUSD,
    statesFiling: form.statesFiling,
    statesPhysicalNexus: 0,           // form no longer asks; SST grid handles physical-nexus disqualification
    filingFrequency: 'monthly',       // unused when annualFilings is provided
    registrationBacklog: form.registrationBacklog,
    integrationType: form.integrationType,
    requiresApiAccess: false,
    requiresExemptionCertificateMgmt: false,
    requiresInternationalVatGst: false,
    requiresVdaSupport: false,
    billingCadence: 'annual',
    annualFilings: form.annualFilings,
    sstEligibleStates: sstCount,
  };
}

export function CalculatorForm({ providersJson }: { providersJson: Record<string, ProviderData> }) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [sstStates, setSstStates] = useState<Set<string>>(() => new Set());

  const providersMap = useMemo(() => new Map(Object.entries(providersJson)), [providersJson]);
  const effectiveInputs = useMemo<UserInputs>(
    () => buildUserInputs(form, sstStates.size),
    [form, sstStates],
  );
  // Has the buyer actually described a business yet? With every quantity at
  // zero the math is real but meaningless: providers with no fixed platform fee
  // come out at $0/year and rank above providers that charge a subscription.
  //
  // That zero state used to be server-rendered, so crawlers were served
  // "#1 Numeral - $0 per year" directly contradicting the static all-provider
  // table 400px above it on the same page. A model reading a document that
  // disagrees with itself discounts the whole document. Gate the ranking on
  // real input; the static table above is the crawlable, correct artifact.
  const hasInput =
    form.annualOrders > 0 ||
    form.statesFiling > 0 ||
    form.annualRevenueUSD > 0 ||
    form.annualFilings > 0 ||
    form.registrationBacklog > 0;

  const results = useMemo(() => {
    if (!hasInput) return [];
    try {
      return calculate(effectiveInputs, providersMap);
    } catch (e) {
      console.error('calculator error', e);
      return [];
    }
  }, [hasInput, effectiveInputs, providersMap]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-10">
      {/* Form */}
      <aside className="lg:sticky lg:top-6 lg:self-start space-y-7 pb-8 lg:pb-0">
        <div>
          <h2 className="font-serif text-xl font-semibold mb-1">Your business</h2>
          <p className="text-xs text-ink-subtle">Results update as you change inputs.</p>
        </div>

        <IntegrationSelect
          label="Primary integration"
          value={form.integrationType}
          onChange={(v) => set('integrationType', v)}
        />

        <NumberStepper
          label="Number of annual filings"
          value={form.annualFilings}
          onChange={(v) => set('annualFilings', v)}
          min={0}
          max={1000}
          step={10}
          suffix="filings/year"
        />

        <LogSlider
          label="Annual orders / transactions"
          stops={ORDER_STOPS}
          value={form.annualOrders}
          onChange={(v) => set('annualOrders', v)}
          format={formatShortCount}
        />

        <LogSlider
          label="Estimated annual revenue"
          stops={REVENUE_STOPS}
          value={form.annualRevenueUSD}
          onChange={(v) => set('annualRevenueUSD', v)}
          format={formatShortMoney}
        />

        <NumberStepper
          label="Number of states you're filing in today"
          value={form.statesFiling}
          onChange={(v) => set('statesFiling', v)}
          min={0}
          max={50}
          suffix="states"
        />

        <NumberStepper
          label="Number of new registrations needed"
          value={form.registrationBacklog}
          onChange={(v) => set('registrationBacklog', v)}
          min={0}
          max={50}
          suffix="states"
        />

        <SstStateGrid
          label="SST states with economic nexus"
          selected={sstStates}
          onChange={setSstStates}
          filingCap={form.statesFiling}
        />
      </aside>

      {/* Results */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold">Estimated annual cost</h2>
          <p className="text-xs text-ink-subtle small-caps">Cheapest first</p>
        </div>
        {!hasInput && (
          <div className="rounded border border-rule p-6">
            <p className="text-ink-muted">
              Enter your order volume and filing states to rank all eight providers for
              your business.
            </p>
            <p className="text-ink-subtle mt-3 text-sm">
              Not sure yet? The table above shows what each provider costs for two
              typical ecommerce profiles.
            </p>
          </div>
        )}
        {hasInput && results.length === 0 && (
          <p className="text-ink-subtle">Couldn&apos;t compute estimates. Check the console.</p>
        )}
        {results.map((r, i) => (
          <ProviderCard key={r.slug} estimate={r} rank={i + 1} />
        ))}
        <p className="text-xs text-ink-subtle mt-6 max-w-prose">
          These are estimates from each provider&apos;s published pricing, or when they don&apos;t
          publish, ranges from real buyer contracts. Not a quote. Each provider may run current
          deals or surcharges that shift the math.{' '}
          <a href="/methodology" className="no-underline hover:text-accent">See methodology</a> for
          how we rate sources.
        </p>
      </section>
    </div>
  );
}

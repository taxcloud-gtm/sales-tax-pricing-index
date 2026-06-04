import type { ProviderData } from '../../../calculator/src/data/types';
import { money, entryAnnualPrice } from '@/lib/format';

type Cite = { source?: string; confidence?: string } | null;

/** Inline source + confidence badge, mirroring the provider pricing table. */
function CiteLink({ cite }: { cite: Cite }) {
  if (!cite?.source || !cite.confidence) return null;
  return (
    <a
      href={cite.source}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs no-underline text-ink-subtle hover:text-accent ml-1.5 whitespace-nowrap"
      title={`Source: ${cite.source}`}
    >
      [{cite.confidence}] ↗
    </a>
  );
}

function cheapestPaid(p: ProviderData) {
  return p.plans
    .filter((pl) => !pl.is_free)
    .sort((a, b) => (a.monthly_price.amount ?? Number.POSITIVE_INFINITY) - (b.monthly_price.amount ?? Number.POSITIVE_INFINITY))[0];
}

function startingPriceCell(p: ProviderData): string {
  const c = cheapestPaid(p);
  if (!c) return 'No paid plan published';
  if (c.is_quote_only) return `${c.name}: quote required`;
  const mp = c.monthly_price;
  if (mp.type === 'range' && mp.range_min != null && mp.range_max != null) {
    return `${c.name}: ${money(mp.range_min)}–${money(mp.range_max)}/mo`;
  }
  if (mp.amount == null) return `${c.name}: not published`;
  if (mp.amount === 0) return `${c.name}: no monthly fee (per-event pricing)`;
  const prefix = mp.type === 'starting_at' ? 'from ' : '';
  const annual = entryAnnualPrice(c);
  const annualSuffix = annual != null ? ` · ${money(annual)}/yr` : '';
  return `${c.name}: ${prefix}${money(mp.amount)}/mo${annualSuffix}`;
}

function perFilingCell(p: ProviderData): string {
  if (!p.filings?.has_per_filing_fee) return 'None';
  const a = p.filings.base_cost?.amount;
  return a != null ? `${money(a)} / filing` : 'Charged, amount not published';
}

function perRegistrationCell(p: ProviderData): string {
  if (!p.registrations?.has_per_registration_fee) return 'None';
  const a = p.registrations.base_cost?.amount;
  return a != null ? `${money(a)} / registration` : 'Charged, amount not published';
}

function transactionFeeCell(p: ProviderData): string {
  if (!p.transaction_fees?.has_transaction_fee) return 'None';
  if (p.transaction_fees.rate == null) return 'Charged, rate not published';
  const u = p.transaction_fees.rate_unit;
  return u === 'percent'
    ? `${p.transaction_fees.rate}%`
    : `${p.transaction_fees.rate} ${u}`;
}

function tierLabel(t: ProviderData['transparency']['tier']): string {
  return { transparent: 'Transparent', partial: 'Partial', opaque: 'Opaque' }[t];
}

function yesNo(v: boolean | undefined | null): string {
  return v ? 'Yes' : 'No';
}

interface Row {
  label: string;
  render: (p: ProviderData) => React.ReactNode;
  cite?: (p: ProviderData) => Cite;
}

const ROWS: Row[] = [
  {
    label: 'Entry-tier subscription',
    render: (p) => startingPriceCell(p),
    cite: (p) => {
      const c = cheapestPaid(p);
      return c ? { source: c.monthly_price.source, confidence: c.monthly_price.confidence } : null;
    },
  },
  {
    label: 'Per-state filing fee',
    render: (p) => perFilingCell(p),
    cite: (p) =>
      p.filings?.has_per_filing_fee && p.filings.base_cost
        ? { source: p.filings.base_cost.source, confidence: p.filings.base_cost.confidence }
        : null,
  },
  {
    label: 'Per-state registration fee',
    render: (p) => perRegistrationCell(p),
    cite: (p) =>
      p.registrations?.has_per_registration_fee && p.registrations.base_cost
        ? { source: p.registrations.base_cost.source, confidence: p.registrations.base_cost.confidence }
        : null,
  },
  { label: 'Per-transaction fee', render: (p) => transactionFeeCell(p) },
  { label: 'Pricing transparency', render: (p) => tierLabel(p.transparency.tier) },
  { label: 'SST Certified Service Provider', render: (p) => yesNo(p.sst?.is_csp) },
  { label: 'International VAT / GST', render: (p) => yesNo(p.international?.supports_vat || p.international?.supports_gst) },
];

export function PairTable({ a, b }: { a: ProviderData; b: ProviderData }) {
  return (
    <section className="my-12">
      <h2 className="text-subhed mb-4">Side by side</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="rule-bottom">
              <th className="text-left py-3 pr-4 small-caps text-xs text-ink-subtle w-1/3">Dimension</th>
              <th className="text-left py-3 px-4 font-serif text-base font-semibold text-ink">{a.provider.name}</th>
              <th className="text-left py-3 px-4 font-serif text-base font-semibold text-ink">{b.provider.name}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={i} className="rule-bottom align-top">
                <td className="py-4 pr-4 small-caps text-xs text-ink-subtle">{row.label}</td>
                <td className="py-4 px-4 text-ink">
                  {row.render(a)}
                  {row.cite && <CiteLink cite={row.cite(a)} />}
                </td>
                <td className="py-4 px-4 text-ink">
                  {row.render(b)}
                  {row.cite && <CiteLink cite={row.cite(b)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle mt-3">
        Source confidence:{' '}
        <a href="/methodology" className="no-underline hover:text-accent">
          A = vendor pricing page, B = help center, C = third-party aggregator, G = estimated
        </a>
        . Per-transaction, transparency, and SST rows are structural, not dollar figures.
      </p>
    </section>
  );
}

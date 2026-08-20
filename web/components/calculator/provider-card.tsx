'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProviderEstimate } from '../../../calculator/src/types';
import { renderEstimate } from '@/lib/format';
import { providerPath } from '@/lib/slugs';

export function ProviderCard({ estimate, rank }: { estimate: ProviderEstimate; rank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="bg-paper-raised border border-rule p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-ink-subtle">#{rank}</span>
            <h3 className="font-serif text-lg font-semibold text-ink">{estimate.provider}</h3>
            <span className="small-caps text-[10px] text-ink-subtle">{estimate.transparencyTier}</span>
          </div>
          <p className="text-sm text-ink-muted mt-1">Recommended plan: <span className="text-ink">{estimate.recommendedPlan}</span></p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-semibold text-ink whitespace-nowrap">
            {renderEstimate(estimate.estimate)}
          </p>
          <p className="text-[10px] small-caps text-ink-subtle">per year</p>
        </div>
      </div>

      {(estimate.assumptions.length > 0 || estimate.caveats.length > 0) && (
        <ul className="mt-4 text-sm text-ink-muted space-y-1.5">
          {estimate.assumptions.slice(0, 4).map((a, i) => (
            <li key={`a-${i}`}>· {a}</li>
          ))}
          {estimate.caveats.slice(0, 1).map((c, i) => (
            <li key={`c-${i}`} className="text-accent">⚠ {c}</li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 pt-4 rule-top text-sm space-y-3">
          {estimate.assumptions.length > 2 && (
            <div>
              <p className="small-caps text-xs text-ink-subtle">All assumptions</p>
              <ul className="mt-2 space-y-1 text-ink-muted">
                {estimate.assumptions.map((a, i) => (<li key={i}>· {a}</li>))}
              </ul>
            </div>
          )}
          {estimate.caveats.length > 1 && (
            <div>
              <p className="small-caps text-xs text-ink-subtle">All caveats</p>
              <ul className="mt-2 space-y-1 text-ink-muted">
                {estimate.caveats.map((c, i) => (<li key={i}>· {c}</li>))}
              </ul>
            </div>
          )}
          {estimate.breakdown && (
            <div>
              <p className="small-caps text-xs text-ink-subtle">Cost breakdown</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-ink-muted">
                <dt>Subscription</dt><dd>${Math.round(estimate.breakdown.subscription).toLocaleString()}</dd>
                <dt>Filings</dt><dd>${Math.round(estimate.breakdown.filings).toLocaleString()}</dd>
                {typeof estimate.breakdown.filingsNotCharged === 'number' && estimate.breakdown.filingsNotCharged > 0 && (
                  <>
                    <dt className="text-accent">SST returns</dt>
                    <dd className="text-accent">{estimate.breakdown.filingsNotCharged} not charged</dd>
                  </>
                )}
                <dt>Registrations</dt><dd>${Math.round(estimate.breakdown.registrations).toLocaleString()}</dd>
                <dt>Transactions</dt><dd>${Math.round(estimate.breakdown.transactions).toLocaleString()}</dd>
                <dt>Add-ons</dt><dd>${Math.round(estimate.breakdown.addOns).toLocaleString()}</dd>
                <dt>Implementation</dt><dd>${Math.round(estimate.breakdown.implementation).toLocaleString()}</dd>
              </dl>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 rule-top flex items-center justify-between text-xs">
        <button
          type="button"
          className="text-ink-subtle hover:text-accent"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide the breakdown' : 'Show the full breakdown'}
        </button>
        <Link
          href={providerPath(estimate.slug)}
          className="no-underline text-ink-muted hover:text-accent"
        >
          Full {estimate.provider} pricing →
        </Link>
      </div>
    </article>
  );
}

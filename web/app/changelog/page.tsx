import type { Metadata } from 'next';
import type { ProviderData, ChangeLogEntry } from '../../../calculator/src/data/types';
import { getAllProviders } from '@/lib/data/providers';
import { formatDate } from '@/lib/last-updated';
import { providerPath } from '@/lib/slugs';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing changelog',
  description:
    'Public log of pricing changes across the sales tax compliance providers tracked on this site. Date, field, source, and effect on the calculator.',
};

interface DatedEntry extends ChangeLogEntry {
  providerName: string;
  providerSlug: string;
}

function allEntries(providers: ProviderData[]): DatedEntry[] {
  const out: DatedEntry[] = [];
  for (const p of providers) {
    for (const e of p.change_log ?? []) {
      out.push({ ...e, providerName: p.provider.name, providerSlug: p.provider.slug });
    }
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  price_increase: 'Price increase',
  price_decrease: 'Price decrease',
  new_plan: 'New plan',
  discontinued_plan: 'Discontinued plan',
  structure_change: 'Structure change',
};

export default function ChangelogPage() {
  const entries = allEntries(getAllProviders());

  return (
    <article className="mx-auto max-w-prose px-6 py-16">
      <header>
        <p className="small-caps text-xs text-ink-subtle">Trail</p>
        <h1 className="text-hed mt-2">Pricing changelog</h1>
        <p className="text-ink-muted mt-4">
          When a tracked provider changes its pricing, we log it here with the date and the source URL
          we pulled it from. No silent edits.
        </p>
        <p className="text-ink-muted text-sm mt-4">
          This page is about what <em>vendors</em> changed. When{' '}
          <strong className="text-ink">this site</strong> got something wrong, that is a different
          thing and it goes in the{' '}
          <Link href="/corrections" className="no-underline hover:text-accent">
            corrections log
          </Link>
          , which records what was published, what it says now, and which direction the error ran
          in. Keeping them apart matters: a mistake of ours is not a vendor price change.
        </p>
      </header>

      <section className="mt-12">
        {entries.length === 0 ? (
          <div className="border border-rule bg-paper-sunken p-6 text-sm">
            <p className="font-semibold text-ink">Nothing logged yet.</p>
            <p className="text-ink-muted mt-2">
              The site is fresh; the current pricing snapshot is the baseline. The first time a
              tracked provider changes a published number, you&apos;ll see it here with the date,
              what changed, and where we caught it.
            </p>
          </div>
        ) : (
          <ol className="space-y-8">
            {entries.map((e, i) => (
              <li key={i} className="grid grid-cols-[7rem_1fr] gap-5 rule-bottom pb-7">
                <time dateTime={e.date} className="font-mono text-sm text-ink-muted">
                  {formatDate(e.date)}
                </time>
                <div>
                  <p className="text-xs small-caps text-accent">
                    {CHANGE_TYPE_LABEL[e.change_type] ?? e.change_type}
                  </p>
                  <h3 className="font-serif font-semibold text-ink mt-1">
                    <Link href={providerPath(e.providerSlug)} className="no-underline hover:text-accent">
                      {e.providerName}
                    </Link>
                  </h3>
                  <p className="text-ink-muted mt-2">{e.description}</p>
                  {e.source && (
                    <a
                      href={e.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-xs no-underline text-ink-subtle hover:text-accent"
                    >
                      Source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

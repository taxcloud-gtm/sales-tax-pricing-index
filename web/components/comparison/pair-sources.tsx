import type { ProviderData } from '../../../calculator/src/data/types';
import { formatDate } from '@/lib/last-updated';

/**
 * Combined, de-duplicated source list for a pairwise comparison page. Mirrors
 * the provider SourcesList so comparison pages carry the same "every figure
 * traces back" sourcing the provider pages do.
 */
export function PairSources({ a, b }: { a: ProviderData; b: ProviderData }) {
  const seen = new Set<string>();
  const sources = [...(a.sources ?? []), ...(b.sources ?? [])].filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
  if (sources.length === 0) return null;

  return (
    <section className="my-12">
      <h2 className="text-subhed mb-4">Sources</h2>
      <p className="text-ink-muted text-sm max-w-prose mb-6">
        Every {a.provider.name} and {b.provider.name} figure on this page traces back to one of the
        sources below. Confidence ratings are explained on the{' '}
        <a href="/methodology" className="no-underline hover:text-accent">methodology page</a>.
      </p>
      <ol className="space-y-3 text-sm">
        {sources.map((s, i) => (
          <li key={i} className="grid grid-cols-[2rem_3rem_1fr] gap-3 items-baseline">
            <span className="text-ink-subtle text-xs">[{i + 1}]</span>
            <span className="font-mono text-xs font-semibold text-accent">{s.confidence}</span>
            <div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink no-underline hover:text-accent"
              >
                {s.title || s.url}
              </a>
              {s.accessed_date && (
                <span className="block text-xs text-ink-subtle mt-0.5">
                  Accessed {formatDate(s.accessed_date)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

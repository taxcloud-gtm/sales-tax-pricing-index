import type { ProviderData } from '../../../calculator/src/data/types';
import { howMuchDoesXCost } from '@/lib/summary';

/**
 * The AEO-critical answer paragraph. Sits directly under the H1 and answers
 * "How much does {X} cost?" in 2-3 sentences derived from YAML.
 */
export function SummaryProse({ provider }: { provider: ProviderData }) {
  return (
    <section className="my-8 max-w-prose">
      <p className="text-lg leading-relaxed text-ink">
        {/* includeTypical: false — the TL;DR block above already carries the
            mid-market sentence verbatim; repeating it read as a template bug. */}
        {howMuchDoesXCost(provider, { includeTypical: false })}
      </p>
    </section>
  );
}

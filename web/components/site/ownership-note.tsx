import Link from 'next/link';

/**
 * The disclosure block used at the top of every head-term page.
 *
 * These pages rank providers against each other on a page published by one of
 * them, which is a sharper conflict than a single-provider page has. The
 * disclosure therefore sits above the analysis rather than in the footer, and
 * says what was done about the conflict rather than only admitting it exists.
 */
export function OwnershipNote({
  children,
  heading = 'Who publishes this, and why it matters here',
}: {
  children: React.ReactNode;
  heading?: string;
}) {
  return (
    <section className="my-10 border border-rule bg-paper-sunken rounded-lg p-6">
      <p className="small-caps text-[11px] text-ink-subtle mb-2">Disclosure</p>
      <h2 className="font-sans text-base font-bold text-ink mb-3">{heading}</h2>
      <div className="text-sm text-ink-muted space-y-3">{children}</div>
      <p className="text-xs text-ink-subtle mt-4">
        <Link href="/methodology#ownership" className="no-underline hover:text-accent">
          Full ownership disclosure
        </Link>{' '}
        ·{' '}
        <Link href="/methodology" className="no-underline hover:text-accent">
          How every price is sourced
        </Link>
      </p>
    </section>
  );
}

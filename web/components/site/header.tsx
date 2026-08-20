import Link from 'next/link';

export function Header() {
  return (
    <header className="rule-bottom bg-paper sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-5">
        <Link href="/" className="no-underline hover:no-underline group whitespace-nowrap">
          <span className="block font-sans text-base sm:text-lg font-semibold tracking-tight text-ink group-hover:text-accent transition-colors leading-tight">
            Sales Tax Pricing Index
          </span>
          <span className="block small-caps text-[10px] text-ink-subtle mt-0.5">
            A sourced comparison
          </span>
        </Link>
        <nav className="flex items-center gap-5 sm:gap-6 text-sm font-medium">
          <Link href="/calculator" className="text-ink-muted hover:text-ink no-underline">Calculator</Link>
          <Link href="/how-much-does-sales-tax-software-cost" className="text-ink-muted hover:text-ink no-underline">What it costs</Link>
          <Link href="/sst-csp-savings" className="text-ink-muted hover:text-ink no-underline">SST &amp; CSP</Link>
          <Link href="/methodology" className="text-ink-muted hover:text-ink no-underline">Methodology</Link>
          <Link href="/changelog" className="text-ink-muted hover:text-ink no-underline">Changelog</Link>
          <Link href="/corrections" className="text-ink-muted hover:text-ink no-underline">Corrections</Link>
        </nav>
      </div>
    </header>
  );
}

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="rule-top mt-24 bg-paper-sunken">
      <div className="mx-auto max-w-6xl px-6 py-10 grid gap-6 md:grid-cols-3 text-sm">
        <div>
          <p className="font-serif text-base font-semibold">Sales Tax Pricing Index</p>
          <p className="text-ink-muted mt-2 max-w-xs">
            A sourced comparison of sales tax compliance pricing.
            We publish what providers publish, and own it when our owner&apos;s product costs more.
          </p>
        </div>
        <div className="text-ink-muted">
          <p className="small-caps text-xs text-ink-subtle">Trust</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/methodology" className="no-underline hover:text-accent">Methodology</Link></li>
            <li><Link href="/methodology#ownership" className="no-underline hover:text-accent">Ownership disclosure</Link></li>
            <li><Link href="/changelog" className="no-underline hover:text-accent">Pricing changelog</Link></li>
            <li><Link href="/corrections" className="no-underline hover:text-accent">Corrections</Link></li>
          </ul>
        </div>
        <div className="text-ink-muted">
          <p className="small-caps text-xs text-ink-subtle">Tools</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/calculator" className="no-underline hover:text-accent">Calculator</Link></li>
            <li><Link href="/" className="no-underline hover:text-accent">All providers</Link></li>
            <li><Link href="/how-much-does-sales-tax-software-cost" className="no-underline hover:text-accent">What sales tax software costs</Link></li>
            <li><Link href="/cheapest-sales-tax-software" className="no-underline hover:text-accent">Cheapest sales tax software</Link></li>
            <li><Link href="/sales-tax-software-hidden-fees" className="no-underline hover:text-accent">Hidden fees</Link></li>
          </ul>
        </div>
      </div>
      <div className="rule-top">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-ink-subtle">
          This site is operated by TaxCloud, Inc., a sales tax compliance provider included in these comparisons.{' '}
          <Link href="/methodology#ownership" className="no-underline hover:text-accent">Read the disclosure →</Link>
        </div>
      </div>
    </footer>
  );
}

/**
 * Prebuild: load every provider YAML via the calculator package's validator,
 * then dump the result as a single JSON file the web app imports statically.
 *
 * Run: tsx scripts/build-data.ts
 * Wired into `prebuild` and `predev` in package.json — happens automatically.
 *
 * Why a JSON dump instead of importing the loader at request time:
 *   1. Zero runtime `fs` / `js-yaml` / `ajv` in the bundle.
 *   2. No Vercel file-tracing edge cases for the providers/ directory.
 *   3. The prebuild fails loudly if a YAML is malformed — surfaces the same
 *      validation the calculator package's `npm run validate` would catch.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadProviders } from '../../calculator/src/data/loader';

const OUT_DIR = path.join(__dirname, '..', 'lib', 'data');
const OUT_FILE = path.join(OUT_DIR, 'providers.json');

/**
 * Internal-only fields that must never ship in the public providers.json
 * payload. These hold competitive intelligence, GTM framing, and open
 * research questions meant for internal review, not the public site.
 *
 * - top-level `notes`: "Competitive intelligence for /vs/… landing page" and
 *   "Open research questions" blocks (includes TaxCloud counter-messaging).
 * - `provider.competitive_position`: internal GTM positioning.
 *
 * Factual section notes (filings.notes, registrations.notes, etc.) are NOT
 * stripped — those are sourced and rendered on the site.
 */
function stripInternal(provider: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...provider };
  delete clone.notes;
  if (clone.provider && typeof clone.provider === 'object') {
    const meta = { ...(clone.provider as Record<string, unknown>) };
    delete meta.competitive_position;
    clone.provider = meta;
  }
  return clone;
}

function main(): void {
  const map = loadProviders();
  const obj = Object.fromEntries(
    Array.from(map, ([slug, data]) => [slug, stripInternal(data as unknown as Record<string, unknown>)]),
  );
  const slugs = Array.from(map.keys()).sort();

  const payload = {
    generatedAt: new Date().toISOString(),
    slugs,
    providers: obj,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));

  console.log(`✓ Wrote ${slugs.length} providers to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  ${slugs.join(', ')}`);
}

main();

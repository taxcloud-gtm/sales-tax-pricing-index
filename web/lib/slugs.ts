import { PROVIDER_SLUGS } from './data/providers';

/**
 * Alphabetized pair slug, e.g. ("taxjar", "anrok") → "anrok-vs-taxjar".
 * Canonical ordering prevents duplicate routes for the same pair.
 */
export function pairSlug(a: string, b: string): string {
  return [a, b].sort().join('-vs-');
}

export function parsePairSlug(pair: string): [string, string] | null {
  const parts = pair.split('-vs-');
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

/**
 * All alphabetized, unique provider pairs (28 for 8 providers).
 */
export function allPairs(): Array<[string, string]> {
  const slugs = [...PROVIDER_SLUGS].sort();
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      pairs.push([slugs[i], slugs[j]]);
    }
  }
  return pairs;
}

export function providerPath(slug: string): string {
  return `/${slug}-pricing`;
}

export function pairPath(a: string, b: string): string {
  return `/${pairSlug(a, b)}-pricing`;
}

/**
 * External URL for the switching-cost page. The route file lives at
 * app/switch/[slug] and is rewritten to this path in next.config.ts, the same
 * pattern the provider and comparison pages use.
 */
export function switchPath(slug: string): string {
  return `/cost-to-switch-from-${slug}`;
}

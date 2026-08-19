import type { MetadataRoute } from 'next';
import { PROVIDER_SLUGS } from '@/lib/data/providers';
import { allPairs, providerPath, pairPath } from '@/lib/slugs';
import { siteUrl } from '@/lib/utils';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl().replace(/\/$/, '');
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/calculator`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/sst-csp-savings`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const providerRoutes: MetadataRoute.Sitemap = PROVIDER_SLUGS.map((slug) => ({
    url: `${base}${providerPath(slug)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const pairRoutes: MetadataRoute.Sitemap = allPairs().map(([a, b]) => ({
    url: `${base}${pairPath(a, b)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...providerRoutes, ...pairRoutes];
}

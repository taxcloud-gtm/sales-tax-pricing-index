import type { NextConfig } from 'next';
import * as path from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..'),

  // Keyword-loaded external URLs map to clean internal route files.
  // External: /anrok-pricing            → app/p/[slug]/page.tsx
  // External: /anrok-vs-taxjar-pricing  → app/c/[pair]/page.tsx
  // External: /cost-to-switch-from-avalara → app/switch/[slug]/page.tsx
  async rewrites() {
    return [
      {
        source: '/cost-to-switch-from-:slug([a-z0-9-]+)',
        destination: '/switch/:slug',
      },
      {
        source: '/:slug([a-z0-9-]+-vs-[a-z0-9-]+)-pricing',
        destination: '/c/:slug',
      },
      {
        source: '/:slug([a-z0-9-]+)-pricing',
        destination: '/p/:slug',
      },
    ];
  },

  // Canonicalize: someone landing on the internal /p/* or /c/* URL directly
  // gets 308'd to the pretty external URL. Rewrites run server-side first,
  // so the prettier path doesn't loop back through the redirect.
  async redirects() {
    return [
      { source: '/switch/:slug', destination: '/cost-to-switch-from-:slug', permanent: true },
      { source: '/p/:slug', destination: '/:slug-pricing', permanent: true },
      { source: '/c/:pair', destination: '/:pair-pricing', permanent: true },
    ];
  },

  // Safety net: ensure provider YAMLs are file-traced for any code path that
  // might end up reading them at runtime (the prebuild script should make this
  // unnecessary, but it's cheap insurance).
  outputFileTracingIncludes: {
    '/': ['../calculator/providers/**/*.yaml'],
  },
};

export default config;

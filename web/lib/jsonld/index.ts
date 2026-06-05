import type { ProviderData } from '../../../calculator/src/data/types';
import { productJsonLd } from './product';
import { faqJsonLd } from './faq';
import { tableJsonLd } from './table';

/**
 * Compose every JSON-LD blob needed on a single-provider page into one array.
 * Render the array as a single <script type="application/ld+json"> in the
 * server component.
 */
export function providerPageJsonLd(p: ProviderData) {
  return [productJsonLd(p), faqJsonLd(p), tableJsonLd(p)];
}

export { productJsonLd, faqJsonLd, tableJsonLd };
export { datasetJsonLd } from './dataset';

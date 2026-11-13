/* Public site info used by metadata, OG images, robots and sitemap.
 * On Vercel the production URL is picked up automatically; set
 * NEXT_PUBLIC_SITE_URL to override it (e.g. a custom domain). */

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export const SITE = {
  name: 'Count Lab',
  title: 'Count Lab · Blackjack 3D',
  tagline: '3D blackjack trainer for card counting',
  description:
    'Practice Hi-Lo card counting, basic strategy, index plays and bet ramps at a 3D blackjack table. Free, in the browser, works offline.',
  url: siteUrl(),
  keywords: ['blackjack', 'card counting', 'Hi-Lo', 'basic strategy', 'Illustrious 18', 'true count', 'trainer', 'three.js', '3D'],
} as const;

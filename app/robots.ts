import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const url = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/me',
          '/room',
          '/archive',
          '/auth',
          '/api',
          '/login',
          '/signup',
          '/suspended',
          '/banned',
          '/disconnected',
        ],
      },
    ],
    sitemap: `${url.replace(/\/$/, '')}/sitemap.xml`,
    host: url,
  };
}

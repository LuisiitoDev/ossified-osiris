import { getOrIncrementCounter } from '../../src/server/counterStore.mjs';
import {
  identifyVisitor, visitorCookieHeader, countProtectedVisit,
} from '../../src/server/visitProtection.mjs';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

// GET is a read-only request; POST counts a view at most once per visitor
// per article within 24 hours, with IP and visitor frequency limits.
export default async (request, context) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
  }
  const slug = context?.params?.slug;
  if (!slug || !/^[a-z0-9-_]{1,64}$/i.test(slug)) {
    return json({ error: 'Invalid counter slug' }, 400);
  }
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    if ((origin && origin !== new URL(request.url).origin) || site === 'cross-site') {
      return json({ error: 'Cross-site requests are not allowed' }, 403);
    }
  }

  try {
    if (request.method === 'GET') {
      return json(await getOrIncrementCounter({ slug }));
    }

    const visitor = identifyVisitor(request);
    const result = await countProtectedVisit({
      slug, visitorId: visitor.id, clientIp: context?.ip,
    });
    const headers = visitor.isNew ? { 'Set-Cookie': visitorCookieHeader(visitor) } : {};
    if (result.rateLimited) {
      return json(
        { count: result.count, counted: false, error: 'View limit reached' },
        429, { ...headers, 'Retry-After': '3600' },
      );
    }
    return json({ count: result.count, counted: result.counted }, 200, headers);
  } catch (error) {
    console.error('Visit counter backend failed:',
      error instanceof Error ? error.message : 'unknown failure');
    return json({ error: 'Visit count temporarily unavailable' }, 503);
  }
};

export const config = {
  path: '/api/counter/:slug',
};

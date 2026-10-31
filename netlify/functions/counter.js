import { getOrIncrementCounter } from '../../src/server/counterStore.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// GET retrieves the current count without changing it.
// POST increments the persistent counter by one; never use GET for writes.
export default async (request, context) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const slug = context?.params?.slug;
  if (!slug || !/^[a-z0-9-_]{1,64}$/i.test(slug)) {
    return json({ error: 'Invalid counter slug' }, 400);
  }

  try {
    const result = await getOrIncrementCounter({
      slug, increment: request.method === 'POST',
    });
    return json(result);
  } catch (error) {
    console.error('Visit counter backend failed:', error instanceof Error ? error.message : 'unknown failure');
    // Never return provider secrets, upstream bodies or false zero counts.
    return json({ error: 'Visit count temporarily unavailable' }, 503);
  }
};

export const config = {
  path: '/api/counter/:slug',
};

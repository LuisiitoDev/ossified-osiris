// Netlify Function: proxies CounterAPI v2 so the Bearer token never reaches the browser.
// CounterAPI v2 requires auth, and its CORS policy blocks the Authorization header from being
// sent directly by a browser, so this has to sit server-side. Routed at /api/counter/:slug via
// the `config.path` below (Netlify's path-based routing), no redirect config needed.

function sanitizeSlug(rawSlug) {
	let slug = rawSlug.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '-');
	slug = slug.replace(/^-+|-+$/g, '');

	if (slug.length < 3) {
		slug = 'post-' + slug;
	}
	if (slug.length > 64) {
		slug = slug.substring(0, 64);
	}
	return slug;
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export default async (req, context) => {
	if (req.method !== 'GET') {
		return json({ error: 'Method not allowed' }, 405);
	}

	const WORKSPACE = process.env.COUNTER_API_WORKSPACE;
	const TOKEN = process.env.COUNTER_API_TOKEN;

	if (!WORKSPACE || !TOKEN) {
		return json({ error: 'Counter API is not configured' }, 500);
	}

	const rawSlug = context.params.slug;
	if (!rawSlug) {
		return json({ error: 'Missing slug' }, 400);
	}

	const slug = sanitizeSlug(rawSlug);
	const url = new URL(req.url);
	const shouldIncrement = url.searchParams.get('increment') === 'true';

	try {
		const apiRes = await fetch(
			`https://api.counterapi.dev/v2/${WORKSPACE}/${slug}${shouldIncrement ? '/up' : ''}`,
			{ headers: { Authorization: `Bearer ${TOKEN}` } }
		);

		if (apiRes.status === 404) {
			return json({ count: 0 });
		}

		if (!apiRes.ok) {
			throw new Error(`Counter API responded with ${apiRes.status}`);
		}

		const body = await apiRes.json();
		return json({ count: body?.data?.up_count ?? 0 });
	} catch (err) {
		return json({ error: 'Failed to reach Counter API' }, 502);
	}
};

export const config = {
	path: '/api/counter/:slug',
};

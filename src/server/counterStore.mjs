/**
 * Durable view counters.
 *
 * Preferred backend: Upstash Redis REST (atomic INCR and persistent storage).
 * Existing CounterAPI v2 remains supported until the user configures Redis.
 *
 * One-time opt-in migration: COUNTER_MIGRATE_FROM_COUNTERAPI=true. When the
 * Redis key is missing, read the existing CounterAPI total and SETNX it before
 * the first Redis read or increment. Never overwrite an initialized Redis key.
 */
export function normalizeSlug(rawSlug) {
  let slug = String(rawSlug ?? '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  if (slug.length < 3) slug = 'post-' + slug;
  return slug.slice(0, 64);
}

export function counterKey(slug) {
  // Keep key names and their version stable across future deployments.
  return 'luisiitodev:views:v1:' + normalizeSlug(slug);
}

function countFrom(value, source) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(source + ' returned a missing or invalid counter value');
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(source + ' returned a missing or invalid counter value');
  }
  return count;
}

export function configFor(env) {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url || token) {
    if (!url || !token || !/^https:\/\/[^/]+$/i.test(url.replace(/\/$/, ''))) {
      throw new Error('Upstash configuration is incomplete or invalid');
    }
    return { provider: 'upstash', url: url.replace(/\/$/, ''), token };
  }
  if (!env.COUNTER_API_WORKSPACE || !env.COUNTER_API_TOKEN) {
    throw new Error('No persistent counter backend configured');
  }
  return { provider: 'counterapi' };
}

export async function redisCommand(config, fetchImpl, command) {
  const res = await fetchImpl(config.url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('Redis backend returned HTTP ' + res.status);
  const payload = await res.json();
  if (!payload || typeof payload !== 'object' || 'error' in payload ||
    !Object.hasOwn(payload, 'result')) {
    throw new Error('Redis backend returned an error');
  }
  return payload.result;
}

async function counterApiRead(slug, env, fetchImpl, increment = false) {
  const workspace = encodeURIComponent(env.COUNTER_API_WORKSPACE);
  const endpoint = 'https://api.counterapi.dev/v2/' + workspace + '/' +
    encodeURIComponent(slug) + (increment ? '/up' : '');
  const res = await fetchImpl(endpoint, {
    headers: { Authorization: 'Bearer ' + env.COUNTER_API_TOKEN },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) {
    // A missing record isn't proof that a previously tracked total was zero.
    // On first publication the /up endpoint creates the counter.
    throw new Error('CounterAPI counter not found: ' + slug);
  }
  if (!res.ok) throw new Error('CounterAPI returned HTTP ' + res.status);
  const payload = await res.json();
  return countFrom(payload?.data?.up_count, 'CounterAPI');
}

export async function ensureMigration(slug, key, config, env, fetchImpl) {
  if (env.COUNTER_MIGRATE_FROM_COUNTERAPI !== 'true') return;
  const current = await redisCommand(config, fetchImpl, ['GET', key]);
  if (current !== null) {
    countFrom(current, 'Redis');
    return;
  }
  if (!env.COUNTER_API_WORKSPACE || !env.COUNTER_API_TOKEN) {
    throw new Error('Migration requested without CounterAPI credentials');
  }
  // Fail rather than seeding zero if the legacy provider is unreachable.
  const legacyCount = await counterApiRead(slug, env, fetchImpl, false);
  await redisCommand(config, fetchImpl, ['SETNX', key, String(legacyCount)]);
}

export async function getOrIncrementCounter({
  slug, increment = false, env = process.env, fetchImpl = fetch,
}) {
  const normalized = normalizeSlug(slug);
  const config = configFor(env);

  if (config.provider === 'counterapi') {
    return { count: await counterApiRead(normalized, env, fetchImpl, increment) };
  }

  const key = counterKey(normalized);
  await ensureMigration(normalized, key, config, env, fetchImpl);
  const result = await redisCommand(config, fetchImpl,
    [increment ? 'INCR' : 'GET', key]);
  return { count: result === null && !increment ? 0 : countFrom(result, 'Redis') };
}

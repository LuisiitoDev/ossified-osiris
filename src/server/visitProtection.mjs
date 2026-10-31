import { createHmac, randomUUID } from 'node:crypto';
import { counterKey, normalizeSlug, configFor, redisCommand, ensureMigration } from './counterStore.mjs';

/**
 * Each browser receives an anonymous, HttpOnly cookie. Redis only stores
 * keyed hashes of this ID and the Netlify-provided client IP; never raw IPs.
 * Keys are time-limited. The global counter key is deliberately unchanged.
 */
const COOKIE_NAME = 'ldv_visitor';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
export const VIEW_DEDUP_SECONDS = 24 * 60 * 60;
export const RATE_WINDOW_SECONDS = 60 * 60;
export const IP_VIEW_LIMIT = 90;
export const VISITOR_VIEW_LIMIT = 30;

const COUNT_ONCE_LUA = [
  'local countKey, seenKey, ipKey, visitorKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4]',
  'local current = tonumber(redis.call("GET", countKey) or "0")',
  'if redis.call("EXISTS", seenKey) == 1 then return {current, 0, 0} end',
  'if tonumber(redis.call("GET", ipKey) or "0") >= tonumber(ARGV[3]) then return {current, 0, 1} end',
  'if tonumber(redis.call("GET", visitorKey) or "0") >= tonumber(ARGV[4]) then return {current, 0, 1} end',
  'redis.call("SET", seenKey, "1", "EX", tonumber(ARGV[1]))',
  'local ipHits = redis.call("INCR", ipKey)',
  'if ipHits == 1 then redis.call("EXPIRE", ipKey, tonumber(ARGV[2])) end',
  'local visitorHits = redis.call("INCR", visitorKey)',
  'if visitorHits == 1 then redis.call("EXPIRE", visitorKey, tonumber(ARGV[2])) end',
  'local nextCount = redis.call("INCR", countKey)',
  'return {nextCount, 1, 0}',
].join('\n');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function identifyVisitor(request, generateId = randomUUID) {
  const cookies = (request.headers.get('cookie') ?? '').split(';');
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split('=');
    if (name !== COOKIE_NAME) continue;
    const value = parts.join('=');
    if (UUID_PATTERN.test(value)) return { id: value.toLowerCase(), isNew: false };
  }
  return { id: generateId(), isNew: true };
}

export function visitorCookieHeader(visitor) {
  return COOKIE_NAME + '=' + visitor.id +
    '; Max-Age=' + COOKIE_MAX_AGE +
    '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

function keyedHash(secret, prefix, text) {
  return createHmac('sha256', secret)
    .update('blog-counter-v1:' + prefix + ':' + text)
    .digest('hex');
}

export function protectedCounterKeys({ slug, visitorId, clientIp, secret }) {
  if (!UUID_PATTERN.test(visitorId)) throw new Error('Invalid anonymous visitor ID');
  // Use Netlify's trusted context.ip (not spoofable X-Forwarded-For headers).
  if (typeof clientIp !== 'string' || !clientIp.trim()) {
    throw new Error('Missing trusted client IP from Netlify');
  }
  const post = normalizeSlug(slug);
  const visitorHash = keyedHash(secret, 'visitor', visitorId);
  const ipHash = keyedHash(secret, 'ip', clientIp);
  return [
    counterKey(post),
    'luisiitodev:views:seen:v1:' + post + ':' + visitorHash,
    'luisiitodev:views:rate:ip:v1:' + ipHash,
    'luisiitodev:views:rate:visitor:v1:' + visitorHash,
  ];
}

export async function countProtectedVisit({
  slug, visitorId, clientIp, env = process.env, fetchImpl = fetch,
}) {
  const config = configFor(env);
  if (config.provider !== 'upstash') {
    throw new Error('Protected visit counts require Upstash Redis');
  }
  const normalized = normalizeSlug(slug);
  const keys = protectedCounterKeys({
    slug: normalized, visitorId, clientIp, secret: config.token,
  });

  // Preserve the existing opt-in migration behavior, never reset its keys.
  await ensureMigration(normalized, keys[0], config, env, fetchImpl);

  // A single Redis script enforces both limits, deduplicates and increments,
  // atomically across concurrent Netlify Function instances.
  const result = await redisCommand(config, fetchImpl, [
    'EVAL', COUNT_ONCE_LUA, '4', ...keys,
    String(VIEW_DEDUP_SECONDS), String(RATE_WINDOW_SECONDS),
    String(IP_VIEW_LIMIT), String(VISITOR_VIEW_LIMIT),
  ]);
  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error('Redis returned malformed rate limit result');
  }
  const [count, counted, limited] = result.map(Number);
  if (!Number.isSafeInteger(count) || count < 0 ||
      (counted !== 0 && counted !== 1) || (limited !== 0 && limited !== 1)) {
    throw new Error('Redis returned invalid rate limit result');
  }
  return { count, counted: counted === 1, rateLimited: limited === 1 };
}

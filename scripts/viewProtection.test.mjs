import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrIncrementCounter, counterKey } from '../src/server/counterStore.mjs';
import {
  identifyVisitor, visitorCookieHeader, protectedCounterKeys,
  countProtectedVisit, IP_VIEW_LIMIT, VISITOR_VIEW_LIMIT,
} from '../src/server/visitProtection.mjs';

const env = {
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-secret-only',
};
const visitorId = '992c9c41-6776-4d41-9166-08f450fc157a';
const otherVisitor = '90361489-3d78-402f-a4e6-b3ee5bdd8db7';

function mockRedis(start = 0) {
  const counts = new Map([[counterKey('mcp'), start]]);
  const seen = new Set();
  const rate = new Map();
  const commands = [];
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body);
    commands.push(command);
    const [op, ...args] = command;

    if (op === 'GET') return Response.json({ result: counts.get(args[0]) ?? null });
    if (op !== 'EVAL') throw new Error('Unexpected command: ' + op);
    assert.equal(args[1], '4');
    const [totalKey, seenKey, ipKey, visitorKey] = args.slice(2, 6);
    const [, , ipLimit, visitorLimit] = args.slice(6).map(Number);
    let total = counts.get(totalKey) ?? 0;
    if (seen.has(seenKey)) return Response.json({ result: [total, 0, 0] });
    if ((rate.get(ipKey) ?? 0) >= ipLimit ||
        (rate.get(visitorKey) ?? 0) >= visitorLimit) {
      return Response.json({ result: [total, 0, 1] });
    }
    seen.add(seenKey);
    rate.set(ipKey, (rate.get(ipKey) ?? 0) + 1);
    rate.set(visitorKey, (rate.get(visitorKey) ?? 0) + 1);
    total += 1;
    counts.set(totalKey, total);
    return Response.json({ result: [total, 1, 0] });
  };
  return { fetchImpl, counts, seen, rate, commands };
}

test('anonymous cookie is secure, HttpOnly and reused on subsequent requests', () => {
  const first = identifyVisitor(new Request('https://luisiitodev.com/api/counter/mcp'), () => visitorId);
  assert.deepEqual(first, { id: visitorId, isNew: true });
  const header = visitorCookieHeader(first);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  assert.doesNotMatch(header, /Domain=/);

  const request = new Request('https://luisiitodev.com/api/counter/mcp', {
    headers: { Cookie: 'theme=dark; ldv_visitor=' + visitorId + '; foo=bar' },
  });
  assert.deepEqual(identifyVisitor(request), { id: visitorId, isNew: false });
});

test('invalid anonymous cookie is ignored instead of being used as a Redis key', () => {
  const request = new Request('https://luisiitodev.com/api/counter/mcp', {
    headers: { Cookie: 'ldv_visitor=not-a-uuid; other=1' },
  });
  assert.deepEqual(identifyVisitor(request, () => visitorId), { id: visitorId, isNew: true });
});

test('HMAC keys never contain the client IP, raw visitor cookie or the Redis secret', () => {
  const keys = protectedCounterKeys({
    slug: 'mcp', visitorId, clientIp: '192.0.2.111', secret: env.UPSTASH_REDIS_REST_TOKEN,
  });
  assert.equal(keys[0], counterKey('mcp'));
  for (const key of keys.slice(1)) {
    assert.doesNotMatch(key, /192\.0\.2\.111|992c9c41|test-secret-only/);
  }
  assert.throws(() => protectedCounterKeys({
    slug: 'mcp', visitorId, clientIp: '', secret: env.UPSTASH_REDIS_REST_TOKEN,
  }), /Missing trusted client IP/);
});

test('one browser article view within a day is only incremented once', async () => {
  const mock = mockRedis(41);
  const args = { slug: 'mcp', visitorId, clientIp: '192.0.2.1', env, fetchImpl: mock.fetchImpl };
  const [first, second, third] = await Promise.all([
    countProtectedVisit(args),
    countProtectedVisit(args),
    countProtectedVisit(args),
  ]);
  assert.equal(first.counted, true);
  assert.equal(first.count, 42);
  assert.equal(second.counted, false);
  assert.equal(third.counted, false);
  assert.equal(mock.counts.get(counterKey('mcp')), 42);
  assert.equal(mock.commands.filter((x) => x[0] === 'EVAL').length, 3);
});

test('distinct browsers from a shared IP can be counted separately', async () => {
  const mock = mockRedis(10);
  const base = { slug: 'mcp', clientIp: '203.0.113.2', env, fetchImpl: mock.fetchImpl };
  assert.equal((await countProtectedVisit({ ...base, visitorId })).count, 11);
  assert.equal((await countProtectedVisit({ ...base, visitorId: otherVisitor })).count, 12);
});

test('frequency limit rejects a visitor who rotates through many articles', async () => {
  const mock = mockRedis();
  const base = { visitorId, clientIp: '198.51.100.5', env, fetchImpl: mock.fetchImpl };
  for (let i = 0; i < VISITOR_VIEW_LIMIT; i++) {
    assert.equal((await countProtectedVisit({ ...base, slug: 'post-' + i })).counted, true);
  }
  const blocked = await countProtectedVisit({ ...base, slug: 'blocked-article' });
  assert.equal(blocked.rateLimited, true);
  assert.equal(blocked.counted, false);
  assert.equal(mock.counts.has(counterKey('blocked-article')), false);
});

test('IP frequency limit applies even if the anonymous cookie is rotated', async () => {
  const mock = mockRedis();
  const base = { clientIp: '198.51.100.99', env, fetchImpl: mock.fetchImpl };
  for (let i = 0; i < IP_VIEW_LIMIT; i++) {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-' + i.toString(16).padStart(12, '0');
    assert.equal((await countProtectedVisit({ ...base, visitorId: id, slug: 'mcp' })).counted, true);
  }
  const blocked = await countProtectedVisit({ ...base, visitorId, slug: 'mcp' });
  assert.equal(blocked.rateLimited, true);
  assert.equal(mock.counts.get(counterKey('mcp')), IP_VIEW_LIMIT);
});

test('global counts persist unchanged on read after duplicates and rate limit', async () => {
  const mock = mockRedis(90);
  const base = { slug: 'mcp', visitorId, clientIp: '203.0.113.6', env, fetchImpl: mock.fetchImpl };
  await countProtectedVisit(base);
  await countProtectedVisit(base);
  assert.equal((await getOrIncrementCounter({ slug: 'mcp', env, fetchImpl: mock.fetchImpl })).count, 91);
});

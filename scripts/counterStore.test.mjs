import test from 'node:test';
import assert from 'node:assert/strict';
import { counterKey, normalizeSlug, getOrIncrementCounter } from '../src/server/counterStore.mjs';

const upstashEnv = {
  UPSTASH_REDIS_REST_URL: 'https://example-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-only-token',
};

function mockProviders(initial = {}) {
  const counters = new Map(Object.entries(initial));
  const calls = [];
  let oldCount = 23;
  let counterApiStatus = 200;
  let oldResponse = () => ({ data: { up_count: oldCount } });

  const fetchImpl = async (url, options = {}) => {
    if (url.startsWith(upstashEnv.UPSTASH_REDIS_REST_URL)) {
      const command = JSON.parse(options.body);
      calls.push(command);
      const [action, key, value] = command;
      if (action === 'GET') return Response.json({ result: counters.get(key) ?? null });
      if (action === 'SETNX') {
        if (!counters.has(key)) {
          counters.set(key, String(value));
          return Response.json({ result: 1 });
        }
        return Response.json({ result: 0 });
      }
      if (action === 'INCR') {
        const next = Number(counters.get(key) ?? 0) + 1;
        counters.set(key, String(next));
        return Response.json({ result: next });
      }
      throw new Error('Unexpected Redis command ' + action);
    }

    if (url.startsWith('https://api.counterapi.dev/v2/')) {
      calls.push(['COUNTERAPI', url]);
      return Response.json(oldResponse(), { status: counterApiStatus });
    }
    throw new Error('Unexpected URL ' + url);
  };
  return {
    fetchImpl, calls, counters,
    setOldCount: (n) => { oldCount = n; },
    setOldStatus: (n) => { counterApiStatus = n; },
    setOldResponse: (fn) => { oldResponse = fn; },
  };
}

test('stable slug formatting matches existing counter keys', () => {
  assert.equal(normalizeSlug('/HowIGetMyAzureCert/'), 'howigetmyazurecert');
  assert.equal(normalizeSlug('/'), 'post-');
  assert.equal(counterKey('/mcp/'), 'luisiitodev:views:v1:mcp');
});

test('Redis returns zero for new articles and persists the count for later reads', async () => {
  const mock = mockProviders();
  const base = { env: upstashEnv, fetchImpl: mock.fetchImpl, slug: 'mcp' };
  assert.deepEqual(await getOrIncrementCounter(base), { count: 0 });
  assert.deepEqual(await getOrIncrementCounter({ ...base, increment: true }), { count: 1 });
  assert.deepEqual(await getOrIncrementCounter(base), { count: 1 });
  assert.equal(mock.counters.get(counterKey('mcp')), '1');
});

test('Redis INCR handles concurrent visitors without read-modify-write losses', async () => {
  const mock = mockProviders();
  const args = { env: upstashEnv, fetchImpl: mock.fetchImpl, slug: 'mcp', increment: true };
  const results = await Promise.all(Array.from({ length: 12 }, () => getOrIncrementCounter(args)));
  assert.equal(Math.max(...results.map((v) => v.count)), 12);
  assert.equal(mock.counters.get(counterKey('mcp')), '12');
  assert.equal(mock.calls.filter((x) => x[0] === 'INCR').length, 12);
});

test('opt-in migration seeds existing CounterAPI count once and then increments', async () => {
  const mock = mockProviders();
  const env = {
    ...upstashEnv, COUNTER_MIGRATE_FROM_COUNTERAPI: 'true',
    COUNTER_API_WORKSPACE: 'test-workspace', COUNTER_API_TOKEN: 'test-token',
  };
  const base = { env, fetchImpl: mock.fetchImpl, slug: 'mcp' };
  assert.equal((await getOrIncrementCounter(base)).count, 23);
  assert.equal((await getOrIncrementCounter({ ...base, increment: true })).count, 24);
  mock.setOldCount(90);
  assert.equal((await getOrIncrementCounter(base)).count, 24);
  assert.equal(mock.calls.filter((c) => c[0] === 'COUNTERAPI').length, 1);
});

test('migration never overwrites an already-initialized Redis total', async () => {
  const key = counterKey('mcp');
  const mock = mockProviders({ [key]: '120' });
  const env = {
    ...upstashEnv, COUNTER_MIGRATE_FROM_COUNTERAPI: 'true',
    COUNTER_API_WORKSPACE: 'old', COUNTER_API_TOKEN: 'old',
  };
  assert.equal((await getOrIncrementCounter({ env, fetchImpl: mock.fetchImpl, slug: 'mcp' })).count, 120);
  assert.ok(!mock.calls.some((c) => c[0] === 'COUNTERAPI'));
});

test('backend errors never become a fabricated zero or overwritten migration', async () => {
  const mock = mockProviders();
  mock.setOldStatus(500);
  const env = {
    ...upstashEnv, COUNTER_MIGRATE_FROM_COUNTERAPI: 'true',
    COUNTER_API_WORKSPACE: 'old', COUNTER_API_TOKEN: 'old',
  };
  await assert.rejects(
    () => getOrIncrementCounter({ env, fetchImpl: mock.fetchImpl, slug: 'mcp', increment: true }),
    /CounterAPI returned HTTP 500/,
  );
  assert.equal(mock.counters.has(counterKey('mcp')), false);
});

test('legacy CounterAPI stays operational until Upstash is configured', async () => {
  const mock = mockProviders();
  const env = { COUNTER_API_WORKSPACE: 'legacy', COUNTER_API_TOKEN: 'legacy-token' };
  assert.deepEqual(await getOrIncrementCounter({
    slug: 'mcp', env, fetchImpl: mock.fetchImpl, increment: true,
  }), { count: 23 });
  assert.ok(mock.calls.some((c) => c[1].endsWith('/mcp/up')));
});

test('invalid CounterAPI data cannot silently reset the displayed total', async () => {
  const mock = mockProviders();
  mock.setOldResponse(() => ({ data: {} }));
  await assert.rejects(
    () => getOrIncrementCounter({
      slug: 'mcp', env: { COUNTER_API_WORKSPACE: 'old', COUNTER_API_TOKEN: 'old' },
      fetchImpl: mock.fetchImpl,
    }),
    /missing or invalid counter value/,
  );
});

test('incomplete Upstash configuration fails instead of switching stores', async () => {
  await assert.rejects(
    () => getOrIncrementCounter({
      slug: 'mcp', env: { UPSTASH_REDIS_REST_URL: upstashEnv.UPSTASH_REDIS_REST_URL },
    }),
    /Upstash configuration is incomplete/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('a realtime change during an in-flight refresh is fetched immediately afterwards', async () => {
  const initial = { revision: 1, phase: 'lobby' };
  const newer = { revision: 2, phase: 'open' };
  let resolveOld;
  const oldRequest = new Promise(resolve => { resolveOld = resolve; });
  let stateRequests = 0;
  let notification;
  const channel = {
    on(_kind, _filter, callback) { notification = callback; return this; },
    subscribe() { return this; },
  };
  const supabase = {
    rpc() {
      stateRequests++;
      if (stateRequests === 1) return Promise.resolve({ data: initial });
      if (stateRequests === 2) return oldRequest;
      return Promise.resolve({ data: newer });
    },
    channel() { return channel; },
    removeChannel() {},
  };
  const storage = new Map([['vnr202-session', JSON.stringify({ token: 'saved-token', role: 'group', groupId: 1 })]]);
  const observed = [];
  const context = vm.createContext({
    createClient: () => supabase,
    __env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key' },
    sessionStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
    location: { search: '' }, URLSearchParams,
    document: { addEventListener() {} },
    window: { setInterval: () => 1 }, clearInterval() {},
  });
  const source = (await readFile(new URL('../src/buzzer/client.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/m, '')
    .replace('export function createBuzzerClient', 'function createBuzzerClient')
    .replaceAll('import.meta.env', '__env');
  vm.runInContext(source + '\nthis.factory=createBuzzerClient;', context);
  const client = context.factory(value => observed.push(value), () => {}, () => {});
  assert.equal(await client.resume(), true);
  const refreshing = client.refresh();
  notification();
  resolveOld({ data: initial });
  await refreshing;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stateRequests, 3, 'the pending notification must trigger a second state fetch');
  assert.equal(observed.at(-1).phase, 'open');
  client.stop();
});

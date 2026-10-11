import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoServer } from '../demoServer.js';
import { runScenario } from './scenario.js';

test('in-browser server passes the full scenario', async () => {
  const events = [];
  const server = createDemoServer({ onEvent: (e) => events.push(e.event) });
  await runScenario((method, path, opts = {}) => server.request(method, path, opts));
  assert.ok(events.includes('order:new'));
  assert.ok(events.includes('order:update'));
  assert.ok(events.includes('notification'));
});

test('data persists in storage and reset restores the sample', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const a = createDemoServer({ storage });
  const { body } = await a.request('POST', '/auth/login', { body: { email: 'admin@foodshop.example', password: 'Admin@123' } });
  await a.request('POST', '/admin/categories', { token: body.token, body: { name: 'Persisted' } });
  const b = createDemoServer({ storage });
  assert.ok((await b.request('GET', '/menu')).body.categories.some((c) => c.name === 'Persisted'));
  await b.reset();
  assert.ok(!(await b.request('GET', '/menu')).body.categories.some((c) => c.name === 'Persisted'));
});

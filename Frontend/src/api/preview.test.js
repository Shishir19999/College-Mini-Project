import { describe, expect, it } from 'vitest';
import { createDemoServer } from '../../../shared/demoServer.js';

// The Live preview server (the same code the browser runs) driven the way the UI drives it.
const login = async (s, email, password) => (await s.request('POST', '/auth/login', { body: { email, password } })).body;

describe('Live preview server', () => {
  it('seeds the original menu and coupons', async () => {
    const s = createDemoServer();
    const menu = (await s.request('GET', '/menu')).body;
    expect(menu.dishes).toHaveLength(15);
    expect(menu.dishes.find((d) => d.slug === 'biryani').price).toBe(50);
    expect((await s.request('GET', '/coupons')).body.map((c) => c.code).sort()).toEqual(['FEAST50', 'FREESHIP', 'WELCOME10']);
  });

  it('quotes totals with delivery and tax rules', async () => {
    const s = createDemoServer();
    const d = (await s.request('GET', '/menu')).body.dishes.find((x) => x.slug === 'pizza');
    const q = (await s.request('POST', '/quote', { body: { items: [{ dish: d._id, qty: 1 }], coupon: 'FREESHIP' } })).body;
    expect(q).toMatchObject({ sub: 100, ship: 0, tax: 5, total: 105, code: 'FREESHIP' });
    const pickup = (await s.request('POST', '/quote', { body: { items: [{ dish: d._id, qty: 1 }], mode: 'pickup' } })).body;
    expect(pickup.ship).toBe(0);
  });

  it('streams order events to staff and the customer while an order moves along', async () => {
    const events = [];
    const s = createDemoServer({ onEvent: (e) => events.push(e) });
    const demo = await login(s, 'demo@example.com', 'Demo@1234');
    const kitchen = await login(s, 'kitchen@foodshop.example', 'Kitchen@123');
    const dish = (await s.request('GET', '/menu')).body.dishes[0];
    const o = (await s.request('POST', '/orders', {
      token: demo.token, body: { items: [{ dish: dish._id, qty: 1 }], mode: 'pickup', pay: 'cod', name: 'Demo', phone: '1234567' },
    })).body;
    expect(events.find((e) => e.event === 'order:new').rooms).toContain('staff');
    await s.request('PATCH', `/orders/${o._id}/status`, { token: kitchen.token, body: { status: 'preparing' } });
    const upd = events.filter((e) => e.event === 'order:update').at(-1);
    expect(upd.rooms).toContain(`user:${demo.user._id}`);
    expect(upd.payload.status).toBe('preparing');
  });

  it('keeps roles apart', async () => {
    const s = createDemoServer();
    const demo = await login(s, 'demo@example.com', 'Demo@1234');
    expect((await s.request('GET', '/admin/users', { token: demo.token })).status).toBe(403);
    expect((await s.request('GET', '/orders')).status).toBe(401);
    expect((await s.request('GET', '/orders', { token: 'demo.bad.0' })).status).toBe(401);
  });
});

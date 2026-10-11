// Behaviour checks shared by the preview tests and the API tests. `call(method, path, { body, query, token })`
// resolves to { status, body } whether it hits the in-process server or real HTTP.
import assert from 'node:assert/strict';

export async function runScenario(call) {
  const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } }));
  const as = async (email, password) => {
    const r = await login(email, password);
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  };

  // public menu
  const menu = await call('GET', '/menu');
  assert.equal(menu.status, 200);
  assert.equal(menu.body.dishes.length, 15);
  assert.equal(menu.body.categories.length, 4);
  const dish = (slug) => menu.body.dishes.find((d) => d.slug === slug);
  const coupons = (await call('GET', '/coupons')).body.map((c) => c.code).sort();
  assert.deepEqual(coupons, ['FEAST50', 'FREESHIP', 'WELCOME10']);

  // auth
  assert.equal((await login('demo@example.com', 'wrong')).status, 401);
  assert.equal((await call('GET', '/orders')).status, 401);
  assert.equal((await call('POST', '/auth/register', { body: { name: 'X', email: 'x@y.zz', password: 'weak' } })).status, 400);
  const reg = await call('POST', '/auth/register', { body: { name: 'New Person', email: 'new@example.com', password: 'Newpass1' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.role, 'customer');
  assert.equal(reg.body.user.password, undefined);
  assert.equal((await call('POST', '/auth/register', { body: { name: 'New Person', email: 'new@example.com', password: 'Newpass1' } })).status, 409);

  const demo = await as('demo@example.com', 'Demo@1234');
  const kitchen = await as('kitchen@foodshop.example', 'Kitchen@123');
  const admin = await as('admin@foodshop.example', 'Admin@123');

  // quote and coupons
  const q = await call('POST', '/quote', { body: { items: [{ dish: dish('pizza')._id, qty: 2 }], coupon: 'welcome10' } });
  assert.equal(q.body.sub, 200);
  assert.equal(q.body.disc, 20);
  assert.equal(q.body.code, 'WELCOME10');
  assert.match((await call('POST', '/quote', { body: { items: [{ dish: dish('pizza')._id, qty: 1 }], coupon: 'NOPE' } })).body.msg, /not valid/);
  assert.equal((await call('POST', '/quote', { body: { items: [{ dish: dish('pizza')._id, qty: 99 }] } })).status, 400);

  // roles
  assert.equal((await call('GET', '/admin/reports', { token: demo })).status, 403);
  assert.equal((await call('GET', '/kitchen/orders', { token: demo })).status, 403);
  assert.equal((await call('GET', '/admin/users', { token: kitchen })).status, 403);
  assert.equal((await call('POST', '/orders', { token: kitchen, body: {} })).status, 403);

  // place an order and walk it through the kitchen
  const order = await call('POST', '/orders', {
    token: demo, body: { items: [{ dish: dish('biryani')._id, qty: 2 }, { dish: dish('tea')._id, qty: 1 }], mode: 'delivery', pay: 'upi', name: 'Demo User', phone: '+00 000 000 0000', address: '12 Sample Street, Sample City - 400001', coupon: 'WELCOME10' },
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.status, 'placed');
  assert.equal(order.body.sub, 110);
  assert.equal(order.body.disc, 11);
  assert.equal(order.body.ship, 30);
  assert.match(order.body.code, /^FS-\d+$/);
  const id = order.body._id;

  assert.ok((await call('GET', '/kitchen/orders', { token: kitchen })).body.active.some((o) => o._id === id));
  assert.equal((await call('PATCH', `/orders/${id}/status`, { token: kitchen, body: { status: 'ready' } })).status, 409);
  assert.equal((await call('PATCH', `/orders/${id}/status`, { token: demo, body: { status: 'preparing' } })).status, 403);
  for (const s of ['preparing', 'ready', 'delivered']) {
    const r = await call('PATCH', `/orders/${id}/status`, { token: kitchen, body: { status: s } });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, s);
  }
  const done = (await call('GET', `/orders/${id}`, { token: demo })).body;
  assert.deepEqual(done.history.map((h) => h.status), ['placed', 'preparing', 'ready', 'delivered']);
  assert.equal((await call('POST', `/orders/${id}/cancel`, { token: demo })).status, 409);
  const notes = (await call('GET', '/notifications', { token: demo })).body;
  assert.ok(notes.some((n) => n.title === 'Delivered'));
  // another customer cannot read it
  const student = await as('student@example.com', 'Student@123');
  assert.equal((await call('GET', `/orders/${id}`, { token: student })).status, 404);

  // customer cancel while placed
  const o2 = (await call('POST', '/orders', { token: student, body: { items: [{ dish: dish('coffee')._id, qty: 1 }], mode: 'pickup', pay: 'cod', name: 'Student', phone: '1234567' } })).body;
  assert.equal((await call('POST', `/orders/${o2._id}/cancel`, { token: student })).body.status, 'cancelled');

  // pickup slot capacity
  const date = '2099-01-01';
  const slots = (await call('GET', '/slots', { query: { date, kind: 'pickup' } })).body.slots;
  assert.equal(slots[0].time, '09:00');
  for (let i = 0; i < 6; i++) {
    const r = await call('POST', '/orders', { token: student, body: { items: [{ dish: dish('tea')._id, qty: 1 }], mode: 'pickup', pay: 'cod', name: 'Student', phone: '1234567', slotDate: date, slotTime: '10:00' } });
    assert.equal(r.status, 201);
  }
  assert.equal((await call('POST', '/orders', { token: student, body: { items: [{ dish: dish('tea')._id, qty: 1 }], mode: 'pickup', pay: 'cod', name: 'Student', phone: '1234567', slotDate: date, slotTime: '10:00' } })).status, 409);

  // reviews need a delivered order
  assert.equal((await call('POST', `/dishes/${dish('biryani')._id}/reviews`, { token: demo, body: { rating: 5, comment: 'Great' } })).status, 200);
  assert.equal((await call('POST', `/dishes/${dish('green')._id}/reviews`, { token: demo, body: { rating: 0 } })).status, 400);
  const reviews = (await call('GET', `/dishes/${dish('biryani')._id}/reviews`)).body;
  assert.equal(reviews.filter((r) => r.user === done.user).length, 1);

  // favorites and addresses
  const fav = await call('POST', `/favorites/${dish('pizza')._id}/toggle`, { token: demo });
  assert.equal(typeof fav.body.saved, 'boolean');
  const addr = await call('POST', '/addresses', { token: demo, body: { label: 'Work', line: '1 Office Road, Floor 2', city: 'Sample City', pin: '400002' } });
  assert.equal(addr.status, 200);
  assert.equal((await call('POST', '/addresses', { token: demo, body: { line: 'x', city: 'c', pin: '12' } })).status, 400);

  // table booking
  const bk = await call('POST', '/bookings', { token: demo, body: { date, time: '19:00', guests: 4, name: 'Demo User', phone: '1234567' } });
  assert.equal(bk.status, 201);
  assert.equal((await call('POST', '/bookings', { token: demo, body: { date, time: '19:00', guests: 40, name: 'D', phone: '1234567' } })).status, 400);

  // contact form and admin inbox
  assert.equal((await call('POST', '/contact', { body: { name: 'Pat', email: 'pat@example.com', message: 'Hello there, do you cater?' } })).status, 201);
  assert.equal((await call('POST', '/contact', { body: { name: 'Pat', email: 'bad', message: 'short' } })).status, 400);
  const inbox = (await call('GET', '/admin/messages', { token: admin })).body;
  assert.equal(inbox[0].name, 'Pat');

  // admin menu CRUD, category and coupon management
  const cat = (await call('POST', '/admin/categories', { token: admin, body: { name: 'Specials' } })).body;
  const nd = await call('POST', '/admin/dishes', { token: admin, body: { name: 'Test Dish', categoryId: cat._id, price: 60, veg: true, desc: 'x', image: 'data:image/png;base64,iVBORw0KGgo=' } });
  assert.equal(nd.status, 201);
  assert.equal((await call('POST', '/admin/dishes', { token: demo, body: {} })).status, 403);
  assert.equal((await call('DELETE', `/admin/categories/${cat._id}`, { token: admin })).status, 409);
  assert.equal((await call('PUT', `/admin/dishes/${nd.body._id}`, { token: admin, body: { name: 'Test Dish 2', categoryId: cat._id, price: 65, available: false } })).body.available, false);
  assert.match((await call('POST', '/quote', { body: { items: [{ dish: nd.body._id, qty: 1 }] } })).body.error, /sold out/);
  assert.equal((await call('DELETE', `/admin/dishes/${nd.body._id}`, { token: admin })).status, 200);
  assert.equal((await call('DELETE', `/admin/categories/${cat._id}`, { token: admin })).status, 200);
  const cp = await call('POST', '/admin/coupons', { token: admin, body: { code: 'save5', kind: 'flat', value: 5 } });
  assert.equal(cp.body.code, 'SAVE5');
  assert.equal((await call('POST', '/admin/coupons', { token: admin, body: { code: 'SAVE5', kind: 'flat', value: 5 } })).status, 409);
  assert.equal((await call('POST', '/admin/coupons', { token: admin, body: { code: 'BAD', kind: 'percent', value: 500 } })).status, 400);
  assert.equal((await call('DELETE', `/admin/coupons/${cp.body._id}`, { token: admin })).status, 200);

  // reports and users
  const rep = (await call('GET', '/admin/reports', { token: admin })).body;
  assert.ok(rep.totals.orders > 10);
  assert.equal(rep.byDay.length, 14);
  assert.ok(rep.topDishes.length);
  const users = (await call('GET', '/admin/users', { token: admin })).body;
  assert.ok(users.every((u) => u.password === undefined));
  const target = users.find((u) => u.email === 'new@example.com');
  assert.equal((await call('PATCH', `/admin/users/${target._id}`, { token: admin, body: { role: 'kitchen' } })).body.role, 'kitchen');
  assert.equal((await call('PATCH', `/admin/users/${target._id}`, { token: admin, body: { active: false } })).body.active, false);
  assert.equal((await login('new@example.com', 'Newpass1')).status, 403);

  // logout revokes the token
  assert.equal((await call('POST', '/auth/logout', { token: student })).status, 200);
  assert.equal((await call('GET', '/orders', { token: student })).status, 401);
}

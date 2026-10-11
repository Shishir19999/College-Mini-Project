// Every API route, written once against the async store interface. The Express server runs it on
// MongoDB (Mongoose); the browser-only Live preview runs the very same code on localStorage.
import { createRegistry, HttpError } from './engine.js';
import { passwordProblem } from './validate.js';
import {
  ACTIVE_STATUSES, ALL_STATUSES, MAX_GUESTS, MAX_QTY, MODES, PAYMENTS, PICKUP_CAPACITY, TABLES_PER_SLOT, dayKey, nextStatus,
  priceOrder, slotTimes, statusLabel, couponLabel, checkCoupon,
} from './rules.js';

const { routes: ROUTES, add } = createRegistry();
export { ROUTES };

const STAFF = ['kitchen', 'admin'];
const ADMIN = ['admin'];
const CUSTOMER = ['customer'];
const DAY = 86400000;
const nf = (what) => new HttpError(404, `${what} not found`);

export const publicUser = (u) => {
  if (!u) return null;
  const { password, tokenVersion, ...rest } = u; // eslint-disable-line no-unused-vars
  return rest;
};

const emit = (ctx, event, payload, rooms) => ctx.helpers.emit?.(event, payload, rooms);

async function notify(ctx, userIds, { title, body, link = '' }) {
  for (const id of new Set(userIds)) {
    const n = await ctx.store.insert('notifications', { user: id, title, body, link, read: false, createdAt: ctx.now.toISOString() });
    emit(ctx, 'notification', n, [`user:${id}`]);
  }
}
const adminIds = async (ctx) => (await ctx.store.find('users', { role: 'admin', active: true })).map((u) => u._id);

async function withRatings(ctx, dishes) {
  const reviews = await ctx.store.find('reviews');
  const agg = {};
  for (const r of reviews) (agg[r.dish] ||= []).push(r.rating);
  return dishes.map((d) => {
    const list = agg[d._id] || [];
    return { ...d, rating: list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : 0, ratings: list.length };
  });
}

async function storeImage(ctx, image) {
  if (!image) return '';
  if (!image.startsWith('data:')) {
    if (image.length > 300 || /[\\<>"']/.test(image)) throw new HttpError(400, 'Image is not valid');
    return image;
  }
  const m = /^data:image\/(png|jpeg|webp|avif|gif);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) throw new HttpError(400, 'Upload a PNG, JPEG, WebP, AVIF or GIF image');
  if (m[2].length > 700000) throw new HttpError(400, 'Image is too large (limit about 500 KB)');
  return ctx.helpers.saveImage ? ctx.helpers.saveImage(image, m[1]) : image;
}

/* ---------------- Auth and account ---------------- */
const login = async (ctx, user) => ({ token: ctx.helpers.signToken(user), user: publicUser(user) });

add('POST', '/auth/register', {
  public: true,
  schema: {
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Name' },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, max: 100, label: 'Password' },
  },
}, async (ctx) => {
  const problem = passwordProblem(ctx.body.password);
  if (problem) throw new HttpError(400, problem);
  if ((await ctx.store.find('users', { email: ctx.body.email })).length) throw new HttpError(409, 'An account with this email already exists.');
  const user = await ctx.store.insert('users', {
    name: ctx.body.name, email: ctx.body.email, role: 'customer', active: true, tokenVersion: 0, phone: '', favorites: [], addresses: [],
    password: await ctx.helpers.hashPassword(ctx.body.password, ctx.body.email),
  });
  return login(ctx, user);
});
ROUTES[ROUTES.length - 1].status = 201;

add('POST', '/auth/login', {
  public: true,
  schema: { email: { type: 'email', required: true, label: 'Email' }, password: { type: 'string', required: true, max: 100, label: 'Password' } },
}, async (ctx) => {
  const user = await ctx.helpers.verifyPassword(ctx.body.email, ctx.body.password);
  if (!user) throw new HttpError(401, 'Incorrect email or password.');
  if (user.active === false) throw new HttpError(403, 'This account has been disabled.');
  return login(ctx, user);
});

add('GET', '/auth/me', {}, async (ctx) => publicUser(await ctx.store.get('users', ctx.user.id)));

add('POST', '/auth/logout', {}, async (ctx) => {
  const u = await ctx.store.get('users', ctx.user.id);
  if (u) await ctx.store.update('users', u._id, { tokenVersion: (u.tokenVersion || 0) + 1 });
  return { ok: true };
});

add('PATCH', '/auth/me', {
  schema: { name: { type: 'string', min: 2, max: 80, label: 'Name' }, phone: { type: 'string', max: 20, pattern: /^[0-9 +()-]{7,20}$/, message: 'Enter a valid phone number', label: 'Phone' } },
}, async (ctx) => publicUser(await ctx.store.update('users', ctx.user.id, ctx.body)));

add('POST', '/auth/password', {
  schema: { current: { type: 'string', required: true, max: 100, label: 'Current password' }, password: { type: 'string', required: true, max: 100, label: 'New password' } },
}, async (ctx) => {
  const me = await ctx.store.get('users', ctx.user.id);
  if (!(await ctx.helpers.verifyPassword(me.email, ctx.body.current))) throw new HttpError(400, 'Current password is incorrect.');
  const problem = passwordProblem(ctx.body.password);
  if (problem) throw new HttpError(400, problem);
  const u = await ctx.store.update('users', me._id, { password: await ctx.helpers.hashPassword(ctx.body.password, me.email), tokenVersion: (me.tokenVersion || 0) + 1 });
  return login(ctx, u);
});

/* Saved addresses and favorites */
add('GET', '/addresses', {}, async (ctx) => (await ctx.store.get('users', ctx.user.id)).addresses || []);
add('POST', '/addresses', {
  roles: CUSTOMER,
  schema: {
    label: { type: 'string', max: 30, default: 'Home', label: 'Label' },
    line: { type: 'string', required: true, min: 8, max: 160, label: 'Address' },
    city: { type: 'string', required: true, max: 60, label: 'City' },
    pin: { type: 'string', required: true, pattern: /^[0-9]{6}$/, message: 'Pincode must be 6 digits', label: 'Pincode' },
    phone: { type: 'string', max: 20, label: 'Phone' },
  },
}, async (ctx) => {
  const me = await ctx.store.get('users', ctx.user.id);
  const list = me.addresses || [];
  if (list.length >= 8) throw new HttpError(400, 'You can save up to 8 addresses');
  list.push({ id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, ...ctx.body });
  await ctx.store.update('users', me._id, { addresses: list });
  return list;
});
add('DELETE', '/addresses/:id', { roles: CUSTOMER }, async (ctx) => {
  const me = await ctx.store.get('users', ctx.user.id);
  const list = (me.addresses || []).filter((a) => a.id !== ctx.params.id);
  await ctx.store.update('users', me._id, { addresses: list });
  return list;
});

add('GET', '/favorites', {}, async (ctx) => (await ctx.store.get('users', ctx.user.id)).favorites || []);
add('POST', '/favorites/:dish/toggle', { roles: CUSTOMER }, async (ctx) => {
  const me = await ctx.store.get('users', ctx.user.id);
  if (!(await ctx.store.get('dishes', ctx.params.dish))) throw nf('Dish');
  const set = new Set(me.favorites || []);
  if (!set.delete(ctx.params.dish)) set.add(ctx.params.dish);
  await ctx.store.update('users', me._id, { favorites: [...set] });
  return { favorites: [...set], saved: set.has(ctx.params.dish) };
});
add('POST', '/favorites/merge', { roles: CUSTOMER, schema: { ids: { type: 'array', max: 100, required: true } } }, async (ctx) => {
  const me = await ctx.store.get('users', ctx.user.id);
  const valid = new Set((await ctx.store.find('dishes')).map((d) => d._id));
  const set = new Set([...(me.favorites || []), ...ctx.body.ids.filter((i) => valid.has(i))]);
  await ctx.store.update('users', me._id, { favorites: [...set] });
  return { favorites: [...set] };
});

/* ---------------- Menu, reviews, coupons ---------------- */
add('GET', '/menu', { public: true }, async (ctx) => {
  const categories = await ctx.store.find('categories', {}, { sort: { order: 1 } });
  const names = Object.fromEntries(categories.map((c) => [c._id, c.name]));
  const dishes = await withRatings(ctx, await ctx.store.find('dishes', {}, { sort: { createdAt: 1 } }));
  return { categories, dishes: dishes.map((d) => ({ ...d, category: names[d.categoryId] || 'Other' })) };
});

add('GET', '/coupons', { public: true }, async (ctx) => {
  const list = await ctx.store.find('coupons', { active: true });
  return list.filter((c) => !c.expiresAt || Date.parse(c.expiresAt) > ctx.now.getTime()).map((c) => ({ code: c.code, label: couponLabel(c), min: c.min }));
});

add('GET', '/dishes/:id/reviews', { public: true }, async (ctx) => ctx.store.find('reviews', { dish: ctx.params.id }, { sort: { createdAt: -1 } }));

add('POST', '/dishes/:id/reviews', {
  roles: CUSTOMER,
  schema: { rating: { type: 'number', required: true, min: 1, max: 5, int: true, label: 'Rating' }, comment: { type: 'string', max: 400, label: 'Comment' } },
}, async (ctx) => {
  if (!(await ctx.store.get('dishes', ctx.params.id))) throw nf('Dish');
  const mine = await ctx.store.find('orders', { user: ctx.user.id, status: 'delivered' });
  if (!mine.some((o) => o.items.some((i) => i.dish === ctx.params.id))) throw new HttpError(403, 'You can review a dish after you have received it.');
  const prev = (await ctx.store.find('reviews', { dish: ctx.params.id, user: ctx.user.id }))[0];
  const data = { rating: ctx.body.rating, comment: ctx.body.comment || '' };
  if (prev) return ctx.store.update('reviews', prev._id, data);
  return ctx.store.insert('reviews', { dish: ctx.params.id, user: ctx.user.id, userName: ctx.user.name, ...data, createdAt: ctx.now.toISOString() });
});

add('DELETE', '/reviews/:id', {}, async (ctx) => {
  const r = await ctx.store.get('reviews', ctx.params.id);
  if (!r) throw nf('Review');
  if (r.user !== ctx.user.id && ctx.user.role !== 'admin') throw new HttpError(403, 'You can only remove your own review');
  await ctx.store.remove('reviews', r._id);
  return { ok: true };
});

/* ---------------- Quote and orders ---------------- */
async function buildLines(ctx, items) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Your cart is empty');
  const lines = [];
  for (const it of items) {
    const qty = Number(it?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, `Quantity must be between 1 and ${MAX_QTY}`);
    const dish = await ctx.store.get('dishes', it.dish);
    if (!dish) throw new HttpError(400, 'A dish in your cart is no longer on the menu');
    if (!dish.available) throw new HttpError(400, `${dish.name} is sold out right now`);
    lines.push({ dish: dish._id, name: dish.name, price: dish.price, qty });
  }
  return lines;
}
const findCoupon = async (ctx, code) => (code ? (await ctx.store.find('coupons', { code: String(code).trim().toUpperCase() }))[0] || null : null);

add('POST', '/quote', { public: true }, async (ctx) => {
  const { items = [], coupon: code = '', mode = 'delivery' } = ctx.body;
  const lines = await buildLines(ctx, items);
  const coupon = await findCoupon(ctx, code);
  if (code && !coupon) return { ...priceOrder({ lines, mode, now: ctx.now }), msg: 'That coupon code is not valid.' };
  return priceOrder({ lines, coupon, mode, now: ctx.now });
});

const SLOT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function slotInfo(ctx, kind, date) {
  const times = slotTimes(date, ctx.now, ctx.tz);
  const taken = {};
  if (kind === 'pickup') {
    for (const o of await ctx.store.find('orders', { mode: 'pickup', slotDate: date, status: { $ne: 'cancelled' } })) taken[o.slotTime] = (taken[o.slotTime] || 0) + 1;
  } else {
    for (const b of await ctx.store.find('bookings', { date, status: { $ne: 'cancelled' } })) taken[b.time] = (taken[b.time] || 0) + 1;
  }
  const cap = kind === 'pickup' ? PICKUP_CAPACITY : TABLES_PER_SLOT;
  return times.map((time) => ({ time, free: Math.max(0, cap - (taken[time] || 0)) }));
}

add('GET', '/slots', { public: true }, async (ctx) => {
  const date = String(ctx.query.date || dayKey(ctx.now, ctx.tz));
  if (!SLOT_DATE.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const kind = ctx.query.kind === 'table' ? 'table' : 'pickup';
  return { date, kind, slots: await slotInfo(ctx, kind, date) };
});

add('POST', '/orders', {
  roles: CUSTOMER,
  schema: {
    items: { type: 'array', required: true, max: 40, label: 'Items' },
    mode: { type: 'string', enum: MODES, default: 'delivery', label: 'Order type' },
    pay: { type: 'string', enum: PAYMENTS, default: 'cod', label: 'Payment method' },
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Name' },
    phone: { type: 'string', required: true, pattern: /^[0-9 +()-]{7,20}$/, message: 'Enter a valid phone number', label: 'Phone' },
    address: { type: 'string', max: 240, label: 'Address' },
    coupon: { type: 'string', max: 30, label: 'Coupon' },
    slotDate: { type: 'string', pattern: SLOT_DATE, label: 'Pickup date' },
    slotTime: { type: 'string', pattern: SLOT_TIME, label: 'Pickup time' },
    note: { type: 'string', max: 200, label: 'Note' },
  },
}, async (ctx) => {
  const b = ctx.body;
  if (b.mode === 'delivery' && (b.address || '').length < 8) throw new HttpError(400, 'Enter your full delivery address');
  const lines = await buildLines(ctx, b.items);
  const coupon = await findCoupon(ctx, b.coupon);
  if (b.coupon && !coupon) throw new HttpError(400, 'That coupon code is not valid.');
  if (coupon) {
    const c = checkCoupon(coupon, priceOrder({ lines, mode: b.mode, now: ctx.now }).sub, ctx.now);
    if (!c.ok) throw new HttpError(400, c.msg);
  }
  let slotDate = '';
  let slotTime = '';
  if (b.mode === 'pickup' && b.slotTime) {
    slotDate = b.slotDate || dayKey(ctx.now, ctx.tz);
    const slot = (await slotInfo(ctx, 'pickup', slotDate)).find((s) => s.time === b.slotTime);
    if (!slot) throw new HttpError(400, 'That pickup time is not available');
    if (!slot.free) throw new HttpError(409, 'That pickup slot is full. Choose another time.');
    slotTime = b.slotTime;
  }
  const totals = priceOrder({ lines, coupon, mode: b.mode, now: ctx.now });
  delete totals.msg;
  const seq = await ctx.store.nextSeq('order');
  const at = ctx.now.toISOString();
  const order = await ctx.store.insert('orders', {
    ...totals, code: `FS-${1000 + seq}`, user: ctx.user.id, userName: ctx.user.name, items: lines, mode: b.mode, pay: b.pay, name: b.name, phone: b.phone,
    address: b.mode === 'pickup' ? 'Pickup at the shop counter' : b.address, slotDate, slotTime, note: b.note || '', coupon: totals.code,
    status: 'placed', history: [{ status: 'placed', at, by: ctx.user.name }], createdAt: at,
  });
  if (coupon && totals.code) await ctx.store.update('coupons', coupon._id, { uses: (coupon.uses || 0) + 1 });
  await notify(ctx, await adminIds(ctx), { title: 'New order', body: `${order.code} from ${order.name}`, link: '/admin/orders' });
  emit(ctx, 'order:new', order, ['staff']);
  return order;
});
ROUTES[ROUTES.length - 1].status = 201;

const canSee = (user, o) => o.user === user.id || STAFF.includes(user.role);

add('GET', '/orders', {}, async (ctx) => ctx.store.find('orders', { user: ctx.user.id }, { sort: { createdAt: -1 } }));

add('GET', '/orders/:id', {}, async (ctx) => {
  const o = await ctx.store.get('orders', ctx.params.id);
  if (!o || !canSee(ctx.user, o)) throw nf('Order');
  return o;
});

add('POST', '/orders/:id/cancel', { roles: CUSTOMER }, async (ctx) => {
  const o = await ctx.store.get('orders', ctx.params.id);
  if (!o || o.user !== ctx.user.id) throw nf('Order');
  if (o.status !== 'placed') throw new HttpError(409, 'The kitchen has already started this order, so it can no longer be cancelled.');
  return changeStatus(ctx, o, 'cancelled');
});

async function changeStatus(ctx, o, status) {
  const history = [...o.history, { status, at: ctx.now.toISOString(), by: ctx.user.name }];
  const updated = await ctx.store.update('orders', o._id, { status, history });
  await notify(ctx, [o.user], { title: statusLabel(status, o.mode), body: `Order ${o.code} is now: ${statusLabel(status, o.mode)}.`, link: `/orders/${o._id}` });
  emit(ctx, 'order:update', updated, ['staff', `user:${o.user}`]);
  return updated;
}

add('PATCH', '/orders/:id/status', {
  roles: STAFF,
  schema: { status: { type: 'string', required: true, enum: ALL_STATUSES, label: 'Status' } },
}, async (ctx) => {
  const o = await ctx.store.get('orders', ctx.params.id);
  if (!o) throw nf('Order');
  const to = ctx.body.status;
  if (o.status === 'delivered' || o.status === 'cancelled') throw new HttpError(409, `This order is already ${o.status}`);
  if (to === 'cancelled') {
    if (ctx.user.role !== 'admin') throw new HttpError(403, 'Only an admin can cancel an order in progress');
  } else if (ctx.user.role === 'kitchen' && to !== nextStatus(o.status)) throw new HttpError(409, `The next step is "${nextStatus(o.status)}"`);
  else if (ctx.user.role === 'admin' && ALL_STATUSES.indexOf(to) <= ALL_STATUSES.indexOf(o.status)) throw new HttpError(409, 'An order can only move forward');
  return changeStatus(ctx, o, to);
});

add('GET', '/kitchen/orders', { roles: STAFF }, async (ctx) => {
  const active = await ctx.store.find('orders', { status: { $in: ACTIVE_STATUSES } }, { sort: { createdAt: 1 } });
  const done = await ctx.store.find('orders', { status: 'delivered' }, { sort: { createdAt: -1 }, limit: 8 });
  return { active, done };
});

/* ---------------- Table bookings ---------------- */
add('GET', '/bookings', {}, async (ctx) => ctx.store.find('bookings', { user: ctx.user.id }, { sort: { date: -1, time: -1 } }));
add('POST', '/bookings', {
  roles: CUSTOMER,
  schema: {
    date: { type: 'string', required: true, pattern: SLOT_DATE, label: 'Date' },
    time: { type: 'string', required: true, pattern: SLOT_TIME, label: 'Time' },
    guests: { type: 'number', required: true, min: 1, max: MAX_GUESTS, int: true, label: 'Guests' },
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Name' },
    phone: { type: 'string', required: true, pattern: /^[0-9 +()-]{7,20}$/, message: 'Enter a valid phone number', label: 'Phone' },
    note: { type: 'string', max: 200, label: 'Note' },
  },
}, async (ctx) => {
  const slot = (await slotInfo(ctx, 'table', ctx.body.date)).find((s) => s.time === ctx.body.time);
  if (!slot) throw new HttpError(400, 'That time is not available');
  if (!slot.free) throw new HttpError(409, 'No tables are free at that time. Choose another slot.');
  const b = await ctx.store.insert('bookings', { ...ctx.body, note: ctx.body.note || '', user: ctx.user.id, userName: ctx.user.name, status: 'confirmed', createdAt: ctx.now.toISOString() });
  await notify(ctx, await adminIds(ctx), { title: 'Table booked', body: `${b.name}, ${b.guests} guests, ${b.date} ${b.time}`, link: '/admin/bookings' });
  return b;
});
ROUTES[ROUTES.length - 1].status = 201;
add('POST', '/bookings/:id/cancel', {}, async (ctx) => {
  const b = await ctx.store.get('bookings', ctx.params.id);
  if (!b || (b.user !== ctx.user.id && ctx.user.role !== 'admin')) throw nf('Booking');
  return ctx.store.update('bookings', b._id, { status: 'cancelled' });
});

/* ---------------- Notifications ---------------- */
add('GET', '/notifications', {}, async (ctx) => ctx.store.find('notifications', { user: ctx.user.id }, { sort: { createdAt: -1 }, limit: 50 }));
add('POST', '/notifications/read', {}, async (ctx) => {
  await ctx.store.updateMany('notifications', { user: ctx.user.id, read: false }, { read: true });
  return { ok: true };
});
add('POST', '/notifications/:id/read', {}, async (ctx) => {
  const n = await ctx.store.get('notifications', ctx.params.id);
  if (!n || n.user !== ctx.user.id) throw nf('Notification');
  return ctx.store.update('notifications', n._id, { read: true });
});

/* ---------------- Contact ---------------- */
add('POST', '/contact', {
  public: true,
  schema: {
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Name' },
    email: { type: 'email', required: true, label: 'Email' },
    message: { type: 'string', required: true, min: 10, max: 500, label: 'Message' },
  },
}, async (ctx) => {
  const m = await ctx.store.insert('messages', { ...ctx.body, read: false, createdAt: ctx.now.toISOString() });
  await notify(ctx, await adminIds(ctx), { title: 'New message', body: `${m.name} sent a message.`, link: '/admin/messages' });
  Promise.resolve(ctx.helpers.sendContactMail?.(m)).catch(() => {});
  return { ok: true };
});
ROUTES[ROUTES.length - 1].status = 201;

/* ---------------- Admin ---------------- */
const dishSchema = {
  name: { type: 'string', required: true, min: 2, max: 80, label: 'Name' },
  categoryId: { type: 'string', required: true, label: 'Category' },
  price: { type: 'number', required: true, min: 1, max: 5000, label: 'Price' },
  veg: { type: 'boolean', default: true, label: 'Veg' },
  desc: { type: 'string', max: 200, label: 'Description' },
  image: { type: 'string', max: 800000, label: 'Image' },
  available: { type: 'boolean', default: true, label: 'Available' },
  featured: { type: 'boolean', default: false, label: 'Featured' },
};
async function dishData(ctx) {
  if (!(await ctx.store.get('categories', ctx.body.categoryId))) throw new HttpError(400, 'Choose a valid category');
  return { ...ctx.body, desc: ctx.body.desc || '', image: await storeImage(ctx, ctx.body.image) };
}
add('POST', '/admin/dishes', { roles: ADMIN, schema: dishSchema }, async (ctx) => ctx.store.insert('dishes', { ...(await dishData(ctx)), createdAt: ctx.now.toISOString() }));
ROUTES[ROUTES.length - 1].status = 201;
add('PUT', '/admin/dishes/:id', { roles: ADMIN, schema: dishSchema }, async (ctx) => {
  if (!(await ctx.store.get('dishes', ctx.params.id))) throw nf('Dish');
  const data = await dishData(ctx);
  if (!ctx.body.image) delete data.image;
  return ctx.store.update('dishes', ctx.params.id, data);
});
add('DELETE', '/admin/dishes/:id', { roles: ADMIN }, async (ctx) => {
  if (!(await ctx.store.remove('dishes', ctx.params.id))) throw nf('Dish');
  await ctx.store.removeMany('reviews', { dish: ctx.params.id });
  return { ok: true };
});

const catSchema = { name: { type: 'string', required: true, min: 2, max: 40, label: 'Name' } };
add('POST', '/admin/categories', { roles: ADMIN, schema: catSchema }, async (ctx) => {
  if ((await ctx.store.find('categories', { name: ctx.body.name })).length) throw new HttpError(409, 'That category already exists');
  return ctx.store.insert('categories', { name: ctx.body.name, order: await ctx.store.count('categories') });
});
ROUTES[ROUTES.length - 1].status = 201;
add('PUT', '/admin/categories/:id', { roles: ADMIN, schema: catSchema }, async (ctx) => {
  const c = await ctx.store.update('categories', ctx.params.id, { name: ctx.body.name });
  if (!c) throw nf('Category');
  return c;
});
add('DELETE', '/admin/categories/:id', { roles: ADMIN }, async (ctx) => {
  if (await ctx.store.count('dishes', { categoryId: ctx.params.id })) throw new HttpError(409, 'Move or delete the dishes in this category first');
  if (!(await ctx.store.remove('categories', ctx.params.id))) throw nf('Category');
  return { ok: true };
});

const couponSchema = {
  code: { type: 'string', required: true, min: 3, max: 20, pattern: /^[A-Za-z0-9]+$/, message: 'Code can only have letters and numbers', label: 'Code' },
  kind: { type: 'string', required: true, enum: ['percent', 'flat', 'freeship'], label: 'Type' },
  value: { type: 'number', min: 0, max: 100000, default: 0, label: 'Value' },
  min: { type: 'number', min: 0, max: 100000, default: 0, label: 'Minimum subtotal' },
  active: { type: 'boolean', default: true, label: 'Active' },
  expiresAt: { type: 'string', max: 30, label: 'Expiry' },
  label: { type: 'string', max: 80, label: 'Label' },
};
function couponData(ctx) {
  const d = { ...ctx.body, code: ctx.body.code.toUpperCase() };
  if (d.kind === 'percent' && (d.value < 1 || d.value > 100)) throw new HttpError(400, 'A percent coupon needs a value from 1 to 100');
  if (d.kind === 'flat' && d.value < 1) throw new HttpError(400, 'A flat coupon needs a value above 0');
  if (d.kind === 'freeship') d.value = 0;
  if (d.expiresAt && Number.isNaN(Date.parse(d.expiresAt))) throw new HttpError(400, 'Expiry is not a valid date');
  d.expiresAt = d.expiresAt || '';
  d.label = d.label || '';
  return d;
}
add('GET', '/admin/coupons', { roles: ADMIN }, async (ctx) => ctx.store.find('coupons', {}, { sort: { code: 1 } }));
add('POST', '/admin/coupons', { roles: ADMIN, schema: couponSchema }, async (ctx) => {
  const d = couponData(ctx);
  if ((await ctx.store.find('coupons', { code: d.code })).length) throw new HttpError(409, 'That code already exists');
  return ctx.store.insert('coupons', { ...d, uses: 0 });
});
ROUTES[ROUTES.length - 1].status = 201;
add('PUT', '/admin/coupons/:id', { roles: ADMIN, schema: couponSchema }, async (ctx) => {
  const d = couponData(ctx);
  const clash = (await ctx.store.find('coupons', { code: d.code })).find((c) => c._id !== ctx.params.id);
  if (clash) throw new HttpError(409, 'That code already exists');
  const c = await ctx.store.update('coupons', ctx.params.id, d);
  if (!c) throw nf('Coupon');
  return c;
});
add('DELETE', '/admin/coupons/:id', { roles: ADMIN }, async (ctx) => {
  if (!(await ctx.store.remove('coupons', ctx.params.id))) throw nf('Coupon');
  return { ok: true };
});

add('GET', '/admin/orders', { roles: ADMIN }, async (ctx) => {
  const filter = {};
  if (ALL_STATUSES.includes(ctx.query.status)) filter.status = ctx.query.status;
  let list = await ctx.store.find('orders', filter, { sort: { createdAt: -1 } });
  const q = String(ctx.query.q || '').trim().toLowerCase();
  if (q) list = list.filter((o) => `${o.code} ${o.name} ${o.userName}`.toLowerCase().includes(q));
  return list.slice(0, 200);
});

add('GET', '/admin/users', { roles: ADMIN }, async (ctx) => (await ctx.store.find('users', {}, { sort: { createdAt: 1 } })).map(publicUser));
add('PATCH', '/admin/users/:id', {
  roles: ADMIN,
  schema: { role: { type: 'string', enum: ['customer', 'kitchen', 'admin'], label: 'Role' }, active: { type: 'boolean', label: 'Active' } },
}, async (ctx) => {
  if (ctx.params.id === ctx.user.id) throw new HttpError(400, 'You cannot change your own role or status');
  const u = await ctx.store.get('users', ctx.params.id);
  if (!u) throw nf('User');
  const patch = { ...ctx.body };
  if (patch.active === false || patch.role) patch.tokenVersion = (u.tokenVersion || 0) + 1;
  return publicUser(await ctx.store.update('users', u._id, patch));
});

add('GET', '/admin/messages', { roles: ADMIN }, async (ctx) => ctx.store.find('messages', {}, { sort: { createdAt: -1 } }));
add('PATCH', '/admin/messages/:id', { roles: ADMIN, schema: { read: { type: 'boolean', required: true } } }, async (ctx) => {
  const m = await ctx.store.update('messages', ctx.params.id, { read: ctx.body.read });
  if (!m) throw nf('Message');
  return m;
});
add('DELETE', '/admin/messages/:id', { roles: ADMIN }, async (ctx) => {
  if (!(await ctx.store.remove('messages', ctx.params.id))) throw nf('Message');
  return { ok: true };
});

add('GET', '/admin/bookings', { roles: ADMIN }, async (ctx) => ctx.store.find('bookings', {}, { sort: { date: -1, time: -1 } }));
add('PATCH', '/admin/bookings/:id', { roles: ADMIN, schema: { status: { type: 'string', required: true, enum: ['confirmed', 'completed', 'cancelled'] } } }, async (ctx) => {
  const b = await ctx.store.update('bookings', ctx.params.id, { status: ctx.body.status });
  if (!b) throw nf('Booking');
  return b;
});

add('GET', '/admin/reports', { roles: ADMIN }, async (ctx) => {
  const days = Math.min(60, Math.max(3, Number(ctx.query.days) || 14));
  const orders = await ctx.store.find('orders');
  const live = orders.filter((o) => o.status !== 'cancelled');
  const sinceKey = dayKey(new Date(ctx.now.getTime() - (days - 1) * DAY), ctx.tz);
  const byDay = {};
  for (let i = days - 1; i >= 0; i--) byDay[dayKey(new Date(ctx.now.getTime() - i * DAY), ctx.tz)] = { orders: 0, revenue: 0 };
  const dishes = {};
  const modes = { delivery: 0, pickup: 0 };
  const coupons = {};
  let revenue = 0;
  for (const o of live) {
    revenue += o.total;
    modes[o.mode] += 1;
    if (o.coupon) coupons[o.coupon] = (coupons[o.coupon] || 0) + 1;
    const k = dayKey(new Date(o.createdAt), ctx.tz);
    if (k >= sinceKey && byDay[k]) { byDay[k].orders += 1; byDay[k].revenue += o.total; }
    for (const it of o.items) { const d = (dishes[it.name] ||= { name: it.name, qty: 0, revenue: 0 }); d.qty += it.qty; d.revenue += it.qty * it.price; }
  }
  const status = Object.fromEntries(ALL_STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  const reviews = await ctx.store.find('reviews');
  return {
    totals: {
      orders: live.length, revenue: Math.round(revenue), avgOrder: live.length ? Math.round(revenue / live.length) : 0,
      customers: await ctx.store.count('users', { role: 'customer' }), unreadMessages: await ctx.store.count('messages', { read: false }),
      avgRating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0, reviews: reviews.length,
    },
    byDay: Object.entries(byDay).map(([day, v]) => ({ day, orders: v.orders, revenue: Math.round(v.revenue) })),
    status, modes, coupons: Object.entries(coupons).map(([code, uses]) => ({ code, uses })),
    topDishes: Object.values(dishes).sort((a, b) => b.qty - a.qty).slice(0, 6),
  };
});


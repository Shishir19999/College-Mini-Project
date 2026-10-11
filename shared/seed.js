// Sample data: the original FoodShop menu plus accounts, coupons, orders, reviews and messages.
// Passwords here are sample-account passwords only; callers hash them before storing.
import { newId } from './memoryStore.js';
import { priceOrder, statusLabel } from './rules.js';

export const SAMPLE_ACCOUNTS = [
  { email: 'admin@foodshop.example', name: 'Shop Admin', role: 'admin', password: 'Admin@123' },
  { email: 'kitchen@foodshop.example', name: 'Kitchen Staff', role: 'kitchen', password: 'Kitchen@123' },
  { email: 'demo@example.com', name: 'Sample Customer', role: 'customer', password: 'Demo@1234' },
  { email: 'student@example.com', name: 'Student', role: 'customer', password: 'Student@123' },
];

export const CATEGORIES = ['Fast Food', 'Desserts', 'Cold Drinks', 'Hot Drinks'];

export const MENU = [
  { slug: 'biryani', name: 'Chicken Biryani', cat: 'Fast Food', price: 50, veg: false, image: 'biryani.jpg', desc: 'Fragrant basmati rice layered with spiced chicken.', featured: true },
  { slug: 'burger', name: 'Crispy Veg Burger', cat: 'Fast Food', price: 40, veg: true, image: 'burger.jpg', desc: 'Crunchy patty, lettuce and house sauce in a sesame bun.', featured: true },
  { slug: 'noodles', name: 'Veg Noodles', cat: 'Fast Food', price: 50, veg: true, image: 'noodles.jpg', desc: 'Wok-tossed noodles with fresh vegetables.' },
  { slug: 'pizza', name: 'Cheese Pizza', cat: 'Fast Food', price: 100, veg: true, image: 'pizza.jpg', desc: 'Hand-stretched base with a generous layer of cheese.', featured: true },
  { slug: 'momos', name: 'Chicken Momos', cat: 'Fast Food', price: 100, veg: false, image: 'momos.jpg', desc: 'Steamed dumplings served with a fiery red chutney.', featured: true },
  { slug: 'chole', name: 'Chole Bhature', cat: 'Fast Food', price: 70, veg: true, image: 'chole.jpg', desc: 'Spiced chickpea curry with puffed fried bread.' },
  { slug: 'pastry', name: 'Chocolate Pastry', cat: 'Desserts', price: 35, veg: true, image: 'pastry.jpg', desc: 'Soft sponge layered with rich chocolate cream.', featured: true },
  { slug: 'coke', name: 'Coca-Cola', cat: 'Cold Drinks', price: 40, veg: true, image: 'coke.jpg', desc: 'Chilled and fizzy, 250 ml.' },
  { slug: 'mirinda', name: 'Mirinda', cat: 'Cold Drinks', price: 30, veg: true, image: 'mirinda.jpg', desc: 'Sparkling orange soda, 250 ml.' },
  { slug: 'dew', name: 'Mountain Dew', cat: 'Cold Drinks', price: 30, veg: true, image: 'mountain-dew.jpg', desc: 'Citrus soda with a bold kick, 250 ml.' },
  { slug: 'thumsup', name: 'Thums Up', cat: 'Cold Drinks', price: 30, veg: true, image: 'thumps.jpg', desc: 'Strong cola taste, 250 ml.' },
  { slug: 'tea', name: 'Masala Tea', cat: 'Hot Drinks', price: 10, veg: true, image: 'tea.jpg', desc: 'Milk tea brewed with ginger and cardamom.' },
  { slug: 'coffee', name: 'Filter Coffee', cat: 'Hot Drinks', price: 20, veg: true, image: 'coffee.jpg', desc: 'Freshly brewed, creamy and strong.', featured: true },
  { slug: 'black', name: 'Black Tea', cat: 'Hot Drinks', price: 5, veg: true, image: 'black.jpg', desc: 'Plain brewed tea, no milk, no sugar.' },
  { slug: 'green', name: 'Green Tea', cat: 'Hot Drinks', price: 15, veg: true, image: 'green.jpg', desc: 'Light and refreshing leaf tea.' },
];

export const COUPONS = [
  { code: 'WELCOME10', kind: 'percent', value: 10, min: 0, label: '10% off your order' },
  { code: 'FEAST50', kind: 'flat', value: 50, min: 250, label: 'Rs 50 off orders above Rs 250' },
  { code: 'FREESHIP', kind: 'freeship', value: 0, min: 0, label: 'Free delivery' },
];

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (t) => new Date(t).toISOString();

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every user gets `password` (plain, sample only); the caller replaces it with a hash.
export function buildDataset({ now = new Date() } = {}) {
  const t0 = now.getTime();
  const rand = rng(20240607);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const users = SAMPLE_ACCOUNTS.map((a) => ({ _id: newId(), ...a, active: true, tokenVersion: 0, phone: '', favorites: [], addresses: [], createdAt: iso(t0 - 30 * DAY) }));
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const demo = byEmail['demo@example.com'];
  demo.phone = '+00 000 000 0000';
  demo.addresses = [{ id: newId(), label: 'Home', line: '12 Sample Street, Block B', city: 'Sample City', pin: '400001', phone: '+00 000 000 0000' }];

  const categories = CATEGORIES.map((name, i) => ({ _id: newId(), name, order: i }));
  const catId = Object.fromEntries(categories.map((c) => [c.name, c._id]));
  const dishes = MENU.map((m) => ({
    _id: newId(), slug: m.slug, name: m.name, categoryId: catId[m.cat], price: m.price, veg: m.veg, image: m.image,
    desc: m.desc, available: true, featured: !!m.featured, createdAt: iso(t0 - 30 * DAY),
  }));
  demo.favorites = [dishes[0]._id, dishes[12]._id];
  const coupons = COUPONS.map((c) => ({ _id: newId(), ...c, active: true, uses: 0 }));
  const couponBy = Object.fromEntries(coupons.map((c) => [c.code, c]));

  const orders = [];
  let seq = 1000;
  const makeOrder = (user, minutesAgo, status, over = {}) => {
    const n = 1 + Math.floor(rand() * 3);
    const chosen = [];
    while (chosen.length < n) { const d = pick(dishes); if (!chosen.includes(d)) chosen.push(d); }
    const items = chosen.map((d) => ({ dish: d._id, name: d.name, price: d.price, qty: 1 + Math.floor(rand() * 3) }));
    const mode = over.mode || (rand() < 0.3 ? 'pickup' : 'delivery');
    const coupon = over.coupon === undefined ? (rand() < 0.3 ? pick(coupons) : null) : over.coupon && couponBy[over.coupon];
    const totals = priceOrder({ lines: items, coupon, mode, now });
    const placed = t0 - minutesAgo * MIN;
    const flow = ['placed', 'preparing', 'ready', 'delivered'].slice(0, ['placed', 'preparing', 'ready', 'delivered'].indexOf(status) + 1);
    const history = flow.map((s, i) => ({ status: s, at: iso(placed + i * 9 * MIN), by: i ? 'Kitchen Staff' : user.name }));
    seq += 1;
    const o = {
      ...totals, _id: newId(), code: `FS-${seq}`, user: user._id, userName: user.name, items, mode, pay: pick(['upi', 'card', 'cod']),
      name: user.name, phone: '+00 000 000 0000', address: mode === 'pickup' ? 'Pickup at the shop counter' : '12 Sample Street, Block B, Sample City - 400001',
      slotDate: '', slotTime: '', note: '', coupon: totals.code, status, history, createdAt: iso(placed), ...over.extra,
    };
    delete o.msg;
    if (o.coupon) couponBy[o.coupon].uses += 1;
    orders.push(o);
    return o;
  };
  // A fortnight of delivered orders (drives the reports), then a few live ones.
  for (let d = 13; d >= 1; d--) {
    const count = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < count; k++) makeOrder(rand() < 0.6 ? demo : byEmail['student@example.com'], d * 24 * 60 - Math.floor(rand() * 600), 'delivered');
  }
  makeOrder(demo, 55, 'delivered', { coupon: 'WELCOME10' });
  makeOrder(demo, 28, 'preparing', { mode: 'delivery', coupon: null });
  makeOrder(byEmail['student@example.com'], 12, 'placed', { mode: 'pickup', coupon: null });
  makeOrder(byEmail['student@example.com'], 40, 'ready', { mode: 'delivery', coupon: null });

  const reviews = [];
  const seen = new Set();
  const texts = ['Tastes great and arrived hot.', 'Good portion for the price.', 'Fresh and well cooked.', 'Would order again.', 'Decent, a little salty for me.', 'Loved it!'];
  for (const o of orders.filter((x) => x.status === 'delivered')) {
    for (const it of o.items) {
      const k = `${o.user}|${it.dish}`;
      if (seen.has(k) || rand() < 0.45) continue;
      seen.add(k);
      reviews.push({ _id: newId(), dish: it.dish, user: o.user, userName: o.userName, rating: 3 + Math.floor(rand() * 3), comment: pick(texts), createdAt: o.createdAt });
    }
  }

  const messages = [
    { _id: newId(), name: 'Meera Joshi', email: 'meera@example.com', message: 'Do you take bulk orders for a college event next month?', read: false, createdAt: iso(t0 - 5 * HOUR) },
    { _id: newId(), name: 'Karan Singh', email: 'karan@example.com', message: 'The biryani was lovely. Please add a paneer option.', read: true, createdAt: iso(t0 - 2 * DAY) },
  ];
  const adminId = byEmail['admin@foodshop.example']._id;
  const live = orders.find((o) => o.status === 'preparing');
  const notifications = [
    { _id: newId(), user: demo._id, title: statusLabel('preparing'), body: `Order ${live.code} is being prepared.`, link: `/orders/${live._id}`, read: false, createdAt: iso(t0 - 20 * MIN) },
    { _id: newId(), user: demo._id, title: 'Welcome to FoodShop', body: 'Use WELCOME10 for 10% off your next order.', link: '/menu', read: true, createdAt: iso(t0 - 5 * DAY) },
    { _id: newId(), user: adminId, title: 'New message', body: 'Meera Joshi sent a message.', link: '/admin/messages', read: false, createdAt: iso(t0 - 5 * HOUR) },
  ];
  const today = new Date(t0).toISOString().slice(0, 10);
  const bookings = [
    { _id: newId(), user: demo._id, userName: demo.name, name: demo.name, phone: demo.phone, date: today, time: '20:00', guests: 3, note: 'Window table if possible', status: 'confirmed', createdAt: iso(t0 - DAY) },
  ];
  return { users, categories, dishes, coupons, orders, reviews, messages, notifications, bookings, counters: { order: seq - 1000 } };
}

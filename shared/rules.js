// Pricing, status flow and slot rules. The API server and the Live preview both use this file.
export const DELIVERY_FEE = 30;
export const FREE_DELIVERY_OVER = 300;
export const TAX_RATE = 0.05;
export const MAX_QTY = 20;

export const STATUSES = ['placed', 'preparing', 'ready', 'delivered'];
export const ACTIVE_STATUSES = ['placed', 'preparing', 'ready'];
export const ALL_STATUSES = [...STATUSES, 'cancelled'];
export const PAYMENTS = ['upi', 'card', 'cod'];
export const MODES = ['delivery', 'pickup'];
export const ROLES = ['customer', 'kitchen', 'admin'];

export const nextStatus = (s) => STATUSES[STATUSES.indexOf(s) + 1] || null;

export function statusLabel(status, mode = 'delivery') {
  if (status === 'ready') return mode === 'pickup' ? 'Ready for pickup' : 'Out for delivery';
  return { placed: 'Order placed', preparing: 'Preparing', delivered: mode === 'pickup' ? 'Picked up' : 'Delivered', cancelled: 'Cancelled' }[status] || status;
}

export const round2 = (n) => Math.round(n * 100) / 100;

export const money = (n) => `Rs ${round2(n).toFixed(Number.isInteger(round2(n)) ? 0 : 2)}`;

// Is the coupon usable for this subtotal? Returns { ok, msg }.
export function checkCoupon(coupon, sub, now = new Date()) {
  if (!coupon || coupon.active === false) return { ok: false, msg: 'That coupon code is not valid.' };
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < now.getTime()) return { ok: false, msg: `${coupon.code} has expired.` };
  if (coupon.min && sub < coupon.min) return { ok: false, msg: `Add Rs ${round2(coupon.min - sub)} more to use ${coupon.code}.` };
  return { ok: true, msg: '' };
}

// lines: [{ price, qty }]; coupon: coupon document or null; mode: delivery | pickup
export function priceOrder({ lines, coupon = null, mode = 'delivery', now = new Date() }) {
  const sub = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  let disc = 0;
  let msg = '';
  let applied = null;
  if (coupon) {
    const c = checkCoupon(coupon, sub, now);
    if (!c.ok) msg = c.msg;
    else {
      applied = coupon;
      if (coupon.kind === 'percent') disc = round2((sub * coupon.value) / 100);
      else if (coupon.kind === 'flat') disc = Math.min(coupon.value, sub);
    }
  }
  const freeShip = applied?.kind === 'freeship';
  const ship = !sub || mode === 'pickup' || sub >= FREE_DELIVERY_OVER || freeShip ? 0 : DELIVERY_FEE;
  const tax = round2((sub - disc) * TAX_RATE);
  return { sub, disc, ship, tax, total: round2(sub - disc + ship + tax), code: applied ? applied.code : null, msg };
}

export const couponLabel = (c) =>
  c.label || (c.kind === 'percent' ? `${c.value}% off your order` : c.kind === 'flat' ? `Rs ${c.value} off${c.min ? ` orders above Rs ${c.min}` : ''}` : 'Free delivery');

// Shop hours and slot capacity (pickup orders and table bookings).
export const OPEN_MIN = 9 * 60;
export const CLOSE_MIN = 22 * 60;
export const SLOT_MINUTES = 30;
export const PICKUP_CAPACITY = 6;
export const TABLES_PER_SLOT = 4;
export const MAX_GUESTS = 10;

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dayKey = (now, tz = 0) => new Date(now.getTime() - tz * 60000).toISOString().slice(0, 10);

// Slot times still bookable on a day. `tz` is the browser's getTimezoneOffset() (minutes).
export function slotTimes(date, now = new Date(), tz = 0) {
  const local = new Date(now.getTime() - tz * 60000);
  const today = local.toISOString().slice(0, 10);
  if (date < today) return [];
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const out = [];
  for (let m = OPEN_MIN; m + SLOT_MINUTES <= CLOSE_MIN; m += SLOT_MINUTES) {
    if (date > today || m >= nowMin + 20) out.push(hhmm(m));
  }
  return out;
}

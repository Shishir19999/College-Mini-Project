import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOrder, checkCoupon, slotTimes, nextStatus, statusLabel, money } from '../rules.js';
import { validate, passwordProblem } from '../validate.js';
import { COUPONS } from '../seed.js';

const c = (code) => COUPONS.find((x) => x.code === code);
const lines = (sub) => [{ price: sub, qty: 1 }];

test('delivery fee, free-delivery threshold and tax', () => {
  assert.deepEqual(priceOrder({ lines: lines(100) }), { sub: 100, disc: 0, ship: 30, tax: 5, total: 135, code: null, msg: '' });
  assert.equal(priceOrder({ lines: lines(300) }).ship, 0);
  assert.equal(priceOrder({ lines: lines(100), mode: 'pickup' }).ship, 0);
  assert.equal(priceOrder({ lines: [] }).total, 0);
});

test('WELCOME10, FEAST50 and FREESHIP keep working', () => {
  const w = priceOrder({ lines: lines(200), coupon: c('WELCOME10') });
  assert.equal(w.disc, 20);
  assert.equal(w.tax, 9);
  assert.equal(w.total, 200 - 20 + 30 + 9);
  const f = priceOrder({ lines: lines(260), coupon: c('FEAST50') });
  assert.equal(f.disc, 50);
  assert.equal(f.ship, 30);
  assert.match(priceOrder({ lines: lines(100), coupon: c('FEAST50') }).msg, /Add Rs 150 more/);
  assert.equal(priceOrder({ lines: lines(100), coupon: c('FREESHIP') }).ship, 0);
});

test('coupon expiry and disabling', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  assert.equal(checkCoupon({ ...c('WELCOME10'), expiresAt: '2029-01-01T00:00:00Z' }, 100, now).ok, false);
  assert.equal(checkCoupon({ ...c('WELCOME10'), active: false }, 100, now).ok, false);
  assert.equal(checkCoupon(null, 100, now).ok, false);
});

test('status flow and labels', () => {
  assert.equal(nextStatus('placed'), 'preparing');
  assert.equal(nextStatus('delivered'), null);
  assert.equal(statusLabel('ready', 'pickup'), 'Ready for pickup');
  assert.equal(statusLabel('ready', 'delivery'), 'Out for delivery');
  assert.equal(money(12.5), 'Rs 12.50');
});

test('slots hide past times today and respect hours', () => {
  const now = new Date('2030-01-01T12:00:00Z');
  const today = slotTimes('2030-01-01', now, 0);
  assert.equal(today[0], '12:30');
  assert.equal(today.at(-1), '21:30');
  assert.equal(slotTimes('2030-01-02', now, 0)[0], '09:00');
  assert.deepEqual(slotTimes('2029-12-31', now, 0), []);
});

test('validator and password rules', () => {
  const r = validate({ name: 'A', email: 'bad' }, { name: { type: 'string', min: 2 }, email: { type: 'email', required: true } });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('longpassword'));
  assert.equal(passwordProblem('Longpass1'), '');
});

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHead } from '../components/Common';
import { Stepper } from '../components/DishCard';
import { imageUrl } from '../api/config';
import { api } from '../api';
import { useAuth, useCart, useToast } from '../context/contexts';
import { useApi, useDocumentTitle, useQuote } from '../hooks';
import { money } from '../lib/format';
import { FREE_DELIVERY_OVER } from '../../../shared/rules.js';

export function SummaryRows({ t, mode = 'delivery' }) {
  return (
    <div>
      <div className="sum-row"><span>Subtotal</span><span>{money(t.sub)}</span></div>
      {t.disc > 0 && <div className="sum-row disc"><span>Coupon {t.code}</span><span>&minus; {money(t.disc)}</span></div>}
      <div className="sum-row"><span>{mode === 'pickup' ? 'Pickup' : 'Delivery'}</span><span>{t.ship ? money(t.ship) : 'Free'}</span></div>
      <div className="sum-row"><span>Tax (5%)</span><span>{money(t.tax)}</span></div>
      <div className="sum-row total"><span>Total</span><span>{money(t.total)}</span></div>
    </div>
  );
}

export default function Cart() {
  useDocumentTitle('Your cart');
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();
  const { lines, quote } = useQuote();
  const coupons = useApi('/coupons');
  const [code, setCode] = useState(cart.coupon);
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setCode(cart.coupon); }, [cart.coupon]);

  const apply = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { cart.setCoupon(''); setNote('Coupon removed.'); setInvalid(false); return; }
    try {
      const q = await api.post('/quote', { items: lines.filter((l) => l.dish.available).map((l) => ({ dish: l.dish._id, qty: l.qty })), coupon: c });
      if (q.code === c) { cart.setCoupon(c); setInvalid(false); setNote(`${c} applied.`); toast(`${c} applied`); }
      else { setInvalid(true); setNote(q.msg || 'That coupon code is not valid.'); toast(q.msg || 'That coupon code is not valid.', 'error'); }
    } catch (er) { setInvalid(true); setNote(er.message); }
  };

  const empty = !lines.length;
  const staff = user && user.role !== 'customer';
  return (
    <div className="container">
      <PageHead title="Your cart" />
      {staff ? <EmptyState title="Staff accounts do not order" action={{ to: '/kitchen', label: 'Open the kitchen' }}>Log in with a customer account to place an order.</EmptyState> : empty ? (
        <EmptyState title="Your cart is empty" action={{ to: '/menu', label: 'Browse the menu' }}>Add something tasty from the menu.</EmptyState>
      ) : (
        <div className="layout2">
          <section className="card" aria-label="Cart items">
            <h2 className="sr-only">Items in your cart</h2>
            {lines.map(({ dish, qty }) => (
              <div className="line" key={dish._id}>
                <img src={imageUrl(dish.image)} alt="" width="72" height="56" />
                <div><h3>{dish.name}</h3><span className="muted">{money(dish.price)} each</span>{!dish.available && <p className="field-error">Sold out right now - remove it to continue.</p>}</div>
                <div className="line-end">
                  <Stepper dish={dish} />
                  <strong>{money(dish.price * qty)}</strong>
                  <button type="button" className="link-btn" onClick={() => { cart.setQty(dish._id, 0); toast('Item removed'); }} aria-label={`Remove ${dish.name} from cart`}>Remove</button>
                </div>
              </div>
            ))}
            <div className="actions" style={{ marginTop: '1rem' }}>
              <Link className="btn btn-ghost btn-sm" to="/menu">Add more items</Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Remove all items from your cart?')) cart.clear(); }}>Empty cart</button>
            </div>
          </section>
          <aside className="card" aria-label="Order summary">
            <h2 style={{ fontSize: '1.25rem' }}>Order summary</h2>
            <form onSubmit={apply} noValidate>
              <label className="label" htmlFor="coupon">Coupon code</label>
              <div className="coupon">
                <input className="input" id="coupon" autoComplete="off" placeholder="WELCOME10" aria-describedby="coupon-msg" aria-invalid={invalid || undefined} value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="btn btn-ghost" type="submit">Apply</button>
              </div>
              <p className="muted" id="coupon-msg" role="status" style={{ fontSize: '.8125rem' }}>
                {note || quote?.msg || (quote?.code ? `${quote.code} applied.` : coupons.data?.length ? `Try ${coupons.data.map((c) => c.code).join(', ')}.` : '')}
              </p>
            </form>
            {quote ? (
              <>
                <SummaryRows t={quote} />
                <p className="muted" style={{ fontSize: '.8125rem', marginTop: '.5rem' }}>
                  {quote.sub < FREE_DELIVERY_OVER ? `Add ${money(FREE_DELIVERY_OVER - quote.sub)} more for free delivery.` : 'You get free delivery.'}
                </p>
              </>
            ) : <p className="muted" role="status">Calculating totals...</p>}
            <Link className="btn btn-block" to="/checkout" aria-disabled={lines.some((l) => !l.dish.available) || undefined}>Checkout</Link>
          </aside>
        </div>
      )}
    </div>
  );
}

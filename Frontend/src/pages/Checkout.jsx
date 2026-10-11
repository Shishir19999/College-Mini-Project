import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Field, PageHead } from '../components/Common';
import SlotPicker from '../components/SlotPicker';
import { SummaryRows } from './Cart';
import { api } from '../api';
import { useAuth, useCart, useToast } from '../context/contexts';
import { useApi, useDocumentTitle, useQuote } from '../hooks';
import { PHONE, dayKeyLocal, fmtDayKey, fmtTime, money } from '../lib/format';

const PAY = { upi: 'UPI', card: 'Credit or debit card', cod: 'Cash on delivery / pay at counter' };

export default function Checkout() {
  useDocumentTitle('Checkout');
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [d, setD] = useState({ mode: 'delivery', name: user?.name || '', phone: user?.phone || '', line: '', city: '', pin: '', save: false, note: '', when: 'asap', slot: { date: dayKeyLocal(0), time: '' } });
  const [p, setP] = useState({ pay: 'upi', upi: '', card: '', exp: '', cvv: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);
  const { lines, quote } = useQuote(d.mode);
  const saved = useApi('/addresses');
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [step, placed]);

  const setField = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setD((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: '' })); };
  const setPay = (k) => (e) => { setP((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: '' })); };

  const validateDetails = () => {
    const e = {};
    if (d.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!PHONE.test(d.phone.trim())) e.phone = d.phone.trim() ? 'Enter a valid phone number.' : 'Enter a phone number.';
    if (d.mode === 'delivery') {
      if (d.line.trim().length < 8) e.line = 'Enter your full delivery address.';
      if (!d.city.trim()) e.city = 'Enter your city.';
      if (!/^[0-9]{6}$/.test(d.pin.trim())) e.pin = 'Enter a 6 digit pincode.';
    } else if (d.when === 'slot' && !d.slot.time) e.slot = 'Choose a pickup time.';
    return e;
  };
  const validatePay = () => {
    const e = {};
    if (p.pay === 'upi' && !/^[\w.-]{2,}@\w{2,}$/.test(p.upi.trim())) e.upi = 'Enter a UPI id like name@bank.';
    if (p.pay === 'card') {
      if (!/^[0-9 ]{13,19}$/.test(p.card) || p.card.replace(/\s/g, '').length < 13) e.card = 'Enter a valid card number.';
      if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(p.exp)) e.exp = 'Use MM/YY.';
      if (!/^[0-9]{3,4}$/.test(p.cvv)) e.cvv = 'Enter the 3 or 4 digit code.';
    }
    return e;
  };
  const focusFirst = (e) => { const k = Object.keys(e)[0]; if (k) setTimeout(() => document.getElementById(`c-${k}`)?.focus(), 0); };
  const next = (e, validate, to) => { e.preventDefault(); const v = validate(); setErr(v); if (Object.keys(v).length) focusFirst(v); else setStep(to); };

  const fillAddress = (a) => setD((x) => ({ ...x, line: a.line, city: a.city, pin: a.pin, phone: a.phone || x.phone }));

  const place = async () => {
    setBusy(true);
    const address = `${d.line.trim()}, ${d.city.trim()} - ${d.pin.trim()}`;
    try {
      const order = await api.post('/orders', {
        items: lines.map((l) => ({ dish: l.dish._id, qty: l.qty })), mode: d.mode, pay: p.pay, name: d.name.trim(), phone: d.phone.trim(),
        address: d.mode === 'delivery' ? address : undefined, coupon: cart.coupon || undefined, note: d.note.trim() || undefined,
        ...(d.mode === 'pickup' && d.when === 'slot' ? { slotDate: d.slot.date, slotTime: d.slot.time } : {}),
      });
      if (d.mode === 'delivery' && d.save && !(saved.data || []).some((a) => a.line === d.line.trim())) {
        await api.post('/addresses', { label: 'Saved', line: d.line.trim(), city: d.city.trim(), pin: d.pin.trim(), phone: d.phone.trim() }).catch(() => {});
      }
      cart.clear();
      setPlaced(order);
    } catch (er) { toast(er.message, 'error'); if (er.status === 409) setStep(1); } finally { setBusy(false); }
  };

  if (user?.role !== 'customer') return <div className="container"><EmptyState title="Log in to check out" action={{ to: '/login', label: 'Log in' }}>Your cart is saved. Log in or create a customer account to place the order.</EmptyState></div>;
  if (placed) {
    return (
      <div className="container"><section className="card success" role="status" style={{ marginTop: '2rem' }}>
        <div className="tick" aria-hidden="true">&#10003;</div>
        <h2 tabIndex={-1} ref={heading}>Order confirmed</h2>
        <p>Thank you! Your order id is <span className="oid">{placed.code}</span></p>
        <p>Total: <strong>{money(placed.total)}</strong><br />
          <span className="muted">{placed.mode === 'pickup' ? (placed.slotTime ? `Pickup ${placed.slotDate} at ${fmtTime(placed.slotTime)}.` : 'Ready for pickup in about 15 minutes.') : 'Estimated delivery in 30 to 40 minutes.'}</span></p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link className="btn" to={`/orders/${placed._id}`}>Track my order</Link>
          <Link className="btn btn-ghost" to="/menu">Order more</Link>
        </div>
      </section></div>
    );
  }
  if (!lines.length) return <div className="container"><EmptyState title="Your cart is empty" action={{ to: '/menu', label: 'Browse the menu' }}>Add items before checking out.</EmptyState></div>;

  const steps = ['Details', 'Payment', 'Review'];
  return (
    <div className="container">
      <PageHead title="Checkout" />
      <ol className="steps">
        {steps.map((s, i) => <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={step > i + 1 ? 'done' : ''}><span>{i + 1}</span>{s}</li>)}
      </ol>
      <div className="layout2">
        <div className="card">
          {step === 1 && (
            <form onSubmit={(e) => next(e, validateDetails, 2)} noValidate>
              <h2 tabIndex={-1} ref={heading}>Your details</h2>
              <fieldset className="plain"><legend className="label">How would you like your order?</legend>
                <label className="radio-card"><input type="radio" name="mode" checked={d.mode === 'delivery'} onChange={() => setD({ ...d, mode: 'delivery' })} /> <span>Home delivery</span></label>
                <label className="radio-card"><input type="radio" name="mode" checked={d.mode === 'pickup'} onChange={() => setD({ ...d, mode: 'pickup' })} /> <span>Pickup from the shop (no delivery fee)</span></label>
              </fieldset>
              <div className="row2">
                <Field label="Full name" error={err.name} id="c-name">{(a) => <input className="input" autoComplete="name" value={d.name} onChange={setField('name')} {...a} />}</Field>
                <Field label="Phone" error={err.phone} id="c-phone">{(a) => <input className="input" type="tel" autoComplete="tel" inputMode="tel" placeholder="+00 000 000 0000" value={d.phone} onChange={setField('phone')} {...a} />}</Field>
              </div>
              {d.mode === 'delivery' ? (
                <>
                  {saved.data?.length > 0 && (
                    <div className="field"><span className="label">Saved addresses</span>
                      <div className="toolbar-row">{saved.data.map((a) => <button key={a.id} type="button" className="chip" onClick={() => fillAddress(a)}>{a.label}: {a.line.slice(0, 24)}</button>)}</div></div>
                  )}
                  <Field label="Address" error={err.line} id="c-line">{(a) => <input className="input" autoComplete="street-address" placeholder="House no, street, area" value={d.line} onChange={setField('line')} {...a} />}</Field>
                  <div className="row2">
                    <Field label="City" error={err.city} id="c-city">{(a) => <input className="input" autoComplete="address-level2" value={d.city} onChange={setField('city')} {...a} />}</Field>
                    <Field label="Pincode" error={err.pin} id="c-pin">{(a) => <input className="input" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={d.pin} onChange={setField('pin')} {...a} />}</Field>
                  </div>
                  <label className="check" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={d.save} onChange={setField('save')} /> Save this address for next time</label>
                </>
              ) : (
                <fieldset className="plain"><legend className="label">Pickup time</legend>
                  <label className="radio-card"><input type="radio" name="when" checked={d.when === 'asap'} onChange={() => setD({ ...d, when: 'asap' })} /> <span>As soon as possible (about 15 minutes)</span></label>
                  <label className="radio-card"><input type="radio" name="when" checked={d.when === 'slot'} onChange={() => setD({ ...d, when: 'slot' })} /> <span>Choose a pickup slot</span></label>
                  {d.when === 'slot' && <SlotPicker kind="pickup" value={d.slot} onChange={(slot) => { setD({ ...d, slot }); setErr({ ...err, slot: '' }); }} days={3} />}
                  {err.slot && <p className="field-error" id="c-slot" role="alert" tabIndex={-1}>{err.slot}</p>}
                </fieldset>
              )}
              <Field label="Note for the kitchen (optional)" id="c-note">{(a) => <input className="input" maxLength={200} placeholder="Less spicy, no onion..." value={d.note} onChange={setField('note')} {...a} />}</Field>
              <div className="actions"><Link className="btn btn-ghost" to="/cart">Back to cart</Link><button className="btn" type="submit">Continue to payment</button></div>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={(e) => next(e, validatePay, 3)} noValidate>
              <h2 tabIndex={-1} ref={heading}>Payment</h2>
              <p className="muted">Payments are simulated here. No real payment is taken, and card details are never stored or sent.</p>
              <fieldset className="plain"><legend className="label">Payment method</legend>
                {Object.entries(PAY).map(([k, label]) => <label className="radio-card" key={k}><input type="radio" name="pay" checked={p.pay === k} onChange={() => { setP({ ...p, pay: k }); setErr({}); }} /> <span>{label}</span></label>)}
              </fieldset>
              {p.pay === 'upi' && <Field label="UPI id" error={err.upi} id="c-upi">{(a) => <input className="input" placeholder="name@bank" autoComplete="off" value={p.upi} onChange={setPay('upi')} {...a} />}</Field>}
              {p.pay === 'card' && (
                <>
                  <Field label="Card number" error={err.card} id="c-card">{(a) => <input className="input" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={p.card} onChange={(e) => { setP({ ...p, card: e.target.value.replace(/[^0-9]/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() }); setErr({ ...err, card: '' }); }} {...a} />}</Field>
                  <div className="row2">
                    <Field label="Expiry" error={err.exp} id="c-exp">{(a) => <input className="input" placeholder="MM/YY" inputMode="numeric" autoComplete="off" value={p.exp} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); setP({ ...p, exp: v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v }); setErr({ ...err, exp: '' }); }} {...a} />}</Field>
                    <Field label="CVV" error={err.cvv} id="c-cvv">{(a) => <input className="input" inputMode="numeric" maxLength={4} autoComplete="off" value={p.cvv} onChange={setPay('cvv')} {...a} />}</Field>
                  </div>
                </>
              )}
              {p.pay === 'cod' && <p className="alert">Pay the exact amount when the order arrives or when you collect it.</p>}
              <div className="actions"><button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>Back</button><button className="btn" type="submit">Review order</button></div>
            </form>
          )}
          {step === 3 && (
            <section>
              <h2 tabIndex={-1} ref={heading}>Review and place order</h2>
              <p><strong>{d.name}</strong> &middot; {d.phone}<br />
                {d.mode === 'pickup' ? `Pickup at the shop counter${d.when === 'slot' ? `, ${fmtDayKey(d.slot.date)} at ${fmtTime(d.slot.time)}` : ' as soon as possible'}` : `${d.line}, ${d.city} - ${d.pin}`}</p>
              {d.note && <p className="muted">Note: {d.note}</p>}
              <p className="muted">Payment: {PAY[p.pay]}</p>
              {quote && <SummaryRows t={quote} mode={d.mode} />}
              <div className="actions"><button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>Back</button><button className="btn" type="button" onClick={place} disabled={busy || !quote}>{busy ? 'Placing order...' : 'Place order'}</button></div>
            </section>
          )}
        </div>
        <aside className="card" aria-label="Order summary">
          <h2 style={{ fontSize: '1.25rem' }}>Your order</h2>
          {lines.map((l) => <div className="sum-row" key={l.dish._id}><span>{l.qty} &times; {l.dish.name}</span><span>{money(l.qty * l.dish.price)}</span></div>)}
          {quote && <SummaryRows t={quote} mode={d.mode} />}
        </aside>
      </div>
    </div>
  );
}

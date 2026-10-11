import { useState } from 'react';
import { ErrorState, Field, Loading, PageHead } from '../components/Common';
import SlotPicker from '../components/SlotPicker';
import { api } from '../api';
import { useAuth, useToast } from '../context/contexts';
import { useApi, useDocumentTitle } from '../hooks';
import { PHONE, dayKeyLocal, fmtDayKey, fmtTime } from '../lib/format';
import { MAX_GUESTS } from '../../../shared/rules.js';

export default function Book() {
  useDocumentTitle('Book a table');
  const { user } = useAuth();
  const toast = useToast();
  const mine = useApi('/bookings');
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '', guests: 2, note: '', slot: { date: dayKeyLocal(0), time: '' } });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [key, setKey] = useState(0);

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Enter your name.';
    if (!PHONE.test(f.phone.trim())) v.phone = 'Enter a valid phone number.';
    if (!f.slot.time) v.time = 'Choose a time.';
    setErr(v);
    const first = Object.keys(v)[0];
    if (first) { document.getElementById(`b-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      const b = await api.post('/bookings', { date: f.slot.date, time: f.slot.time, guests: Number(f.guests), name: f.name.trim(), phone: f.phone.trim(), note: f.note.trim() || undefined });
      setDone(b);
      mine.reload();
      setF({ ...f, slot: { ...f.slot, time: '' } });
      setKey((k) => k + 1);
    } catch (er) { toast(er.message, 'error'); setKey((k) => k + 1); } finally { setBusy(false); }
  };
  const cancel = async (b) => {
    try { await api.post(`/bookings/${b._id}/cancel`); toast('Booking cancelled'); mine.reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="container">
      <PageHead title="Book a table">Reserve a table in our dining room. Open every day, 9:00 to 22:00.</PageHead>
        <div className="layout2">
          <form className="card" onSubmit={submit} noValidate>
            {done && <p className="alert success" role="status">Table booked for {done.guests} on {fmtDayKey(done.date)} at {fmtTime(done.time)}.</p>}
            <div className="row2">
              <Field label="Name" error={err.name} id="b-name">{(a) => <input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} {...a} />}</Field>
              <Field label="Phone" error={err.phone} id="b-phone">{(a) => <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} {...a} />}</Field>
            </div>
            <Field label="Guests" id="b-guests">{(a) => (
              <select className="input" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} {...a}>
                {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
              </select>
            )}</Field>
            <SlotPicker key={key} kind="table" value={f.slot} onChange={(slot) => { setF({ ...f, slot }); setErr({ ...err, time: '' }); }} />
            {err.time && <p className="field-error" id="b-time" tabIndex={-1} role="alert">{err.time}</p>}
            <Field label="Note (optional)" id="b-note">{(a) => <input className="input" maxLength={200} placeholder="Birthday, high chair..." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} {...a} />}</Field>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Booking...' : 'Book table'}</button>
          </form>
          <aside className="card" aria-labelledby="mb-h">
            <h2 id="mb-h" style={{ fontSize: '1.25rem' }}>Your bookings</h2>
            {mine.loading ? <Loading label="Loading" /> : mine.error ? <ErrorState message={mine.error} onRetry={mine.reload} /> : !mine.data.length ? <p className="muted">No bookings yet.</p> : (
              <ul className="plain-list">
                {mine.data.map((b) => (
                  <li key={b._id} className="booking-row">
                    <div><strong>{fmtDayKey(b.date)}, {fmtTime(b.time)}</strong><br /><span className="muted">{b.guests} guests</span> <span className={`status s-${b.status}`}>{b.status}</span></div>
                    {b.status === 'confirmed' && <button type="button" className="link-btn" onClick={() => cancel(b)}>Cancel<span className="sr-only"> booking on {b.date} at {b.time}</span></button>}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
    </div>
  );
}

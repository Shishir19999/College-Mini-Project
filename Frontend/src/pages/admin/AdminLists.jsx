import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Field, Loading, Modal, PageHead, StatusBadge } from '../../components/Common';
import { api } from '../../api';
import { useAuth, useLive, useToast } from '../../context/contexts';
import { useApi, useDebounced, useDocumentTitle } from '../../hooks';
import { ago, fmtDate, fmtDateTime, fmtDayKey, fmtTime, money } from '../../lib/format';
import { ALL_STATUSES, couponLabel, nextStatus, statusLabel } from '../../../../shared/rules.js';

export function AdminOrders() {
  useDocumentTitle('All orders');
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading, error, reload, setData } = useApi('/admin/orders', { status, q: dq });
  const onUpdate = useCallback((o) => setData((l) => (l ? l.map((x) => (x._id === o._id ? o : x)) : l)), [setData]);
  useLive('order:update', onUpdate);
  useLive('order:new', reload);
  const move = async (o, to) => {
    try { onUpdate(await api.patch(`/orders/${o._id}/status`, { status: to })); toast(`${o.code}: ${statusLabel(to, o.mode)}`); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Orders board">Every order, newest first. Updates arrive live.</PageHead>
      <div className="toolbar-row" style={{ marginBottom: '1rem' }}>
        <div className="search"><label className="sr-only" htmlFor="oq">Search orders</label><input className="input" id="oq" type="search" placeholder="Search by id or name" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: '.9rem' }} /></div>
        <div><label className="sr-only" htmlFor="ost">Filter by status</label>
          <select className="input" id="ost" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>{ALL_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select></div>
      </div>
      {loading && !data ? <Loading label="Loading orders" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.length ? <EmptyState title="No orders match">Try a different search or status.</EmptyState> : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Orders</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Placed</th><th scope="col" className="num">Total</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {data.map((o) => {
                const to = nextStatus(o.status);
                const open = !['delivered', 'cancelled'].includes(o.status);
                return (
                  <tr key={o._id}>
                    <td><Link to={`/orders/${o._id}`}>{o.code}</Link><br /><span className="muted">{o.mode}</span></td>
                    <td>{o.name}</td><td>{fmtDateTime(o.createdAt)}</td><td className="num">{money(o.total)}</td>
                    <td><StatusBadge status={o.status} mode={o.mode} /></td>
                    <td className="actions-cell">
                      {to && <button type="button" className="link-btn" onClick={() => move(o, to)}>{statusLabel(to, o.mode)}<span className="sr-only"> for {o.code}</span></button>}{' '}
                      {open && <button type="button" className="link-btn danger" onClick={() => { if (window.confirm(`Cancel order ${o.code}?`)) move(o, 'cancelled'); }}>Cancel<span className="sr-only"> {o.code}</span></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CouponForm({ coupon, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(coupon ? { ...coupon, value: String(coupon.value), min: String(coupon.min || 0), expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '' } : { code: '', kind: 'percent', value: '10', min: '0', active: true, expiresAt: '', label: '' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!/^[A-Za-z0-9]{3,20}$/.test(f.code.trim())) v.code = 'Use 3 to 20 letters or numbers.';
    if (f.kind === 'percent' && !(Number(f.value) >= 1 && Number(f.value) <= 100)) v.value = 'Enter a percentage from 1 to 100.';
    if (f.kind === 'flat' && !(Number(f.value) >= 1)) v.value = 'Enter an amount above 0.';
    setErr(v);
    const first = Object.keys(v)[0];
    if (first) { document.getElementById(`cp-${first}`)?.focus(); return; }
    const body = { code: f.code.trim(), kind: f.kind, value: Number(f.value) || 0, min: Number(f.min) || 0, active: f.active, expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : undefined, label: f.label.trim() || undefined };
    try {
      if (coupon) await api.put(`/admin/coupons/${coupon._id}`, body); else await api.post('/admin/coupons', body);
      toast('Coupon saved');
      onSaved();
    } catch (er) { toast(er.message, 'error'); }
  };
  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : 'Add a coupon'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Code" error={err.code} id="cp-code">{(p) => <input className="input" value={f.code} onChange={set('code')} {...p} />}</Field>
        <div className="row2">
          <Field label="Type" id="cp-kind">{(p) => <select className="input" value={f.kind} onChange={set('kind')} {...p}><option value="percent">Percent off</option><option value="flat">Flat amount off</option><option value="freeship">Free delivery</option></select>}</Field>
          {f.kind !== 'freeship' && <Field label={f.kind === 'percent' ? 'Percent' : 'Amount (Rs)'} error={err.value} id="cp-value">{(p) => <input className="input" inputMode="decimal" value={f.value} onChange={set('value')} {...p} />}</Field>}
        </div>
        <div className="row2">
          <Field label="Minimum subtotal (Rs)" id="cp-min">{(p) => <input className="input" inputMode="decimal" value={f.min} onChange={set('min')} {...p} />}</Field>
          <Field label="Expires on (optional)" id="cp-exp">{(p) => <input className="input" type="date" value={f.expiresAt} onChange={set('expiresAt')} {...p} />}</Field>
        </div>
        <Field label="Label (optional)" id="cp-label">{(p) => <input className="input" maxLength={80} value={f.label} onChange={set('label')} {...p} />}</Field>
        <label className="check" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Active</label>
        <div className="actions"><button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button><button className="btn" type="submit">Save coupon</button></div>
      </form>
    </Modal>
  );
}

export function AdminCoupons() {
  useDocumentTitle('Coupons');
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/coupons');
  const [editing, setEditing] = useState(null);
  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try { await api.del(`/admin/coupons/${c._id}`); toast('Coupon deleted'); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Coupons" action={<button type="button" className="btn" onClick={() => setEditing('new')}>Add a coupon</button>}>Customers enter these codes in their cart.</PageHead>
      {loading ? <Loading label="Loading coupons" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="table-wrap"><table className="table">
          <caption className="sr-only">Coupons</caption>
          <thead><tr><th scope="col">Code</th><th scope="col">Offer</th><th scope="col">Status</th><th scope="col" className="num">Used</th><th scope="col">Actions</th></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c._id}>
              <td><code>{c.code}</code></td><td>{couponLabel(c)}{c.expiresAt ? ` (until ${fmtDate(c.expiresAt)})` : ''}</td>
              <td>{c.active ? 'Active' : 'Off'}</td><td className="num">{c.uses || 0}</td>
              <td className="actions-cell"><button type="button" className="link-btn" onClick={() => setEditing(c)}>Edit<span className="sr-only"> {c.code}</span></button>{' '}<button type="button" className="link-btn danger" onClick={() => remove(c)}>Delete<span className="sr-only"> {c.code}</span></button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

export function AdminUsers() {
  useDocumentTitle('Users');
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, error, reload, setData } = useApi('/admin/users');
  const patch = async (u, body) => {
    try { const n = await api.patch(`/admin/users/${u._id}`, body); setData((l) => l.map((x) => (x._id === n._id ? n : x))); toast('User updated'); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Users">Change roles or switch accounts off. New sign-ups are customers.</PageHead>
      {loading ? <Loading label="Loading users" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="table-wrap"><table className="table">
          <caption className="sr-only">Users</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th></tr></thead>
          <tbody>{data.map((u) => (
            <tr key={u._id}>
              <td>{u.name}{u._id === me._id ? ' (you)' : ''}</td><td>{u.email}</td>
              <td><label className="sr-only" htmlFor={`role-${u._id}`}>Role for {u.name}</label>
                <select className="input compact" id={`role-${u._id}`} value={u.role} disabled={u._id === me._id} onChange={(e) => patch(u, { role: e.target.value })}>
                  <option value="customer">Customer</option><option value="kitchen">Kitchen staff</option><option value="admin">Admin</option></select></td>
              <td><button type="button" className="link-btn" disabled={u._id === me._id} onClick={() => patch(u, { active: u.active === false })}>{u.active === false ? 'Disabled - enable' : 'Active - disable'}<span className="sr-only"> {u.name}</span></button></td>
            </tr>))}</tbody>
        </table></div>
      )}
    </>
  );
}

export function AdminMessages() {
  useDocumentTitle('Inbox');
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/admin/messages');
  const mark = async (m, read) => { try { const n = await api.patch(`/admin/messages/${m._id}`, { read }); setData((l) => l.map((x) => (x._id === n._id ? n : x))); } catch (e) { toast(e.message, 'error'); } };
  const del = async (m) => { if (!window.confirm('Delete this message?')) return; try { await api.del(`/admin/messages/${m._id}`); setData((l) => l.filter((x) => x._id !== m._id)); toast('Message deleted'); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <PageHead title="Inbox">Messages sent from the contact form.</PageHead>
      {loading ? <Loading label="Loading messages" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.length ? <EmptyState title="No messages yet" /> : (
        <ul className="inbox">{data.map((m) => (
          <li key={m._id} className={`card ${m.read ? '' : 'unread'}`}>
            <div className="row-between"><strong>{m.name} {!m.read && <span className="status s-placed">New</span>}</strong><span className="muted">{ago(m.createdAt)}</span></div>
            <p style={{ margin: '.25rem 0' }}><a href={`mailto:${m.email}`}>{m.email}</a></p>
            <p>{m.message}</p>
            <div className="toolbar-row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => mark(m, !m.read)}>{m.read ? 'Mark as unread' : 'Mark as read'}<span className="sr-only"> from {m.name}</span></button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => del(m)}>Delete<span className="sr-only"> message from {m.name}</span></button></div>
          </li>))}</ul>
      )}
    </>
  );
}

export function AdminBookings() {
  useDocumentTitle('Bookings');
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/admin/bookings');
  const set = async (b, status) => { try { const n = await api.patch(`/admin/bookings/${b._id}`, { status }); setData((l) => l.map((x) => (x._id === n._id ? n : x))); toast('Booking updated'); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <PageHead title="Table bookings">Reservations made from the Book a table page.</PageHead>
      {loading ? <Loading label="Loading bookings" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.length ? <EmptyState title="No bookings yet" /> : (
        <div className="table-wrap"><table className="table">
          <caption className="sr-only">Bookings</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Guest</th><th scope="col" className="num">Party</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{data.map((b) => (
            <tr key={b._id}>
              <td>{fmtDayKey(b.date)}, {fmtTime(b.time)}</td><td>{b.name}<br /><span className="muted">{b.phone}</span></td><td className="num">{b.guests}</td>
              <td><span className={`status s-${b.status}`}>{b.status}</span></td>
              <td className="actions-cell">
                {b.status === 'confirmed' && <><button type="button" className="link-btn" onClick={() => set(b, 'completed')}>Mark seated<span className="sr-only"> {b.name}</span></button>{' '}<button type="button" className="link-btn danger" onClick={() => set(b, 'cancelled')}>Cancel<span className="sr-only"> {b.name}</span></button></>}
              </td>
            </tr>))}</tbody>
        </table></div>
      )}
    </>
  );
}

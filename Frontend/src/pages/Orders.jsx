import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { EmptyState, ErrorState, Loading, PageHead, StatusBadge, Timeline } from '../components/Common';
import { SummaryRows } from './Cart';
import { api } from '../api';
import { useAuth, useCart, useLive, useMenu, useToast } from '../context/contexts';
import { useApi, useDocumentTitle } from '../hooks';
import { fmtDateTime, fmtDayKey, fmtTime, money } from '../lib/format';

function useReorder() {
  const cart = useCart();
  const { byId } = useMenu();
  const toast = useToast();
  const nav = useNavigate();
  return (order) => {
    const list = order.items.filter((i) => byId(i.dish)?.available).map((i) => ({ dish: i.dish, qty: i.qty }));
    if (!list.length) { toast('None of those dishes are available right now.', 'error'); return; }
    cart.addMany(list);
    toast(list.length < order.items.length ? 'Available items added to your cart' : 'Items added to your cart');
    nav('/cart');
  };
}

export function Orders() {
  useDocumentTitle('My orders');
  const { data, loading, error, reload, setData } = useApi('/orders');
  const reorder = useReorder();
  const onUpdate = useCallback((o) => setData((l) => (l ? l.map((x) => (x._id === o._id ? o : x)) : l)), [setData]);
  const onNew = useCallback(() => reload(), [reload]);
  useLive('order:update', onUpdate);
  useLive('order:new', onNew);
  return (
    <div className="container">
      <PageHead title="My orders">Track your orders and order your favorites again.</PageHead>
      {loading ? <Loading label="Loading your orders" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.length ? (
        <EmptyState title="No orders yet" action={{ to: '/menu', label: 'Order something' }}>Your placed orders will show up here.</EmptyState>
      ) : data.map((o) => (
        <article className="card order-card" key={o._id}>
          <div className="order-head"><div><span className="oid">{o.code}</span> <StatusBadge status={o.status} mode={o.mode} /></div><span className="muted">{fmtDateTime(o.createdAt)}</span></div>
          <ul>{o.items.map((i) => <li key={i.dish}>{i.qty} &times; {i.name}</li>)}</ul>
          <div className="order-head"><span className="muted">{o.mode === 'pickup' ? 'Pickup' : 'Delivery'} &middot; {o.address}</span><strong>{money(o.total)}</strong></div>
          <div className="toolbar-row">
            <Link className="btn btn-sm" to={`/orders/${o._id}`}>Track order<span className="sr-only"> {o.code}</span></Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => reorder(o)}>Order again<span className="sr-only"> {o.code}</span></button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const reorder = useReorder();
  const { data: o, loading, error, reload, setData } = useApi(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(o ? `Order ${o.code}` : 'Order');
  const onUpdate = useCallback((u) => { if (u._id === id) setData(u); }, [id, setData]);
  useLive('order:update', onUpdate);
  if (loading) return <Loading label="Loading your order" />;
  if (error) return <div className="container"><ErrorState message={error} onRetry={reload} /></div>;
  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(true);
    try { setData(await api.post(`/orders/${o._id}/cancel`)); toast('Order cancelled'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const mine = o.user === user._id;
  return (
    <div className="container order-detail">
      <PageHead title={`Order ${o.code}`}
        action={<div className="toolbar-row no-print"><button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="print" /> Print receipt</button>{mine && <button type="button" className="btn btn-ghost btn-sm" onClick={() => reorder(o)}>Order again</button>}</div>}>
        Placed {fmtDateTime(o.createdAt)} by {o.userName}
      </PageHead>
      <div className="layout2">
        <section className="card" aria-labelledby="track-h">
          <div className="row-between"><h2 id="track-h" style={{ fontSize: '1.25rem' }}>Order tracking</h2><StatusBadge status={o.status} mode={o.mode} /></div>
          <Timeline order={o} />
          <p className="muted live-note no-print" role="status">
            {o.status === 'delivered' || o.status === 'cancelled' ? '' : 'This page updates by itself as the kitchen moves your order along.'}
          </p>
          {mine && o.status === 'placed' && <button type="button" className="btn btn-ghost no-print" onClick={cancel} disabled={busy}>Cancel order</button>}
          {mine && o.status === 'delivered' && (
            <div className="no-print"><h3>How was it?</h3>
              <ul className="plain-list">{o.items.map((i) => <li key={i.dish}><Link to={`/menu/${i.dish}`}>Rate {i.name}</Link></li>)}</ul></div>
          )}
        </section>
        <aside className="card receipt" aria-label="Receipt">
          <h2 style={{ fontSize: '1.25rem' }}>Receipt</h2>
          <p className="muted" style={{ marginBottom: '.5rem' }}>{o.mode === 'pickup' ? 'Pickup' : 'Delivery'}{o.slotTime ? ` - ${fmtDayKey(o.slotDate)} ${fmtTime(o.slotTime)}` : ''}<br />{o.name} &middot; {o.phone}<br />{o.address}</p>
          {o.items.map((i) => <div className="sum-row" key={i.dish}><span>{i.qty} &times; {i.name}</span><span>{money(i.qty * i.price)}</span></div>)}
          <SummaryRows t={o} mode={o.mode} />
          <p className="muted" style={{ fontSize: '.8125rem', marginTop: '.75rem' }}>Payment: {{ upi: 'UPI', card: 'Card', cod: 'Cash' }[o.pay]}. {o.note && `Note: ${o.note}`}</p>
        </aside>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, Loading, PageHead, StatusBadge } from '../components/Common';
import { api } from '../api';
import { useAuth, useLive, useToast } from '../context/contexts';
import { useApi, useDocumentTitle } from '../hooks';
import { ago, fmtDayKey, fmtTime } from '../lib/format';
import { nextStatus, statusLabel } from '../../../shared/rules.js';

const COLUMNS = [['placed', 'New orders'], ['preparing', 'Preparing'], ['ready', 'Ready']];
const ACTION = { placed: 'Start preparing', preparing: 'Mark ready', ready: 'Mark delivered' };

function OrderTicket({ o, onAdvance, busy, now }) {
  const to = nextStatus(o.status);
  const late = o.status !== 'ready' && now - Date.parse(o.createdAt) > 20 * 60000;
  return (
    <article className={`ticket ${late ? 'late' : ''}`} aria-label={`Order ${o.code}`}>
      <div className="row-between"><strong className="oid">{o.code}</strong><span className="muted">{ago(o.createdAt, now)}</span></div>
      <p className="ticket-meta"><span className={`mode m-${o.mode}`}>{o.mode === 'pickup' ? 'Pickup' : 'Delivery'}</span> {o.name}
        {o.slotTime && <> &middot; {fmtDayKey(o.slotDate)} {fmtTime(o.slotTime)}</>}</p>
      <ul>{o.items.map((i) => <li key={i.dish}><strong>{i.qty} &times;</strong> {i.name}</li>)}</ul>
      {o.note && <p className="ticket-note">Note: {o.note}</p>}
      {to && <button type="button" className="btn btn-sm btn-block" disabled={busy === o._id} onClick={() => onAdvance(o, to)}>{ACTION[o.status]}<span className="sr-only"> for {o.code}</span></button>}
    </article>
  );
}

export default function Kitchen() {
  useDocumentTitle('Kitchen');
  const { live } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/kitchen/orders');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState('');
  const [announce, setAnnounce] = useState('');
  const [status, setStatus] = useState('connected');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => (live ? live.on('status', setStatus) : undefined), [live]);

  const onNew = useCallback((o) => {
    setData((d) => (d && !d.active.some((x) => x._id === o._id) ? { ...d, active: [...d.active, o] } : d));
    setAnnounce(`New order ${o.code} from ${o.name}`);
  }, [setData]);
  const onUpdate = useCallback((o) => setData((d) => {
    if (!d) return d;
    const active = d.active.filter((x) => x._id !== o._id);
    const done = d.done.filter((x) => x._id !== o._id);
    if (['placed', 'preparing', 'ready'].includes(o.status)) return { active: [...active, o].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), done };
    return { active, done: o.status === 'delivered' ? [o, ...done].slice(0, 8) : done };
  }), [setData]);
  useLive('order:new', onNew);
  useLive('order:update', onUpdate);
  useLive('reset', reload);

  const advance = async (o, to) => {
    setBusy(o._id);
    try { onUpdate(await api.patch(`/orders/${o._id}/status`, { status: to })); toast(`${o.code}: ${statusLabel(to, o.mode)}`); } catch (e) { toast(e.message, 'error'); reload(); } finally { setBusy(''); }
  };

  return (
    <div className="container wide-page">
      <PageHead title="Kitchen queue" action={<span className={`live-pill ${status}`}><span aria-hidden="true" />{status === 'connected' ? 'Live' : 'Reconnecting'}</span>}>
        New orders appear here the moment they are placed. Move each ticket along: placed, preparing, ready, delivered.
      </PageHead>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {loading ? <Loading label="Loading the queue" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="board">
            {COLUMNS.map(([s, title]) => {
              const list = data.active.filter((o) => o.status === s);
              return (
                <section key={s} className="column" aria-labelledby={`col-${s}`}>
                  <h2 id={`col-${s}`}>{title} <span className="count">{list.length}</span></h2>
                  {list.length ? list.map((o) => <OrderTicket key={o._id} o={o} now={now} busy={busy} onAdvance={advance} />) : <p className="muted empty">Nothing here.</p>}
                </section>
              );
            })}
          </div>
          <section className="card" style={{ marginTop: '1.5rem' }} aria-labelledby="recent-h">
            <h2 id="recent-h" style={{ fontSize: '1.15rem' }}>Recently completed</h2>
            {data.done.length ? <ul className="plain-list">{data.done.map((o) => <li key={o._id} className="booking-row"><span><Link to={`/orders/${o._id}`}>{o.code}</Link> &middot; {o.name}</span><StatusBadge status={o.status} mode={o.mode} /></li>)}</ul> : <p className="muted">No completed orders yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}

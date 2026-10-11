import { NavLink, Outlet } from 'react-router-dom';
import { BarChart, ErrorState, Loading, PageHead } from '../../components/Common';
import { useApi, useDocumentTitle } from '../../hooks';
import { money } from '../../lib/format';
import { ALL_STATUSES, statusLabel } from '../../../../shared/rules.js';

const TABS = [['/admin', 'Reports', true], ['/admin/menu', 'Menu'], ['/admin/orders', 'Orders'], ['/admin/coupons', 'Coupons'], ['/admin/bookings', 'Bookings'], ['/admin/messages', 'Messages'], ['/admin/users', 'Users']];

export function AdminLayout() {
  return (
    <div className="container wide-page">
      <nav className="subnav" aria-label="Admin sections">
        {TABS.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
      </nav>
      <Outlet />
    </div>
  );
}

const Tile = ({ label, value }) => <div className="card tile"><span className="muted">{label}</span><strong>{value}</strong></div>;

export function Reports() {
  useDocumentTitle('Reports');
  const { data, loading, error, reload } = useApi('/admin/reports', { days: 14 });
  return (
    <>
      <PageHead title="Reports">Sales and activity for the last 14 days.</PageHead>
      {loading ? <Loading label="Loading reports" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="tiles">
            <Tile label="Orders" value={data.totals.orders} />
            <Tile label="Revenue" value={money(data.totals.revenue)} />
            <Tile label="Average order" value={money(data.totals.avgOrder)} />
            <Tile label="Customers" value={data.totals.customers} />
            <Tile label="Average rating" value={data.totals.reviews ? `${data.totals.avgRating} / 5` : '-'} />
            <Tile label="Unread messages" value={data.totals.unreadMessages} />
          </div>
          <div className="layout2 even">
            <section className="card"><h2 style={{ fontSize: '1.15rem' }}>Revenue per day</h2>
              <BarChart data={data.byDay.map((d) => ({ ...d, label: d.day.slice(5) }))} valueKey="revenue" labelKey="label" format={money} title="Revenue per day" /></section>
            <section className="card"><h2 style={{ fontSize: '1.15rem' }}>Orders per day</h2>
              <BarChart data={data.byDay.map((d) => ({ ...d, label: d.day.slice(5) }))} valueKey="orders" labelKey="label" title="Orders per day" /></section>
          </div>
          <div className="layout2 even" style={{ marginTop: '1.5rem' }}>
            <section className="card"><h2 style={{ fontSize: '1.15rem' }}>Top dishes</h2>
              <table className="table"><thead><tr><th scope="col">Dish</th><th scope="col" className="num">Sold</th><th scope="col" className="num">Revenue</th></tr></thead>
                <tbody>{data.topDishes.map((d) => <tr key={d.name}><td>{d.name}</td><td className="num">{d.qty}</td><td className="num">{money(d.revenue)}</td></tr>)}</tbody></table></section>
            <section className="card"><h2 style={{ fontSize: '1.15rem' }}>Orders by status</h2>
              <table className="table"><thead><tr><th scope="col">Status</th><th scope="col" className="num">Orders</th></tr></thead>
                <tbody>{ALL_STATUSES.map((s) => <tr key={s}><td>{statusLabel(s)}</td><td className="num">{data.status[s]}</td></tr>)}
                  <tr><td>Delivery / pickup</td><td className="num">{data.modes.delivery} / {data.modes.pickup}</td></tr>
                  {data.coupons.map((c) => <tr key={c.code}><td>Coupon {c.code}</td><td className="num">{c.uses} uses</td></tr>)}</tbody></table></section>
          </div>
        </>
      )}
    </>
  );
}

import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, Field, Loading, PageHead } from '../components/Common';
import { api } from '../api';
import { useAuth, useToast } from '../context/contexts';
import { useApi, useDocumentTitle } from '../hooks';
import { EMAIL, PHONE, ago } from '../lib/format';
import { passwordProblem } from '../../../shared/validate.js';

const SAMPLES = [
  ['Customer', 'demo@example.com', 'Demo@1234'],
  ['Customer', 'student@example.com', 'Student@123'],
  ['Kitchen staff', 'kitchen@foodshop.example', 'Kitchen@123'],
  ['Admin', 'admin@foodshop.example', 'Admin@123'],
];

function PasswordInput({ id, label, error, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} id={id}>
      {(p) => (
        <div className="pw">
          <input className="input" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} {...p} />
          <button type="button" aria-pressed={show} aria-label={`Show or hide ${label.toLowerCase()}`} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
        </div>
      )}
    </Field>
  );
}

const home = (role) => (role === 'kitchen' ? '/kitchen' : role === 'admin' ? '/admin' : '/menu');

export function Login() {
  useDocumentTitle('Log in');
  const { user, login, register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const [tab, setTab] = useState('login');
  const [l, setL] = useState({ email: '', password: '', remember: true });
  const [r, setR] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from || home(user.role)} replace />;
  const go = (u) => { toast(`Welcome, ${u.name}`); nav(from || home(u.role), { replace: true }); };

  const doLogin = async (e) => {
    e.preventDefault();
    const v = {};
    if (!l.email.trim()) v.email = 'Enter your email address.'; else if (!EMAIL.test(l.email.trim())) v.email = 'Enter a valid email, like you@example.com.';
    if (!l.password) v.password = 'Enter your password.';
    setErr(v); setAlert('');
    const first = Object.keys(v)[0];
    if (first) { document.getElementById(`l-${first}`)?.focus(); return; }
    setBusy(true);
    try { go(await login(l.email.trim().toLowerCase(), l.password, l.remember)); } catch (er) { setAlert(er.message); setBusy(false); }
  };
  const doRegister = async (e) => {
    e.preventDefault();
    const v = {};
    if (r.name.trim().length < 2) v.name = 'Enter your name.';
    if (!EMAIL.test(r.email.trim())) v.email = 'Enter a valid email, like you@example.com.';
    const pw = passwordProblem(r.password);
    if (pw) v.password = pw;
    if (r.confirm !== r.password) v.confirm = 'Passwords do not match.';
    setErr(v); setAlert('');
    const first = Object.keys(v)[0];
    if (first) { document.getElementById(`r-${first}`)?.focus(); return; }
    setBusy(true);
    try { go(await register(r.name.trim(), r.email.trim().toLowerCase(), r.password)); } catch (er) { setAlert(er.message); setBusy(false); }
  };
  const switchTab = (t) => { setTab(t); setErr({}); setAlert(''); };

  return (
    <div className="container">
      <div className="page-head" style={{ textAlign: 'center' }}><h1>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1></div>
      <div className="auth-wrap card">
        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button type="button" className="chip" role="tab" aria-selected={tab === 'login'} onClick={() => switchTab('login')}>Log in</button>
          <button type="button" className="chip" role="tab" aria-selected={tab === 'register'} onClick={() => switchTab('register')}>Register</button>
        </div>
        {alert && <div className="alert error" role="alert">{alert}</div>}
        {tab === 'login' ? (
          <section aria-label="Log in">
            <form onSubmit={doLogin} noValidate>
              <Field label="Email" error={err.email} id="l-email">{(p) => <input className="input" type="email" autoComplete="username" inputMode="email" placeholder="you@example.com" value={l.email} onChange={(e) => setL({ ...l, email: e.target.value })} {...p} />}</Field>
              <PasswordInput id="l-password" label="Password" error={err.password} value={l.password} onChange={(e) => setL({ ...l, password: e.target.value })} autoComplete="current-password" />
              <div className="field"><label className="check"><input type="checkbox" checked={l.remember} onChange={(e) => setL({ ...l, remember: e.target.checked })} /> Remember me on this device</label></div>
              <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
            </form>
            <div className="sample-box">
              <strong>Sample accounts</strong> (for trying the app only):
              <ul className="samples">
                {SAMPLES.map(([role, email, pw]) => (
                  <li key={email}>{role}: <code>{email}</code> / <code>{pw}</code> <button type="button" className="link-btn" onClick={() => { setL({ ...l, email, password: pw }); setErr({}); document.getElementById('l-email')?.focus(); }}>Fill it in<span className="sr-only"> for {email}</span></button></li>
                ))}
              </ul>
              {api.isPreview && <p style={{ margin: 0 }}>This is the Live preview: accounts and data live only in this browser.</p>}
            </div>
          </section>
        ) : (
          <section aria-label="Register">
            <form onSubmit={doRegister} noValidate>
              <Field label="Full name" error={err.name} id="r-name">{(p) => <input className="input" autoComplete="name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} {...p} />}</Field>
              <Field label="Email" error={err.email} id="r-email">{(p) => <input className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} {...p} />}</Field>
              <PasswordInput id="r-password" label="Password" error={err.password} value={r.password} onChange={(e) => setR({ ...r, password: e.target.value })} autoComplete="new-password" />
              <PasswordInput id="r-confirm" label="Confirm password" error={err.confirm} value={r.confirm} onChange={(e) => setR({ ...r, confirm: e.target.value })} autoComplete="new-password" />
              <p className="muted" style={{ fontSize: '.8125rem' }}>At least 8 characters with a letter and a number.</p>
              <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function Profile() {
  const { user, updateUser, replaceSession } = useAuth();
  const toast = useToast();
  const [p, setP] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [err, setErr] = useState({});
  const saveProfile = async (e) => {
    e.preventDefault();
    const v = {};
    if (p.name.trim().length < 2) v.name = 'Enter your name.';
    if (p.phone && !PHONE.test(p.phone.trim())) v.phone = 'Enter a valid phone number.';
    setErr(v);
    if (Object.keys(v).length) return;
    try { updateUser(await api.patch('/auth/me', { name: p.name.trim(), phone: p.phone.trim() || undefined })); toast('Profile saved'); } catch (er) { toast(er.message, 'error'); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    const v = {};
    if (!pw.current) v.current = 'Enter your current password.';
    const prob = passwordProblem(pw.next);
    if (prob) v.next = prob;
    setErr(v);
    if (Object.keys(v).length) return;
    try {
      const r = await api.post('/auth/password', { current: pw.current, password: pw.next });
      replaceSession(r.token, r.user);
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (er) { setErr({ current: er.message }); }
  };
  return (
    <div className="layout2 even">
      <form className="card" onSubmit={saveProfile} noValidate>
        <h2 style={{ fontSize: '1.25rem' }}>Profile</h2>
        <p className="muted">{user.email} &middot; {user.role === 'kitchen' ? 'Kitchen staff' : user.role}</p>
        <Field label="Name" error={err.name} id="p-name">{(a) => <input className="input" autoComplete="name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} {...a} />}</Field>
        <Field label="Phone" error={err.phone} id="p-phone">{(a) => <input className="input" type="tel" autoComplete="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} {...a} />}</Field>
        <button className="btn" type="submit">Save profile</button>
      </form>
      <form className="card" onSubmit={savePw} noValidate>
        <h2 style={{ fontSize: '1.25rem' }}>Change password</h2>
        <PasswordInput id="pw-current" label="Current password" error={err.current} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
        <PasswordInput id="pw-next" label="New password" error={err.next} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
        <button className="btn" type="submit">Change password</button>
      </form>
    </div>
  );
}

function Addresses() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/addresses');
  const [a, setA] = useState({ label: 'Home', line: '', city: '', pin: '' });
  const [err, setErr] = useState({});
  const add = async (e) => {
    e.preventDefault();
    const v = {};
    if (a.line.trim().length < 8) v.line = 'Enter the full address.';
    if (!a.city.trim()) v.city = 'Enter your city.';
    if (!/^[0-9]{6}$/.test(a.pin.trim())) v.pin = 'Enter a 6 digit pincode.';
    setErr(v);
    if (Object.keys(v).length) return;
    try { await api.post('/addresses', { label: a.label.trim() || 'Home', line: a.line.trim(), city: a.city.trim(), pin: a.pin.trim() }); setA({ label: 'Home', line: '', city: '', pin: '' }); toast('Address saved'); reload(); } catch (er) { toast(er.message, 'error'); }
  };
  const del = async (id) => { try { await api.del(`/addresses/${id}`); toast('Address removed'); reload(); } catch (er) { toast(er.message, 'error'); } };
  return (
    <section className="card" aria-labelledby="addr-h">
      <h2 id="addr-h" style={{ fontSize: '1.25rem' }}>Saved addresses</h2>
      {loading ? <Loading label="Loading" /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length ? (
        <ul className="plain-list">{data.map((x) => (
          <li key={x.id} className="booking-row"><div><strong>{x.label}</strong><br /><span className="muted">{x.line}, {x.city} - {x.pin}</span></div><button type="button" className="link-btn" onClick={() => del(x.id)}>Remove<span className="sr-only"> {x.label} address</span></button></li>
        ))}</ul>
      ) : <p className="muted">No saved addresses yet.</p>}
      <form onSubmit={add} noValidate>
        <h3 style={{ fontSize: '1.05rem' }}>Add an address</h3>
        <div className="row2">
          <Field label="Label" id="a-label">{(p) => <input className="input" maxLength={30} value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })} {...p} />}</Field>
          <Field label="Address" error={err.line} id="a-line">{(p) => <input className="input" autoComplete="street-address" value={a.line} onChange={(e) => setA({ ...a, line: e.target.value })} {...p} />}</Field>
        </div>
        <div className="row2">
          <Field label="City" error={err.city} id="a-city">{(p) => <input className="input" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} {...p} />}</Field>
          <Field label="Pincode" error={err.pin} id="a-pin">{(p) => <input className="input" inputMode="numeric" maxLength={6} value={a.pin} onChange={(e) => setA({ ...a, pin: e.target.value })} {...p} />}</Field>
        </div>
        <button className="btn btn-ghost" type="submit">Save address</button>
      </form>
    </section>
  );
}

export function Account() {
  useDocumentTitle('Account');
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  return (
    <div className="container">
      <PageHead title="Your account" action={<button type="button" className="btn btn-ghost" onClick={async () => { await logout(); toast('Logged out'); nav('/'); }}>Log out</button>}>
        Signed in as {user.name}.
      </PageHead>
      <Profile />
      {user.role === 'customer' ? <div style={{ marginTop: '1.5rem' }}><Addresses /></div> : null}
      <div className="hero-actions">
        {user.role === 'customer' && <><Link className="btn btn-ghost" to="/orders">My orders</Link><Link className="btn btn-ghost" to="/favorites">Favorites</Link></>}
        {user.role === 'kitchen' && <Link className="btn btn-ghost" to="/kitchen">Open the kitchen</Link>}
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/admin">Open the admin area</Link>}
      </div>
    </div>
  );
}

export function Notifications() {
  useDocumentTitle('Notifications');
  const { notes, setNotes } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const readAll = async () => { try { await api.post('/notifications/read'); setNotes(notes.map((n) => ({ ...n, read: true }))); } catch (e) { toast(e.message, 'error'); } };
  const open = async (n) => {
    if (!n.read) { api.post(`/notifications/${n._id}/read`).catch(() => {}); setNotes(notes.map((x) => (x._id === n._id ? { ...x, read: true } : x))); }
    if (n.link) nav(n.link);
  };
  return (
    <div className="container">
      <PageHead title="Notifications" action={notes.some((n) => !n.read) ? <button type="button" className="btn btn-ghost btn-sm" onClick={readAll}>Mark all as read</button> : null}>
        Order updates, bookings and messages.
      </PageHead>
      {!notes.length ? <EmptyState title="You are all caught up">New notifications will appear here.</EmptyState> : (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n._id} className={n.read ? '' : 'unread'}>
              <button type="button" onClick={() => open(n)}>
                <strong>{n.title}</strong><span>{n.body}</span><small className="muted">{ago(n.createdAt)}{n.read ? '' : ' - new'}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

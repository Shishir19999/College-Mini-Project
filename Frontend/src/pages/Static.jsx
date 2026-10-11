import { useState } from 'react';
import { Link } from 'react-router-dom';
import Picture from '../components/Picture';
import { Field, PageHead } from '../components/Common';
import { api } from '../api';
import { useDocumentTitle } from '../hooks';
import { EMAIL } from '../lib/format';
import { useToast } from '../context/contexts';

const TEAM = [['AM', 'Aarav Mehta', 'Founder and head chef'], ['DK', 'Diya Kapoor', 'Operations'], ['RV', 'Rohan Verma', 'Delivery lead'], ['IN', 'Isha Nair', 'Customer care']];

export function About() {
  useDocumentTitle('About');
  return (
    <>
      <section className="hero" style={{ minHeight: 'min(52vh,420px)' }} aria-labelledby="ab-title">
        <div className="hero-bg" data-parallax="0.2"><Picture name="restaurant" eager height={900} /></div>
        <div className="container"><div className="hero-inner" style={{ paddingBlock: '4rem' }}>
          <p className="eyebrow" style={{ color: '#ffcf9e' }}>About us</p>
          <h1 id="ab-title">Good food, honest prices</h1>
          <p>A small shop with a big menu, built by students who love to eat.</p>
        </div></div>
      </section>
      <section className="section"><div className="container split">
        <div data-reveal>
          <h2>Our story</h2>
          <p className="muted">Online FoodShop began as a college mini project: a simple idea to make ordering a quick meal as easy as picking from a menu. We cook fast food, drinks and desserts fresh to order and keep prices friendly for students.</p>
          <p className="muted">Every dish is marked vegetarian or non-vegetarian, and you can save favorites, apply coupons and track your orders from one place.</p>
        </div>
        <div className="parallax-frame" data-reveal><Picture name="thali" alt="Thali served on a steel plate" sizes="(min-width:800px) 560px, 100vw" parallax="0.05" /></div>
      </div></section>
      <section className="section alt"><div className="container">
        <h2 data-reveal>What we stand for</h2>
        <div className="cards3">
          <div className="card feature" data-reveal><h3>Fresh every time</h3><p className="muted">Cooked to order with simple ingredients.</p></div>
          <div className="card feature" data-reveal data-reveal-delay="80"><h3>Fair prices</h3><p className="muted">Meals from Rs 5 and clear totals with no surprises.</p></div>
          <div className="card feature" data-reveal data-reveal-delay="160"><h3>Open to feedback</h3><p className="muted">Tell us what to improve on the <Link to="/contact">contact page</Link>.</p></div>
        </div>
      </div></section>
      <section className="section"><div className="container">
        <h2 data-reveal>Meet the team</h2>
        <div className="team">
          {TEAM.map(([ini, name, role], i) => (
            <div className="card member" key={ini} data-reveal data-reveal-delay={i * 80}><div className="avatar" aria-hidden="true">{ini}</div><h3>{name}</h3><p className="muted" style={{ margin: 0 }}>{role}</p></div>
          ))}
        </div>
      </div></section>
    </>
  );
}

export function Contact() {
  useDocumentTitle('Contact');
  const toast = useToast();
  const [v, setV] = useState({ name: '', email: '', message: '' });
  const [err, setErr] = useState({});
  const [state, setState] = useState('form');
  const [busy, setBusy] = useState(false);
  const check = (x = v) => ({
    name: x.name.trim().length >= 2 ? '' : 'Enter your name.',
    email: !x.email.trim() ? 'Enter your email address.' : EMAIL.test(x.email.trim()) ? '' : 'Enter a valid email, like you@example.com.',
    message: x.message.trim().length >= 10 ? '' : 'Write at least 10 characters.',
  });
  const set = (k) => (e) => { const n = { ...v, [k]: e.target.value }; setV(n); if (err[k]) setErr({ ...err, [k]: check(n)[k] }); };
  const blur = (k) => () => setErr({ ...err, [k]: check()[k] });
  const submit = async (e) => {
    e.preventDefault();
    const c = check();
    setErr(c);
    const first = Object.keys(c).find((k) => c[k]);
    if (first) { document.getElementById(`m-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      await api.post('/contact', { name: v.name, email: v.email, message: v.message });
      setState('sent');
    } catch (er) { toast(er.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="container">
      <PageHead title="Contact us">Questions, feedback or a catering enquiry? Send us a message.</PageHead>
      <div className="layout2 contact-layout">
        <div className="card" data-reveal>
          {state === 'form' ? (
            <form onSubmit={submit} noValidate>
              <h2 style={{ fontSize: '1.25rem' }}>Send a message</h2>
              <Field label="Your name" error={err.name} id="m-name">{(p) => <input className="input" autoComplete="name" value={v.name} onChange={set('name')} onBlur={blur('name')} {...p} />}</Field>
              <Field label="Email" error={err.email} id="m-email">{(p) => <input className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={v.email} onChange={set('email')} onBlur={blur('email')} {...p} />}</Field>
              <Field label="Message" error={err.message} id="m-message">{(p) => <textarea className="input" maxLength={500} value={v.message} onChange={set('message')} onBlur={blur('message')} {...p} />}</Field>
              <p className="muted count" aria-live="off">{v.message.length} / 500</p>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send message'}</button>
            </form>
          ) : (
            <div className="success" role="status">
              <div className="tick" aria-hidden="true">&#10003;</div>
              <h2 tabIndex={-1} ref={(el) => el?.focus()}>Message sent</h2>
              <p className="muted">Thanks for writing. Our team will read your message and reply soon.</p>
              <button className="btn btn-ghost" type="button" onClick={() => { setV({ name: '', email: '', message: '' }); setErr({}); setState('form'); }}>Send another</button>
            </div>
          )}
        </div>
        <div className="contact-cards" data-reveal data-reveal-delay="100">
          <div className="card"><strong>Email</strong><br /><a href="mailto:hello@example.com">hello@example.com</a></div>
          <div className="card"><strong>Phone</strong><br />+00 000 000 0000</div>
          <div className="card"><strong>Opening hours</strong><br />Every day, 9:00 to 22:00<br /><span className="muted">Sample address: 1 Example Street, Sample City</span></div>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="nf"><div>
      <div className="code" aria-hidden="true">404</div>
      <h1 style={{ fontSize: '2rem' }}>Page not found</h1>
      <p className="muted">The page you are looking for does not exist or has moved.</p>
      <Link className="btn" to="/">Back to home</Link>
    </div></div>
  );
}

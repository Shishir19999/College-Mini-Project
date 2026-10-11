import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Picture from '../components/Picture';
import DishCard from '../components/DishCard';
import { ErrorState } from '../components/Common';
import { useMenu } from '../context/contexts';
import { useDocumentTitle } from '../hooks';

const SLIDES = [
  { name: 'thali', alt: 'A thali with curry, flatbread and rice', title: 'Homestyle thali', text: 'Comfort food, cooked the way you like it.', h: 675 },
  { name: 'cafe', alt: 'A steaming cup of coffee on a dark background', title: 'Coffee and chai', text: 'Hot drinks from Rs 5.', h: 750 },
  { name: 'restaurant', alt: 'Dining area with tables and chairs', title: 'Sit down with friends', text: 'Our dining room is open every day.', h: 900 },
];

function Carousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const go = (n) => setI((n + SLIDES.length) % SLIDES.length);
  useEffect(() => {
    if (reduce.current || paused) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);
  const touch = useRef(null);
  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label="Featured" data-reveal
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}>
      <div className="slides" style={{ transform: `translateX(${-100 * i}%)` }}>
        {SLIDES.map((s, n) => (
          <figure className="slide" key={s.name} style={{ margin: 0 }} aria-hidden={n !== i} aria-label={`${n + 1} of ${SLIDES.length}`} inert={n !== i || undefined}>
            <Picture name={s.name} alt={s.alt} sizes="(min-width:1180px) 1150px, 100vw" height={s.h} />
            <figcaption><strong>{s.title}</strong>{s.text}</figcaption>
          </figure>
        ))}
      </div>
      <button type="button" className="icon-btn car-btn prev" aria-label="Previous slide" onClick={() => go(i - 1)}><Icon name="prev" /></button>
      <button type="button" className="icon-btn car-btn next" aria-label="Next slide" onClick={() => go(i + 1)}><Icon name="next" /></button>
      <div className="dots" role="group" aria-label="Choose slide">
        {SLIDES.map((s, n) => <button key={s.name} type="button" aria-label={`Go to slide ${n + 1}`} aria-current={n === i || undefined} onClick={() => go(n)} />)}
      </div>
    </div>
  );
}

export default function Home() {
  useDocumentTitle('');
  const { dishes, loading, error, reload } = useMenu();
  const featured = dishes.filter((d) => d.featured).slice(0, 6);
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-bg" data-parallax="0.2"><Picture name="thali" eager /></div>
        <span className="float a" data-parallax="0.4" aria-hidden="true" />
        <span className="float b" data-depth="18" aria-hidden="true" />
        <div className="container"><div className="hero-inner">
          <p className="eyebrow" style={{ color: '#ffcf9e' }}>Online FoodShop</p>
          <h1 id="hero-title">Hot, fresh food at your door</h1>
          <p>Browse the full menu, filter by diet and price, save your favorites and check out in a few taps.</p>
          <div className="hero-actions"><Link className="btn" to="/menu">Order now</Link><Link className="btn btn-ghost" to="/about">Our story</Link></div>
        </div></div>
      </section>

      <section className="section" aria-labelledby="feat-title"><div className="container">
        <h2 id="feat-title" data-reveal>Why people love us</h2>
        <div className="cards3">
          <div className="card feature" data-reveal><span className="ico"><Icon name="truck" /></span><h3>Quick delivery</h3><p className="muted">Free delivery above Rs 300, or pick up from the counter in 15 minutes.</p></div>
          <div className="card feature" data-reveal data-reveal-delay="80"><span className="ico"><Icon name="flame" /></span><h3>Cooked fresh</h3><p className="muted">Every order is prepared when you place it, with clearly marked veg and non-veg dishes.</p></div>
          <div className="card feature" data-reveal data-reveal-delay="160"><span className="ico"><Icon name="tag" /></span><h3>Coupons</h3><p className="muted">Try WELCOME10, FEAST50 or FREESHIP in your cart for a better price.</p></div>
        </div>
      </div></section>

      <section className="section alt" aria-labelledby="gal-title"><div className="container">
        <h2 id="gal-title" data-reveal>From our kitchen</h2>
        <Carousel />
      </div></section>

      <section className="section" aria-labelledby="pop-title"><div className="container">
        <div className="row-between"><h2 id="pop-title" data-reveal style={{ margin: 0 }}>Popular right now</h2><Link className="btn btn-ghost btn-sm" to="/menu">See full menu</Link></div>
        {error ? <ErrorState message={error} onRetry={reload} /> : (
          <div className="grid" aria-busy={loading}>
            {loading ? [0, 1, 2, 3].map((n) => <div className="skeleton" key={n} />) : featured.map((d) => <DishCard key={d._id} dish={d} />)}
          </div>
        )}
      </div></section>

      <section className="section alt"><div className="container split">
        <div className="parallax-frame" data-reveal><Picture name="restaurant" alt="Our dining room" sizes="(min-width:800px) 560px, 100vw" height={900} parallax="0.05" /></div>
        <div data-reveal>
          <p className="eyebrow">About us</p><h2>A small shop with a big menu</h2>
          <p className="muted">We started as a college project and grew into a neighbourhood favourite. Meet the team and read how we cook.</p>
          <div className="hero-actions"><Link className="btn" to="/about">About the team</Link><Link className="btn btn-ghost" to="/book">Book a table</Link></div>
        </div>
      </div></section>
    </>
  );
}

import { useMemo, useState } from 'react';
import { PageHead, ErrorState, EmptyState } from '../components/Common';
import Icon from '../components/Icon';
import DishCard from '../components/DishCard';
import { useFavorites, useMenu } from '../context/contexts';
import { useDebounced, useDocumentTitle } from '../hooks';

const INITIAL = { q: '', cat: 'All', diet: 'all', max: 0, sort: 'default' };

// The full menu, or only the dishes you saved (favOnly).
export default function Menu({ favOnly = false }) {
  useDocumentTitle(favOnly ? 'Favorites' : 'Menu');
  const { dishes, categories, loading, error, reload } = useMenu();
  const fav = useFavorites();
  const [f, setF] = useState(INITIAL);
  const q = useDebounced(f.q, 150).trim().toLowerCase();
  const cats = ['All', ...categories.map((c) => c.name)];

  const list = useMemo(() => {
    const out = dishes.filter((d) => (!favOnly || fav.has(d._id)) && (f.cat === 'All' || d.category === f.cat)
      && (f.diet === 'all' || (f.diet === 'veg') === d.veg) && (!f.max || d.price <= f.max)
      && (!q || `${d.name} ${d.category} ${d.desc}`.toLowerCase().includes(q)));
    if (f.sort === 'low') out.sort((a, b) => a.price - b.price);
    if (f.sort === 'high') out.sort((a, b) => b.price - a.price);
    if (f.sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    if (f.sort === 'rating') out.sort((a, b) => b.rating - a.rating || b.ratings - a.ratings);
    return out;
  }, [dishes, f, q, favOnly, fav]);

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = cats.indexOf(f.cat);
    const next = cats[(n + (e.key === 'ArrowRight' ? 1 : cats.length - 1)) % cats.length];
    setF({ ...f, cat: next });
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };

  return (
    <div className="container">
      <PageHead title={favOnly ? 'Your favorites' : 'Our menu'}>
        {favOnly ? 'Dishes you have saved with the heart button.' : 'Search, filter by diet or price and add anything to your cart.'}
      </PageHead>
      <div className="toolbar">
        <div className="toolbar-row">
          <div className="search">
            <label className="sr-only" htmlFor="q">Search the menu</label>
            <Icon name="search" />
            <input className="input" id="q" type="search" placeholder="Search dishes" autoComplete="off" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </div>
          <div><label className="sr-only" htmlFor="max">Maximum price</label>
            <select className="input" id="max" value={f.max} onChange={(e) => setF({ ...f, max: +e.target.value })}>
              <option value="0">Any price</option><option value="30">Up to Rs 30</option><option value="50">Up to Rs 50</option><option value="100">Up to Rs 100</option>
            </select></div>
          <div><label className="sr-only" htmlFor="sort">Sort</label>
            <select className="input" id="sort" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
              <option value="default">Sort: Featured</option><option value="rating">Top rated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name: A to Z</option>
            </select></div>
        </div>
        <div className="toolbar-row" role="group" aria-label="Diet">
          <button type="button" className="chip" aria-pressed={f.diet === 'all'} onClick={() => setF({ ...f, diet: 'all' })}>All</button>
          <button type="button" className="chip" aria-pressed={f.diet === 'veg'} onClick={() => setF({ ...f, diet: 'veg' })}><span className="diet" /> Veg</button>
          <button type="button" className="chip" aria-pressed={f.diet === 'nonveg'} onClick={() => setF({ ...f, diet: 'nonveg' })}><span className="diet nv" /> Non-veg</button>
          <span className="muted" aria-live="polite" style={{ marginLeft: 'auto' }}>{loading ? '' : `${list.length} ${list.length === 1 ? 'item' : 'items'}`}</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Categories" onKeyDown={onTabKey}>
          {cats.map((c) => (
            <button key={c} id={`tab-${c}`} type="button" className="chip" role="tab" aria-selected={f.cat === c} tabIndex={f.cat === c ? 0 : -1} onClick={() => setF({ ...f, cat: c })}>{c}</button>
          ))}
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? (
        <div className="grid" aria-busy="true">{[0, 1, 2, 3].map((n) => <div className="skeleton" key={n} />)}</div>
      ) : list.length ? (
        <div className="grid" role="tabpanel" aria-label={f.cat}><h2 className="sr-only">Dishes</h2>{list.map((d) => <DishCard key={d._id} dish={d} />)}</div>
      ) : favOnly && !fav.ids.length ? (
        <EmptyState title="No favorites yet" action={{ to: '/menu', label: 'Browse the menu' }}>Tap the heart on any dish to save it here.</EmptyState>
      ) : (
        <EmptyState title="Nothing matches your filters" action={{ label: 'Clear filters', onClick: () => setF(INITIAL) }}>Try a different search or clear the filters.</EmptyState>
      )}
    </div>
  );
}

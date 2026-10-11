import { useRef, useState } from 'react';
import { ErrorState, Field, Loading, Modal, PageHead } from '../../components/Common';
import { api } from '../../api';
import { imageUrl } from '../../api/config';
import { useMenu, useToast } from '../../context/contexts';
import { useDocumentTitle } from '../../hooks';
import { money, readImage } from '../../lib/format';

const blank = (categoryId) => ({ name: '', categoryId, price: '', veg: true, desc: '', image: '', available: true, featured: false });

function DishForm({ dish, categories, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(dish ? { ...dish, price: String(dish.price) } : blank(categories[0]?._id || ''));
  const [preview, setPreview] = useState(dish?.image ? imageUrl(dish.image) : '');
  const [pending, setPending] = useState('');
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const pick = async (e) => {
    try { const url = await readImage(e.target.files[0]); setPending(url); setPreview(url); setErr({ ...err, image: '' }); } catch (er) { setErr({ ...err, image: er.message }); e.target.value = ''; }
  };
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Enter a name.';
    if (!f.categoryId) v.categoryId = 'Choose a category.';
    if (!(Number(f.price) >= 1)) v.price = 'Enter a price of at least 1.';
    setErr(v);
    const first = Object.keys(v)[0];
    if (first) { document.getElementById(`d-${first}`)?.focus(); return; }
    setBusy(true);
    const body = { name: f.name.trim(), categoryId: f.categoryId, price: Number(f.price), veg: f.veg, desc: f.desc.trim(), available: f.available, featured: f.featured, image: pending };
    try {
      if (dish) await api.put(`/admin/dishes/${dish._id}`, body); else await api.post('/admin/dishes', body);
      toast(dish ? 'Dish updated' : 'Dish added');
      onSaved();
    } catch (er) { toast(er.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={dish ? `Edit ${dish.name}` : 'Add a dish'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Name" error={err.name} id="d-name">{(p) => <input className="input" value={f.name} onChange={set('name')} {...p} />}</Field>
        <div className="row2">
          <Field label="Category" error={err.categoryId} id="d-categoryId">{(p) => <select className="input" value={f.categoryId} onChange={set('categoryId')} {...p}>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}</Field>
          <Field label="Price (Rs)" error={err.price} id="d-price">{(p) => <input className="input" inputMode="decimal" value={f.price} onChange={set('price')} {...p} />}</Field>
        </div>
        <Field label="Description" id="d-desc">{(p) => <textarea className="input" maxLength={200} style={{ minHeight: 80 }} value={f.desc} onChange={set('desc')} {...p} />}</Field>
        <Field label="Photo (PNG, JPEG, WebP or AVIF, under 450 KB)" error={err.image} id="d-image">{(p) => <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" ref={file} onChange={pick} {...p} />}</Field>
        {preview && <img className="upload-preview" src={preview} alt="Selected dish" width="120" height="90" />}
        <div className="checks">
          <label className="check"><input type="checkbox" checked={f.veg} onChange={set('veg')} /> Vegetarian</label>
          <label className="check"><input type="checkbox" checked={f.available} onChange={set('available')} /> Available</label>
          <label className="check"><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Show on the home page</label>
        </div>
        <div className="actions"><button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save dish'}</button></div>
      </form>
    </Modal>
  );
}

function Categories({ categories, onChange }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const run = async (fn, ok) => { try { await fn(); toast(ok); onChange(); } catch (e) { toast(e.message, 'error'); } };
  const add = (e) => { e.preventDefault(); if (name.trim().length < 2) { toast('Enter a category name.', 'error'); return; } run(() => api.post('/admin/categories', { name: name.trim() }), 'Category added').then(() => setName('')); };
  return (
    <section className="card" aria-labelledby="cat-h">
      <h2 id="cat-h" style={{ fontSize: '1.15rem' }}>Categories</h2>
      <ul className="plain-list">
        {categories.map((c) => (
          <li key={c._id} className="booking-row">
            {editing?.id === c._id ? (
              <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/admin/categories/${c._id}`, { name: editing.name }), 'Category renamed').then(() => setEditing(null)); }}>
                <label className="sr-only" htmlFor={`cn-${c._id}`}>Category name</label>
                <input className="input" id={`cn-${c._id}`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button className="btn btn-sm" type="submit">Save</button>
              </form>
            ) : (
              <><span>{c.name}</span>
                <span><button type="button" className="link-btn" onClick={() => setEditing({ id: c._id, name: c.name })}>Rename<span className="sr-only"> {c.name}</span></button>{' '}
                  <button type="button" className="link-btn danger" onClick={() => run(() => api.del(`/admin/categories/${c._id}`), 'Category deleted')}>Delete<span className="sr-only"> {c.name}</span></button></span></>
            )}
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <label className="sr-only" htmlFor="new-cat">New category</label>
        <input className="input" id="new-cat" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Add category</button>
      </form>
    </section>
  );
}

export default function AdminMenu() {
  useDocumentTitle('Manage menu');
  const { dishes, categories, loading, error, reload } = useMenu();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | dish
  const remove = async (d) => {
    if (!window.confirm(`Delete ${d.name}? Its reviews are removed too.`)) return;
    try { await api.del(`/admin/dishes/${d._id}`); toast('Dish deleted'); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const toggle = async (d) => {
    try { await api.put(`/admin/dishes/${d._id}`, { name: d.name, categoryId: d.categoryId, price: d.price, veg: d.veg, desc: d.desc, available: !d.available, featured: d.featured }); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Manage menu" action={<button type="button" className="btn" onClick={() => setEditing('new')} disabled={!categories.length}>Add a dish</button>}>Add, edit, hide or remove dishes and keep categories tidy.</PageHead>
      {loading ? <Loading label="Loading the menu" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Dishes</caption>
              <thead><tr><th scope="col">Dish</th><th scope="col">Category</th><th scope="col" className="num">Price</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {dishes.map((d) => (
                  <tr key={d._id}>
                    <td><span className="cell-dish"><img src={imageUrl(d.image)} alt="" width="48" height="36" /><span className={`diet ${d.veg ? '' : 'nv'}`} role="img" aria-label={d.veg ? 'Vegetarian' : 'Non-vegetarian'} /> {d.name}</span></td>
                    <td>{d.category}</td><td className="num">{money(d.price)}</td>
                    <td>{d.available ? 'Available' : 'Sold out'}{d.featured ? ', featured' : ''}</td>
                    <td className="actions-cell">
                      <button type="button" className="link-btn" onClick={() => setEditing(d)}>Edit<span className="sr-only"> {d.name}</span></button>{' '}
                      <button type="button" className="link-btn" onClick={() => toggle(d)}>{d.available ? 'Mark sold out' : 'Mark available'}<span className="sr-only"> {d.name}</span></button>{' '}
                      <button type="button" className="link-btn danger" onClick={() => remove(d)}>Delete<span className="sr-only"> {d.name}</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Categories categories={categories} onChange={reload} />
        </div>
      )}
      {editing && <DishForm dish={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

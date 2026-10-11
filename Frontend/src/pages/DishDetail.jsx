import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AddButton } from '../components/DishCard';
import { EmptyState, ErrorState, Loading, StarInput, Stars } from '../components/Common';
import { imageUrl } from '../api/config';
import { api } from '../api';
import { useAuth, useFavorites, useMenu, useToast } from '../context/contexts';
import { useApi, useDocumentTitle } from '../hooks';
import { fmtDate, money } from '../lib/format';

function ReviewForm({ dish, existing, onSaved }) {
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Choose a rating from 1 to 5 stars.'); return; }
    setBusy(true);
    try {
      await api.post(`/dishes/${dish._id}/reviews`, { rating, comment });
      toast('Thanks for your review');
      setError('');
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="card review-form" onSubmit={submit} noValidate>
      <h3>{existing ? 'Update your review' : 'Write a review'}</h3>
      <StarInput value={rating} onChange={setRating} />
      <div className="field">
        <label htmlFor="rv-comment">Comment (optional)</label>
        <textarea className="input" id="rv-comment" maxLength={400} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save review'}</button>
    </form>
  );
}

export default function DishDetail() {
  const { id } = useParams();
  const { byId, loading, error, reload, categories } = useMenu();
  const { user } = useAuth();
  const toast = useToast();
  const fav = useFavorites();
  const dish = byId(id);
  useDocumentTitle(dish?.name);
  const reviews = useApi(`/dishes/${id}/reviews`);
  if (loading) return <Loading label="Loading the dish" />;
  if (error) return <div className="container"><ErrorState message={error} onRetry={reload} /></div>;
  if (!dish) return <div className="container"><EmptyState title="Dish not found" action={{ to: '/menu', label: 'Back to the menu' }}>This dish is no longer on the menu.</EmptyState></div>;
  const mine = reviews.data?.find((r) => r.user === user?._id);
  const saved = fav.has(dish._id);
  const removeReview = async (r) => {
    try { await api.del(`/reviews/${r._id}`); toast('Review removed'); reviews.reload(); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const afterSave = () => { reviews.reload(); reload(); };
  return (
    <div className="container dish-detail">
      <p className="crumbs"><Link to="/menu">Menu</Link> / {categories.find((c) => c._id === dish.categoryId)?.name || dish.category}</p>
      <div className="split">
        <div className="card dish-photo"><img src={imageUrl(dish.image)} alt={dish.name} width="560" height="420" /></div>
        <div>
          <div className="tag-row"><span className={`diet ${dish.veg ? '' : 'nv'}`} role="img" aria-label={dish.veg ? 'Vegetarian' : 'Non-vegetarian'} />{dish.category}</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{dish.name}</h1>
          <Stars value={dish.rating} count={dish.ratings} size="lg" />
          <p className="muted" style={{ marginTop: '.75rem' }}>{dish.desc}</p>
          <p className="price big">{money(dish.price)}</p>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <AddButton dish={dish} large />
            <button type="button" className="btn btn-ghost" aria-pressed={saved} onClick={() => fav.toggle(dish._id)}><Icon name="heart" filled={saved} /> {saved ? 'Saved' : 'Save to favorites'}</button>
          </div>
        </div>
      </div>
      <section className="section" aria-labelledby="rv-title">
        <h2 id="rv-title">Reviews</h2>
        <div className="layout2">
          <div>
            {reviews.loading ? <Loading label="Loading reviews" /> : reviews.error ? <ErrorState message={reviews.error} onRetry={reviews.reload} /> : reviews.data.length ? (
              <ul className="reviews">
                {reviews.data.map((r) => (
                  <li className="card" key={r._id}>
                    <div className="row-between"><strong>{r.userName}</strong><span className="muted">{fmtDate(r.createdAt)}</span></div>
                    <Stars value={r.rating} />
                    {r.comment && <p>{r.comment}</p>}
                    {(user?.role === 'admin' || r.user === user?._id) && <button type="button" className="link-btn" onClick={() => removeReview(r)}>Remove<span className="sr-only"> review by {r.userName}</span></button>}
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No reviews yet">Order this dish and be the first to review it.</EmptyState>}
          </div>
          <aside>
            {user?.role === 'customer' ? <ReviewForm key={mine?._id || 'new'} dish={dish} existing={mine} onSaved={afterSave} /> : !user ? (
              <div className="card"><h3>Review this dish</h3><p className="muted">Log in to rate dishes you have ordered.</p><Link className="btn" to="/login" state={{ from: `/menu/${dish._id}` }}>Log in</Link></div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}

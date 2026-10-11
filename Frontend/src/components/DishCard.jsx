import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Stars } from './Common';
import { imageUrl } from '../api/config';
import { money } from '../lib/format';
import { useAuth, useCart, useFavorites, useToast } from '../context/contexts';

export function Stepper({ dish }) {
  const cart = useCart();
  const q = cart.qty(dish._id);
  if (!q) return null;
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${dish.name}`}>
      <button type="button" onClick={() => cart.setQty(dish._id, q - 1)} aria-label={`Remove one ${dish.name}`}>&minus;</button>
      <output aria-live="polite">{q}</output>
      <button type="button" onClick={() => cart.setQty(dish._id, q + 1)} aria-label={`Add one more ${dish.name}`}>+</button>
    </div>
  );
}

export function AddButton({ dish, large = false }) {
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();
  if (user && user.role !== 'customer') return null;
  if (!dish.available) return <span className="soldout">Sold out</span>;
  if (cart.qty(dish._id)) return <Stepper dish={dish} />;
  return (
    <button type="button" className={`btn ${large ? '' : 'btn-sm'}`} aria-label={`Add ${dish.name} to cart`}
      onClick={() => { cart.setQty(dish._id, 1); toast(`${dish.name} added to cart`); }}>Add</button>
  );
}

export default function DishCard({ dish }) {
  const fav = useFavorites();
  const saved = fav.has(dish._id);
  return (
    <article className={`dish ${dish.available ? '' : 'is-out'}`}>
      <div className="dish-img">
        <img src={imageUrl(dish.image)} alt="" width="300" height="200" loading="lazy" />
        <div className="fav">
          <button type="button" className="icon-btn" aria-pressed={saved} aria-label={`Favorite ${dish.name}`} onClick={() => fav.toggle(dish._id)}><Icon name="heart" /></button>
        </div>
      </div>
      <div className="dish-body">
        <div className="tag-row"><span className={`diet ${dish.veg ? '' : 'nv'}`} role="img" aria-label={dish.veg ? 'Vegetarian' : 'Non-vegetarian'} />{dish.category}</div>
        <h3><Link to={`/menu/${dish._id}`}>{dish.name}</Link></h3>
        <Stars value={dish.rating} count={dish.ratings} />
        <p>{dish.desc}</p>
        <div className="dish-foot"><span className="price">{money(dish.price)}</span><span><AddButton dish={dish} /></span></div>
      </div>
    </article>
  );
}

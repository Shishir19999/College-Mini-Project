import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useCart, useMenu } from './context/contexts';

// GET helper: { data, loading, error, reload, setData }. Re-runs when path or params change.
export function useApi(path, params, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: '' });
  const key = JSON.stringify(params || {});
  const seq = useRef(0);
  const run = useCallback(() => {
    if (skip || !path) return Promise.resolve();
    const id = ++seq.current;
    return api.get(path, params ? JSON.parse(key) : undefined)
      .then((data) => { if (id === seq.current) setState({ data, loading: false, error: '' }); })
      .catch((e) => { if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e.message })); });
  }, [path, key, skip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setState((s) => ({ ...s, loading: true, error: '' })); run(); }, [run]);
  const setData = useCallback((data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })), []);
  return { ...state, reload: run, setData };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - Online FoodShop` : 'Online FoodShop - Fresh food, fast';
  }, [title]);
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Live totals from the same rules the server applies when the order is placed.
export function useQuote(mode = 'delivery') {
  const cart = useCart();
  const { byId, dishes } = useMenu();
  const lines = Object.entries(cart.items).map(([id, qty]) => ({ dish: byId(id), qty })).filter((l) => l.dish);
  const payload = lines.filter((l) => l.dish.available).map((l) => ({ dish: l.dish._id, qty: l.qty }));
  const key = JSON.stringify([payload, cart.coupon, mode]);
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    if (!dishes.length || !payload.length) { setQuote(null); return undefined; }
    let dead = false;
    api.post('/quote', { items: payload, coupon: cart.coupon, mode }).then((q) => { if (!dead) setQuote(q); }).catch(() => { if (!dead) setQuote(null); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dishes.length]);
  return { lines, quote: payload.length ? quote : null };
}


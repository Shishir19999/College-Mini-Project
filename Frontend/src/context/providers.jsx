import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { setAuthToken } from '../api/config';
import { setUnauthorizedHandler } from '../api/errors';
import { connectLive } from '../api/live';
import { MAX_QTY } from '../../../shared/rules.js';
import { drop, load, save } from '../lib/storage';
import { AuthCtx, CartCtx, FavCtx, MenuCtx, ThemeCtx, ToastCtx, useAuth, useMenu, useToast } from './contexts';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => {
    const n = t === 'dark' ? 'light' : 'dark';
    save('fs.theme', n);
    return n;
  }), []);
  return <ThemeCtx.Provider value={useMemo(() => ({ theme, toggle }), [theme, toggle])}>{children}</ThemeCtx.Provider>;
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const toast = useCallback((message, type = '') => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

const TOKEN_KEY = 'fs.token';
const savedToken = () => load(TOKEN_KEY, null, true) || load(TOKEN_KEY, null);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [state, setState] = useState({ user: null, ready: false });
  const [live, setLive] = useState(null);
  const [notes, setNotes] = useState([]);
  const remember = useRef(true);

  const setSession = useCallback((token, user, keep = remember.current) => {
    remember.current = keep;
    drop(TOKEN_KEY);
    if (token) save(TOKEN_KEY, token, !keep);
    setAuthToken(token);
    setState({ user, ready: true });
  }, []);

  // restore a saved session once
  useEffect(() => {
    const token = savedToken();
    if (!token) { setState({ user: null, ready: true }); return; }
    remember.current = !load(TOKEN_KEY, null, true);
    setAuthToken(token);
    api.auth.me().then((user) => setState({ user, ready: true })).catch(() => { setAuthToken(null); drop(TOKEN_KEY); setState({ user: null, ready: true }); });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null, null);
      toast('Your session ended. Please log in again.', 'error');
    });
  }, [setSession, toast]);

  const user = state.user;
  const userKey = user?.id || user?._id || null;
  // live channel + notifications for the signed-in user
  useEffect(() => {
    if (!userKey) { setLive(null); setNotes([]); return undefined; }
    let conn = null;
    let dead = false;
    api.get('/notifications').then((n) => !dead && setNotes(n)).catch(() => {});
    connectLive({ token: savedToken(), user: { id: userKey, role: user.role } }).then((c) => {
      if (dead) { c.close(); return; }
      conn = c;
      c.on('notification', (n) => setNotes((l) => [n, ...l.filter((x) => x._id !== n._id)]));
      setLive(c);
    });
    return () => { dead = true; conn?.close(); setLive(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  const value = useMemo(() => ({
    user, ready: state.ready, live, notes, setNotes,
    unread: notes.filter((n) => !n.read).length,
    async login(email, password, keep = true) {
      const r = await api.auth.login(email, password);
      setSession(r.token, r.user, keep);
      return r.user;
    },
    async register(name, email, password) {
      const r = await api.auth.register(name, email, password);
      setSession(r.token, r.user, true);
      return r.user;
    },
    async logout() {
      try { await api.auth.logout(); } catch { /* already signed out */ }
      setSession(null, null);
    },
    updateUser: (u) => setState((s) => ({ ...s, user: u })),
    // a password change returns a fresh token
    replaceSession: (token, u) => setSession(token, u),
  }), [user, state.ready, live, notes, setSession]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function MenuProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: '', categories: [], dishes: [] });
  const reload = useCallback(() => {
    api.get('/menu').then((m) => setState({ loading: false, error: '', ...m })).catch((e) => setState((s) => ({ ...s, loading: false, error: e.message })));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const value = useMemo(() => ({ ...state, reload, byId: (id) => state.dishes.find((d) => d._id === id) }), [state, reload]);
  return <MenuCtx.Provider value={value}>{children}</MenuCtx.Provider>;
}

const CART_KEY = 'fs.cart2';
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => load(CART_KEY, { items: {}, coupon: '' }));
  useEffect(() => { save(CART_KEY, cart); }, [cart]);
  const value = useMemo(() => {
    const items = cart.items;
    return {
      items,
      coupon: cart.coupon,
      count: Object.values(items).reduce((a, b) => a + b, 0),
      qty: (id) => items[id] || 0,
      setQty: (id, q) => setCart((c) => {
        const next = { ...c.items };
        const n = Math.max(0, Math.min(MAX_QTY, q));
        if (n) next[id] = n; else delete next[id];
        return { ...c, items: next };
      }),
      addMany: (list) => setCart((c) => {
        const next = { ...c.items };
        for (const { dish, qty } of list) next[dish] = Math.min(MAX_QTY, (next[dish] || 0) + qty);
        return { ...c, items: next };
      }),
      setCoupon: (coupon) => setCart((c) => ({ ...c, coupon })),
      clear: () => setCart({ items: {}, coupon: '' }),
    };
  }, [cart]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

// Favorites live on the account for customers and in this browser for guests; guest picks merge on login.
const FAV_KEY = 'fs.favs2';
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const { dishes } = useMenu();
  const [local, setLocal] = useState(() => load(FAV_KEY, []));
  const [remote, setRemote] = useState([]);
  const isCustomer = user?.role === 'customer';
  const uid = user?._id;
  useEffect(() => {
    if (!isCustomer) { setRemote([]); return; }
    const guest = load(FAV_KEY, []);
    const p = guest.length ? api.post('/favorites/merge', { ids: guest }).then(() => { save(FAV_KEY, []); setLocal([]); }) : Promise.resolve();
    p.then(() => api.get('/favorites')).then(setRemote).catch(() => {});
  }, [isCustomer, uid]);
  const ids = isCustomer ? remote : local;
  const value = useMemo(() => ({
    ids,
    has: (id) => ids.includes(id),
    async toggle(id) {
      const name = dishes.find((d) => d._id === id)?.name || 'Dish';
      if (user && !isCustomer) { toast('Staff accounts do not keep favorites.'); return; }
      if (isCustomer) {
        try {
          const r = await api.post(`/favorites/${id}/toggle`);
          setRemote(r.favorites);
          toast(r.saved ? `${name} saved to favorites` : `${name} removed from favorites`);
        } catch (e) { toast(e.message, 'error'); }
      } else {
        const on = !local.includes(id);
        const next = on ? [...local, id] : local.filter((x) => x !== id);
        setLocal(next);
        save(FAV_KEY, next);
        toast(on ? `${name} saved to favorites` : `${name} removed from favorites`);
      }
    },
  }), [ids, user, isCustomer, local, dishes, toast]);
  return <FavCtx.Provider value={value}>{children}</FavCtx.Provider>;
}

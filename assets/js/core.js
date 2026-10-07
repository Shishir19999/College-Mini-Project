/* Online FoodShop - shared core: data, storage, theme, auth, cart, header/footer, toasts */
(function () {
  'use strict';

  var MENU = [
    { id: 'biryani', name: 'Chicken Biryani', cat: 'Fast Food', price: 50, veg: false, img: 'biryani.jpg', desc: 'Fragrant basmati rice layered with spiced chicken.' },
    { id: 'burger', name: 'Crispy Veg Burger', cat: 'Fast Food', price: 40, veg: true, img: 'burger.jpg', desc: 'Crunchy patty, lettuce and house sauce in a sesame bun.' },
    { id: 'noodles', name: 'Veg Noodles', cat: 'Fast Food', price: 50, veg: true, img: 'noodles.jpg', desc: 'Wok-tossed noodles with fresh vegetables.' },
    { id: 'pizza', name: 'Cheese Pizza', cat: 'Fast Food', price: 100, veg: true, img: 'pizza.jpg', desc: 'Hand-stretched base with a generous layer of cheese.' },
    { id: 'momos', name: 'Chicken Momos', cat: 'Fast Food', price: 100, veg: false, img: 'momos.jpg', desc: 'Steamed dumplings served with a fiery red chutney.' },
    { id: 'chole', name: 'Chole Bhature', cat: 'Fast Food', price: 70, veg: true, img: 'chole.jpg', desc: 'Spiced chickpea curry with puffed fried bread.' },
    { id: 'pastry', name: 'Chocolate Pastry', cat: 'Desserts', price: 35, veg: true, img: 'pastry.jpg', desc: 'Soft sponge layered with rich chocolate cream.' },
    { id: 'coke', name: 'Coca-Cola', cat: 'Cold Drinks', price: 40, veg: true, img: 'coke.jpg', desc: 'Chilled and fizzy, 250 ml.' },
    { id: 'mirinda', name: 'Mirinda', cat: 'Cold Drinks', price: 30, veg: true, img: 'mirinda.jpg', desc: 'Sparkling orange soda, 250 ml.' },
    { id: 'dew', name: 'Mountain Dew', cat: 'Cold Drinks', price: 30, veg: true, img: 'mountain dew.jpg', desc: 'Citrus soda with a bold kick, 250 ml.' },
    { id: 'thumsup', name: 'Thums Up', cat: 'Cold Drinks', price: 30, veg: true, img: 'thumps.jpg', desc: 'Strong cola taste, 250 ml.' },
    { id: 'tea', name: 'Masala Tea', cat: 'Hot Drinks', price: 10, veg: true, img: 'tea.jpg', desc: 'Milk tea brewed with ginger and cardamom.' },
    { id: 'coffee', name: 'Filter Coffee', cat: 'Hot Drinks', price: 20, veg: true, img: 'coffee.jpg', desc: 'Freshly brewed, creamy and strong.' },
    { id: 'black', name: 'Black Tea', cat: 'Hot Drinks', price: 5, veg: true, img: 'black.jpg', desc: 'Plain brewed tea, no milk, no sugar.' },
    { id: 'green', name: 'Green Tea', cat: 'Hot Drinks', price: 15, veg: true, img: 'green.jpg', desc: 'Light and refreshing leaf tea.' }
  ];
  var COUPONS = {
    WELCOME10: { label: '10% off your order', pct: 10 },
    FEAST50: { label: 'Rs 50 off orders above Rs 250', flat: 50, min: 250 },
    FREESHIP: { label: 'Free delivery', freeShip: true }
  };
  var DELIVERY_FEE = 30, FREE_DELIVERY_OVER = 300, TAX = 0.05;
  // Demo accounts, stored only as SHA-256 hashes of "fs:<email>:<password>"
  var SEED = [
    { email: 'demo@example.com', name: 'Demo User', hash: '361ccf6f2559195568c01bcdc98638044ebb6fff69025240913389c7e5e64a96' },
    { email: 'student@example.com', name: 'Student', hash: 'b5eddc5c46534edd5c356d415df90672161c2648e2c0ab518743dcee65977f24' }
  ];

  var root = document.documentElement;
  var K = { theme: 'fs.theme', cart: 'fs.cart', coupon: 'fs.coupon', favs: 'fs.favs', orders: 'fs.orders', users: 'fs.users', session: 'fs.session' };

  function load(k, d, session) {
    try { var v = (session ? sessionStorage : localStorage).getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function save(k, v, session) { try { (session ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } }
  function drop(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* blocked */ } }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'Rs ' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); }
  function byId(id) { return MENU.filter(function (m) { return m.id === id; })[0]; }

  /* Icons */
  var I = {
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 11.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.5L21 7H6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
  };

  /* Theme */
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    $$('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }
  function initialTheme() {
    var s = load(K.theme, null);
    return s || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  /* Toasts */
  var host;
  function toast(msg, type) {
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    var t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; host.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, 3200);
  }

  /* Auth (demo only, client side) */
  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('WebCrypto is not available in this browser context.'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return [].map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function hashFor(email, pw) { return sha256('fs:' + email.trim().toLowerCase() + ':' + pw); }
  function allUsers() { return SEED.concat(load(K.users, [])); }
  function session() { return load(K.session, null, true) || load(K.session, null); }
  function login(email, pw, remember) {
    return hashFor(email, pw).then(function (h) {
      var e = email.trim().toLowerCase();
      var u = allUsers().filter(function (x) { return x.email === e && x.hash === h; })[0];
      if (!u) return null;
      var s = { email: u.email, name: u.name };
      drop(K.session); save(K.session, s, !remember);
      return s;
    });
  }
  function register(name, email, pw) {
    var e = email.trim().toLowerCase();
    if (allUsers().some(function (x) { return x.email === e; })) return Promise.resolve(null);
    return hashFor(e, pw).then(function (h) {
      var list = load(K.users, []); list.push({ email: e, name: name.trim(), hash: h }); save(K.users, list);
      return { email: e, name: name.trim() };
    });
  }
  function logout() { drop(K.session); }

  /* Cart */
  function cart() { return load(K.cart, {}); }
  function setQty(id, q) {
    var c = cart(); q = Math.max(0, Math.min(20, q));
    if (q) c[id] = q; else delete c[id];
    save(K.cart, c); changed();
  }
  function qty(id) { return cart()[id] || 0; }
  function count() { var c = cart(); return Object.keys(c).reduce(function (n, k) { return n + c[k]; }, 0); }
  function lines() { var c = cart(); return Object.keys(c).map(function (id) { var m = byId(id); return m ? { item: m, qty: c[id] } : null; }).filter(Boolean); }
  function totals(mode) {
    var sub = lines().reduce(function (s, l) { return s + l.item.price * l.qty; }, 0);
    var code = load(K.coupon, null), cp = code && COUPONS[code], disc = 0, msg = '';
    if (cp) {
      if (cp.min && sub < cp.min) { msg = code + ' needs a subtotal of at least Rs ' + cp.min; cp = null; }
      else if (cp.pct) disc = Math.round(sub * cp.pct) / 100;
      else if (cp.flat) disc = Math.min(cp.flat, sub);
    }
    var ship = (!sub || mode === 'pickup' || sub >= FREE_DELIVERY_OVER || (cp && cp.freeShip)) ? 0 : DELIVERY_FEE;
    var tax = Math.round((sub - disc) * TAX * 100) / 100;
    return { sub: sub, code: cp ? code : null, disc: disc, ship: ship, tax: tax, total: sub - disc + ship + tax, msg: msg };
  }
  function applyCoupon(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) { drop(K.coupon); changed(); return { ok: true, cleared: true }; }
    var cp = COUPONS[code];
    if (!cp) return { ok: false, msg: 'That coupon code is not valid.' };
    var sub = totals().sub;
    if (cp.min && sub < cp.min) return { ok: false, msg: 'Add Rs ' + (cp.min - sub) + ' more to use ' + code + '.' };
    save(K.coupon, code); changed(); return { ok: true, code: code, label: cp.label };
  }
  function changed() { updateBadge(); document.dispatchEvent(new CustomEvent('fs:cart')); }
  function updateBadge() {
    var n = count();
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }

  /* Favorites */
  function favs() { return load(K.favs, []); }
  function toggleFav(id) {
    var f = favs(), i = f.indexOf(id);
    if (i > -1) f.splice(i, 1); else f.push(id);
    save(K.favs, f); return i === -1;
  }

  /* Orders */
  function orders() { return load(K.orders, []); }
  function addOrder(o) { var l = orders(); l.unshift(o); save(K.orders, l); }

  /* Dish card (shared by home, menu, favorites) */
  function dishActions(id) {
    var q = qty(id), n = byId(id).name;
    return q
      ? '<div class="stepper" role="group" aria-label="Quantity of ' + esc(n) + '"><button type="button" data-act="dec" data-id="' + id + '" aria-label="Remove one ' + esc(n) + '">&minus;</button><output aria-live="polite">' + q + '</output><button type="button" data-act="inc" data-id="' + id + '" aria-label="Add one more ' + esc(n) + '">+</button></div>'
      : '<button type="button" class="btn btn-sm" data-act="add" data-id="' + id + '" aria-label="Add ' + esc(n) + ' to cart">Add</button>';
  }
  function dishCard(m) {
    var fav = favs().indexOf(m.id) > -1;
    return '<article class="dish" data-id="' + m.id + '">' +
      '<div class="dish-img"><img src="' + esc(m.img) + '" alt="' + esc(m.name) + '" width="300" height="200" loading="lazy">' +
      '<div class="fav"><button type="button" class="icon-btn" data-act="fav" data-id="' + m.id + '" aria-pressed="' + fav + '" aria-label="Favorite ' + esc(m.name) + '">' + I.heart + '</button></div></div>' +
      '<div class="dish-body"><div class="tag-row"><span class="diet' + (m.veg ? '' : ' nv') + '" role="img" aria-label="' + (m.veg ? 'Vegetarian' : 'Non-vegetarian') + '"></span>' + esc(m.cat) + '</div>' +
      '<h3>' + esc(m.name) + '</h3><p>' + esc(m.desc) + '</p>' +
      '<div class="dish-foot"><span class="price">' + money(m.price) + '</span><span data-actions>' + dishActions(m.id) + '</span></div></div></article>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
    if (act === 'add' || act === 'inc') { setQty(id, qty(id) + 1); if (act === 'add') toast(byId(id).name + ' added to cart'); }
    else if (act === 'dec') setQty(id, qty(id) - 1);
    else if (act === 'fav') {
      var on = toggleFav(id); b.setAttribute('aria-pressed', on);
      toast(on ? 'Saved to favorites' : 'Removed from favorites');
      document.dispatchEvent(new CustomEvent('fs:favs'));
    }
  });
  document.addEventListener('fs:cart', function () {
    $$('.dish[data-id]').forEach(function (d) {
      var s = $('[data-actions]', d), id = d.getAttribute('data-id');
      var had = document.activeElement && s.contains(document.activeElement) ? document.activeElement.getAttribute('data-act') : null;
      s.innerHTML = dishActions(id);
      if (had) { var f = $('[data-act="' + had + '"]', s) || $(qty(id) ? '[data-act="inc"]' : '[data-act="add"]', s); if (f) f.focus(); }
    });
  });

  /* Header / footer */
  var NAV = [['index.html', 'Home', 'home'], ['menu.html', 'Menu', 'menu'], ['favorites.html', 'Favorites', 'favorites'], ['orders.html', 'Orders', 'orders'], ['aboutus.html', 'About', 'about'], ['contact.html', 'Contact', 'contact']];
  function chrome() {
    var page = document.body.getAttribute('data-page'), s = session();
    var nav = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[2] === page ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');
    var head = document.createElement('header'); head.className = 'site-header';
    head.innerHTML = '<div class="container bar"><a class="brand" href="index.html"><img src="logo.png" alt="" width="36" height="36"><span>Online FoodShop</span></a>' +
      '<nav class="nav" id="site-nav" aria-label="Main">' + nav + '</nav><div class="tools">' +
      '<a class="icon-btn" href="login.html" aria-label="' + (s ? 'Account: ' + esc(s.name) : 'Log in or register') + '" title="' + (s ? esc(s.name) : 'Log in') + '">' + I.user + '</a>' +
      '<a class="icon-btn" href="cart.html" aria-label="Cart">' + I.cart + '<span class="badge" data-cart-count hidden>0</span></a>' +
      '<button type="button" class="icon-btn" data-theme-toggle aria-pressed="false">' + I.moon + '</button>' +
      '<button type="button" class="icon-btn menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">' + I.menu + '</button></div></div>';
    document.body.insertBefore(head, document.body.firstChild);
    var skip = document.createElement('a'); skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Skip to content';
    document.body.insertBefore(skip, document.body.firstChild);
    var foot = document.createElement('footer'); foot.className = 'site-footer';
    foot.innerHTML = '<div class="container foot"><div><strong>Online FoodShop</strong><br><span class="muted">Fresh food, fair prices. A college mini project.</span></div>' +
      '<ul><li><a href="menu.html">Menu</a></li><li><a href="cart.html">Cart</a></li><li><a href="orders.html">Orders</a></li><li><a href="contact.html">Contact</a></li></ul></div>';
    document.body.appendChild(foot);
    var tg = $('.menu-toggle', head), nv = $('#site-nav', head);
    tg.addEventListener('click', function () { var o = nv.classList.toggle('open'); tg.setAttribute('aria-expanded', o); tg.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });
    $$('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () { var n = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme(n); save(K.theme, n); });
    });
    applyTheme(root.getAttribute('data-theme') || initialTheme());
    updateBadge();
  }

  window.FS = { MENU: MENU, COUPONS: COUPONS, FEE: DELIVERY_FEE, FREE_OVER: FREE_DELIVERY_OVER, byId: byId, $: $, $$: $$, esc: esc, money: money, toast: toast, I: I,
    login: login, register: register, logout: logout, session: session, cart: cart, setQty: setQty, qty: qty, count: count, lines: lines, totals: totals,
    applyCoupon: applyCoupon, clearCart: function () { drop(K.cart); drop(K.coupon); changed(); }, couponCode: function () { return load(K.coupon, null); },
    favs: favs, orders: orders, addOrder: addOrder, dishCard: dishCard, initialTheme: initialTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chrome); else chrome();
})();

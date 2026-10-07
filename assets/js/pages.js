/* Online FoodShop - page logic (requires core.js) */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, esc = FS.esc, money = FS.money, toast = FS.toast;
  var page = document.body.getAttribute('data-page');

  function setErr(input, msg) {
    var err = document.getElementById(input.id + '-err');
    if (err) err.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    return !msg;
  }
  function wire(form, rules) {
    // rules: { id: function(value, input) -> error message or '' }
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('blur', function () { setErr(el, rules[id](el.value.trim(), el)); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) setErr(el, rules[id](el.value.trim(), el)); });
    });
    return function validate() {
      var first = null;
      Object.keys(rules).forEach(function (id) {
        var el = document.getElementById(id); if (!el || el.disabled || !el.offsetParent && el.type !== 'hidden') return;
        if (!setErr(el, rules[id](el.value.trim(), el)) && !first) first = el;
      });
      if (first) first.focus();
      return !first;
    };
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var vEmail = function (v) { return !v ? 'Enter your email address.' : !EMAIL.test(v) ? 'Enter a valid email, like you@example.com.' : ''; };
  var vReq = function (label) { return function (v) { return v ? '' : 'Enter ' + label + '.'; }; };

  /* ---------- Home: carousel + featured ---------- */
  function initCarousel() {
    var c = $('.carousel'); if (!c) return;
    var track = $('.slides', c), slides = $$('.slide', c), dots = $('.dots', c), i = 0, timer = null, paused = false;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    slides.forEach(function (s, n) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Go to slide ' + (n + 1));
      b.addEventListener('click', function () { go(n); }); dots.appendChild(b);
    });
    function go(n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-100 * i) + '%)';
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k !== i); s.setAttribute('aria-label', (k + 1) + ' of ' + slides.length); });
      $$('button', dots).forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }
    function play() { stop(); if (!reduce && !paused) timer = setInterval(function () { go(i + 1); }, 5000); }
    function stop() { clearInterval(timer); timer = null; }
    $('.prev', c).addEventListener('click', function () { go(i - 1); });
    $('.next', c).addEventListener('click', function () { go(i + 1); });
    c.addEventListener('mouseenter', stop); c.addEventListener('mouseleave', play);
    c.addEventListener('focusin', stop); c.addEventListener('focusout', play);
    c.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
    var tx = null;
    c.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    c.addEventListener('touchend', function (e) { if (tx === null) return; var d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); tx = null; });
    go(0); play();
  }
  function initHome() {
    initCarousel();
    var g = $('#featured');
    if (g) g.innerHTML = ['biryani', 'pizza', 'momos', 'burger', 'coffee', 'pastry'].map(function (id) { return FS.dishCard(FS.byId(id)); }).join('');
  }

  /* ---------- Menu / favorites ---------- */
  function initMenu(favOnly) {
    var grid = $('#grid'), count = $('#count');
    var st = { q: '', cat: 'All', diet: 'all', max: 0, sort: 'default' };
    var cats = ['All'].concat(FS.MENU.map(function (m) { return m.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var tabs = $('#tabs');
    tabs.innerHTML = cats.map(function (c) { return '<button type="button" class="chip" role="tab" data-cat="' + esc(c) + '" aria-selected="' + (c === 'All') + '">' + esc(c) + '</button>'; }).join('');
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      st.cat = b.getAttribute('data-cat'); $$('[data-cat]', tabs).forEach(function (x) { x.setAttribute('aria-selected', x === b); }); render();
    });
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var t = $$('[data-cat]', tabs), n = t.indexOf(document.activeElement); if (n < 0) return;
      var nx = t[(n + (e.key === 'ArrowRight' ? 1 : t.length - 1)) % t.length]; nx.focus(); nx.click();
    });
    $('#q').addEventListener('input', function (e) { st.q = e.target.value.trim().toLowerCase(); render(); });
    $('#diet').addEventListener('click', function (e) {
      var b = e.target.closest('[data-diet]'); if (!b) return;
      st.diet = b.getAttribute('data-diet'); $$('[data-diet]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); render();
    });
    $('#max').addEventListener('change', function (e) { st.max = +e.target.value; render(); });
    $('#sort').addEventListener('change', function (e) { st.sort = e.target.value; render(); });
    function reset() {
      st = { q: '', cat: 'All', diet: 'all', max: 0, sort: 'default' };
      $('#q').value = ''; $('#max').value = '0'; $('#sort').value = 'default';
      $$('[data-diet]').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-diet') === 'all'); });
      $$('[data-cat]', tabs).forEach(function (x) { x.setAttribute('aria-selected', x.getAttribute('data-cat') === 'All'); });
      render();
    }
    function render() {
      try {
        var f = FS.favs();
        var list = FS.MENU.filter(function (m) {
          return (!favOnly || f.indexOf(m.id) > -1) && (st.cat === 'All' || m.cat === st.cat) &&
            (st.diet === 'all' || (st.diet === 'veg') === m.veg) && (!st.max || m.price <= st.max) &&
            (!st.q || (m.name + ' ' + m.cat + ' ' + m.desc).toLowerCase().indexOf(st.q) > -1);
        });
        if (st.sort === 'low') list.sort(function (a, b) { return a.price - b.price; });
        if (st.sort === 'high') list.sort(function (a, b) { return b.price - a.price; });
        if (st.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        count.textContent = list.length + (list.length === 1 ? ' item' : ' items');
        if (!list.length) {
          grid.className = '';
          grid.innerHTML = favOnly && !f.length
            ? '<div class="state"><h3>No favorites yet</h3><p>Tap the heart on any dish to save it here.</p><a class="btn" href="menu.html">Browse the menu</a></div>'
            : '<div class="state"><h3>Nothing matches your filters</h3><p>Try a different search or clear the filters.</p><button type="button" class="btn btn-ghost" id="reset">Clear filters</button></div>';
          var r = $('#reset'); if (r) r.addEventListener('click', reset);
        } else { grid.className = 'grid'; grid.innerHTML = list.map(FS.dishCard).join(''); }
      } catch (err) {
        grid.className = ''; grid.innerHTML = '<div class="state" role="alert"><h3>Something went wrong</h3><p>The menu could not be shown.</p><button type="button" class="btn" onclick="location.reload()">Try again</button></div>';
      }
    }
    grid.setAttribute('aria-busy', 'true');
    grid.className = 'grid'; grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    setTimeout(function () { grid.removeAttribute('aria-busy'); render(); }, 350);
    if (favOnly) document.addEventListener('fs:favs', function () { setTimeout(render, 0); });
  }

  /* ---------- Summary helper ---------- */
  function summaryHTML(t, mode) {
    return '<div class="sum-row"><span>Subtotal</span><span>' + money(t.sub) + '</span></div>' +
      (t.disc ? '<div class="sum-row disc"><span>Coupon ' + esc(t.code) + '</span><span>&minus; ' + money(t.disc) + '</span></div>' : '') +
      '<div class="sum-row"><span>' + (mode === 'pickup' ? 'Pickup' : 'Delivery') + '</span><span>' + (t.ship ? money(t.ship) : 'Free') + '</span></div>' +
      '<div class="sum-row"><span>Tax (5%)</span><span>' + money(t.tax) + '</span></div>' +
      '<div class="sum-row total"><span>Total</span><span>' + money(t.total) + '</span></div>';
  }

  /* ---------- Cart ---------- */
  function initCart() {
    var box = $('#cart-lines'), sum = $('#summary'), go = $('#go-checkout'), note = $('#coupon-msg');
    function render() {
      var ls = FS.lines(), t = FS.totals();
      if (!ls.length) {
        box.innerHTML = '<div class="state"><h3>Your cart is empty</h3><p>Add something tasty from the menu.</p><a class="btn" href="menu.html">Browse the menu</a></div>';
        sum.hidden = true; return;
      }
      sum.hidden = false;
      box.innerHTML = ls.map(function (l) {
        var m = l.item;
        return '<div class="line"><img src="' + esc(m.img) + '" alt="' + esc(m.name) + '" width="72" height="56"><div><h3>' + esc(m.name) + '</h3><span class="muted">' + money(m.price) + ' each</span></div>' +
          '<div class="line-end"><div class="stepper" role="group" aria-label="Quantity of ' + esc(m.name) + '"><button type="button" data-act="dec" data-id="' + m.id + '" aria-label="Remove one ' + esc(m.name) + '">&minus;</button><output>' + l.qty + '</output><button type="button" data-act="inc" data-id="' + m.id + '" aria-label="Add one more ' + esc(m.name) + '">+</button></div>' +
          '<strong>' + money(m.price * l.qty) + '</strong><button type="button" class="link-btn" data-rm="' + m.id + '" aria-label="Remove ' + esc(m.name) + ' from cart">Remove</button></div></div>';
      }).join('');
      $('#totals').innerHTML = summaryHTML(t);
      $('#coupon').value = FS.couponCode() || '';
      note.textContent = t.msg || (t.code ? FS.COUPONS[t.code].label + ' applied.' : 'Try WELCOME10, FEAST50 or FREESHIP.');
      $('#ship-hint').textContent = t.sub < FS.FREE_OVER ? 'Add ' + money(FS.FREE_OVER - t.sub) + ' more for free delivery.' : 'You get free delivery.';
    }
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { FS.setQty(b.getAttribute('data-rm'), 0); toast('Item removed'); } });
    $('#clear').addEventListener('click', function () { if (FS.count() && confirm('Remove all items from your cart?')) FS.clearCart(); });
    $('#coupon-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = FS.applyCoupon($('#coupon').value);
      if (!r.ok) { note.textContent = r.msg; $('#coupon').setAttribute('aria-invalid', 'true'); toast(r.msg, 'error'); }
      else { $('#coupon').removeAttribute('aria-invalid'); toast(r.cleared ? 'Coupon removed' : r.code + ' applied'); }
    });
    document.addEventListener('fs:cart', render);
    render();
  }

  /* ---------- Checkout ---------- */
  function initCheckout() {
    var root = $('#checkout'), sess = FS.session();
    if (!sess) {
      root.innerHTML = '<div class="card state"><h3>Log in to check out</h3><p>Your cart is saved. Log in or create an account to place the order.</p><a class="btn" href="login.html?next=checkout.html">Log in</a></div>'; return;
    }
    if (!FS.count()) {
      root.innerHTML = '<div class="card state"><h3>Your cart is empty</h3><p>Add items before checking out.</p><a class="btn" href="menu.html">Browse the menu</a></div>'; return;
    }
    var step = 1, data = { mode: 'delivery', pay: 'upi' };
    var steps = $$('#steps li'), panes = $$('[data-step]');
    var vDetails = wire($('#f-details'), {
      'c-name': vReq('your full name'),
      'c-phone': function (v) { return !v ? 'Enter a phone number.' : /^[0-9 +()-]{7,16}$/.test(v) ? '' : 'Enter a valid phone number.'; },
      'c-addr': function (v, el) { return data.mode === 'pickup' || v.length >= 8 ? '' : 'Enter your full delivery address.'; },
      'c-city': function (v) { return data.mode === 'pickup' || v ? '' : 'Enter your city.'; },
      'c-pin': function (v) { return data.mode === 'pickup' || /^[0-9]{6}$/.test(v) ? '' : 'Enter a 6 digit pincode.'; }
    });
    var vPay = wire($('#f-pay'), {
      'p-upi': function (v) { return data.pay !== 'upi' || /^[\w.-]{2,}@[\w]{2,}$/.test(v) ? '' : 'Enter a UPI id like name@bank.'; },
      'p-card': function (v) { return data.pay !== 'card' || /^[0-9 ]{13,19}$/.test(v) && v.replace(/\s/g, '').length >= 13 ? '' : 'Enter a valid card number (demo: 4242 4242 4242 4242).'; },
      'p-exp': function (v) { return data.pay !== 'card' || /^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(v) ? '' : 'Use MM/YY.'; },
      'p-cvv': function (v) { return data.pay !== 'card' || /^[0-9]{3,4}$/.test(v) ? '' : 'Enter the 3 or 4 digit code.'; }
    });
    $('#c-name').value = sess.name;
    function show(n) {
      step = n;
      panes.forEach(function (p) { p.hidden = +p.getAttribute('data-step') !== n; });
      steps.forEach(function (s, k) { s.removeAttribute('aria-current'); s.classList.toggle('done', k + 1 < n); if (k + 1 === n) s.setAttribute('aria-current', 'step'); });
      if (n === 3) review();
      var h = $('[data-step="' + n + '"] h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
    }
    function side() {
      $('#side-totals').innerHTML = summaryHTML(FS.totals(data.mode), data.mode);
      $('#side-lines').innerHTML = FS.lines().map(function (l) { return '<div class="sum-row"><span>' + l.qty + ' &times; ' + esc(l.item.name) + '</span><span>' + money(l.qty * l.item.price) + '</span></div>'; }).join('');
    }
    $$('input[name="mode"]').forEach(function (r) {
      r.addEventListener('change', function () {
        data.mode = r.value; $('#addr-fields').hidden = r.value === 'pickup';
        $$('#addr-fields .input').forEach(function (i) { setErr(i, ''); }); side();
      });
    });
    $$('input[name="pay"]').forEach(function (r) {
      r.addEventListener('change', function () {
        data.pay = r.value;
        $('#pay-upi').hidden = r.value !== 'upi'; $('#pay-card').hidden = r.value !== 'card'; $('#pay-cod').hidden = r.value !== 'cod';
        $$('#f-pay .input').forEach(function (i) { setErr(i, ''); });
      });
    });
    $('#p-card').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); });
    $('#p-exp').addEventListener('input', function (e) { var v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); e.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v; });
    $('#f-details').addEventListener('submit', function (e) {
      e.preventDefault(); if (!vDetails()) return;
      data.name = $('#c-name').value.trim(); data.phone = $('#c-phone').value.trim();
      data.addr = data.mode === 'pickup' ? 'Pickup at the shop counter' : $('#c-addr').value.trim() + ', ' + $('#c-city').value.trim() + ' - ' + $('#c-pin').value.trim();
      show(2);
    });
    $('#f-pay').addEventListener('submit', function (e) { e.preventDefault(); if (vPay()) show(3); });
    $$('[data-back]').forEach(function (b) { b.addEventListener('click', function () { show(step - 1); }); });
    function review() {
      var t = FS.totals(data.mode);
      $('#review').innerHTML = '<p><strong>' + esc(data.name) + '</strong> &middot; ' + esc(data.phone) + '<br>' + esc(data.addr) + '</p><p class="muted">Payment: ' + ({ upi: 'UPI', card: 'Card (demo)', cod: 'Cash on delivery' }[data.pay]) + '</p>' + summaryHTML(t, data.mode);
    }
    $('#place').addEventListener('click', function () {
      var btn = this; btn.disabled = true; btn.textContent = 'Placing order...';
      setTimeout(function () {
        var t = FS.totals(data.mode);
        var id = 'FS-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(100 + Math.random() * 900);
        var order = { id: id, user: sess.email, date: new Date().toISOString(), mode: data.mode, pay: data.pay, addr: data.addr, total: t.total, code: t.code,
          items: FS.lines().map(function (l) { return { id: l.item.id, name: l.item.name, price: l.item.price, qty: l.qty }; }) };
        FS.addOrder(order); FS.clearCart();
        $('#checkout-flow').hidden = true; $('#confirm').hidden = false;
        $('#order-id').textContent = id; $('#order-total').textContent = money(order.total);
        $('#order-eta').textContent = data.mode === 'pickup' ? 'Ready for pickup in about 15 minutes.' : 'Estimated delivery in 30 to 40 minutes.';
        var h = $('#confirm h2'); h.setAttribute('tabindex', '-1'); h.focus(); window.scrollTo(0, 0);
      }, 900);
    });
    side(); show(1);
  }

  /* ---------- Orders ---------- */
  function initOrders() {
    var box = $('#orders'), s = FS.session();
    if (!s) { box.innerHTML = '<div class="card state"><h3>Log in to see your orders</h3><p>Order history is kept for each account on this device.</p><a class="btn" href="login.html?next=orders.html">Log in</a></div>'; return; }
    var list = FS.orders().filter(function (o) { return o.user === s.email; });
    if (!list.length) { box.innerHTML = '<div class="card state"><h3>No orders yet</h3><p>Your placed orders will show up here.</p><a class="btn" href="menu.html">Order something</a></div>'; return; }
    box.innerHTML = list.map(function (o) {
      return '<article class="card order-card"><div class="order-head"><div><span class="oid">' + esc(o.id) + '</span> <span class="status">Confirmed</span></div><span class="muted">' + new Date(o.date).toLocaleString() + '</span></div>' +
        '<ul>' + o.items.map(function (i) { return '<li>' + i.qty + ' &times; ' + esc(i.name) + '</li>'; }).join('') + '</ul>' +
        '<div class="order-head"><span class="muted">' + (o.mode === 'pickup' ? 'Pickup' : 'Delivery') + ' &middot; ' + esc(o.addr) + '</span><strong>' + money(o.total) + '</strong></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-reorder="' + esc(o.id) + '">Order again</button></article>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-reorder]'); if (!b) return;
      var o = list.filter(function (x) { return x.id === b.getAttribute('data-reorder'); })[0];
      o.items.forEach(function (i) { if (FS.byId(i.id)) FS.setQty(i.id, FS.qty(i.id) + i.qty); });
      toast('Items added to your cart'); location.href = 'cart.html';
    });
  }

  /* ---------- Login / register ---------- */
  function nextUrl() {
    var n = new URLSearchParams(location.search).get('next');
    return n && /^[a-z]+\.html$/.test(n) ? n : 'menu.html';
  }
  function initLogin() {
    var s = FS.session(), formsBox = $('#auth-forms'), done = $('#signed-in');
    function showState() {
      s = FS.session(); formsBox.hidden = !!s; done.hidden = !s;
      if (s) $('#who').textContent = s.name + ' (' + s.email + ')';
    }
    $('#logout').addEventListener('click', function () { FS.logout(); toast('Logged out'); setTimeout(function () { location.reload(); }, 400); });
    var tabs = $$('[data-tab]');
    function tab(n) {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-tab') === n); });
      $('#login-panel').hidden = n !== 'login'; $('#register-panel').hidden = n !== 'register';
      $('#a-title').textContent = n === 'login' ? 'Welcome back' : 'Create your account';
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { tab(t.getAttribute('data-tab')); }); });
    $$('[data-pw]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = document.getElementById(b.getAttribute('data-pw')), show = i.type === 'password';
        i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', show);
      });
    });
    var vLogin = wire($('#login-form'), { 'l-email': vEmail, 'l-pass': function (v) { return v ? '' : 'Enter your password.'; } });
    var vReg = wire($('#register-form'), {
      'r-name': function (v) { return v.length >= 2 ? '' : 'Enter your name.'; },
      'r-email': vEmail,
      'r-pass': function (v) { return v.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(v) || !/[0-9]/.test(v) ? 'Include a letter and a number.' : ''; },
      'r-confirm': function (v) { return v === $('#r-pass').value ? '' : 'Passwords do not match.'; }
    });
    function fail(el, m) { el.textContent = m; el.hidden = false; }
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault(); var al = $('#login-alert'); al.hidden = true;
      if (!vLogin()) return;
      var btn = $('#login-btn'); btn.disabled = true;
      FS.login($('#l-email').value, $('#l-pass').value, $('#l-remember').checked).then(function (u) {
        btn.disabled = false;
        if (!u) { fail(al, 'Incorrect email or password.'); return; }
        toast('Welcome back, ' + u.name); setTimeout(function () { location.href = nextUrl(); }, 500);
      }).catch(function (err) { btn.disabled = false; fail(al, err.message); });
    });
    $('#register-form').addEventListener('submit', function (e) {
      e.preventDefault(); var al = $('#reg-alert'); al.hidden = true;
      if (!vReg()) return;
      FS.register($('#r-name').value, $('#r-email').value, $('#r-pass').value).then(function (u) {
        if (!u) { fail(al, 'An account with this email already exists.'); return; }
        return FS.login($('#r-email').value, $('#r-pass').value, true).then(function () { toast('Account created'); setTimeout(function () { location.href = nextUrl(); }, 500); });
      }).catch(function (err) { fail(al, err.message); });
    });
    $('#fill-demo').addEventListener('click', function () { $('#l-email').value = 'demo@example.com'; $('#l-pass').value = 'Demo@1234'; $('#l-email').focus(); });
    showState(); tab('login');
  }

  /* ---------- Contact ---------- */
  function initContact() {
    var form = $('#contact-form'), ok = $('#contact-ok');
    var v = wire(form, {
      'm-name': function (x) { return x.length >= 2 ? '' : 'Enter your name.'; },
      'm-email': vEmail,
      'm-msg': function (x) { return x.length >= 10 ? '' : 'Write at least 10 characters.'; }
    });
    var msg = $('#m-msg'), cnt = $('#m-count');
    msg.addEventListener('input', function () { cnt.textContent = msg.value.length + ' / 500'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (!v()) return;
      var b = $('#m-send'); b.disabled = true; b.textContent = 'Sending...';
      setTimeout(function () { form.hidden = true; ok.hidden = false; var h = $('h2', ok); h.setAttribute('tabindex', '-1'); h.focus(); }, 800);
    });
    $('#m-again').addEventListener('click', function () { form.reset(); form.hidden = false; ok.hidden = true; var b = $('#m-send'); b.disabled = false; b.textContent = 'Send message'; cnt.textContent = '0 / 500'; });
  }

  function init() {
    ({ home: initHome, menu: function () { initMenu(false); }, favorites: function () { initMenu(true); }, cart: initCart, checkout: initCheckout, orders: initOrders, login: initLogin, contact: initContact }[page] || function () {})();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

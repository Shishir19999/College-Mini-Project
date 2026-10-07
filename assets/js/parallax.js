/*
 * Lightweight motion helpers (no dependencies).
 *   [data-reveal]            fades / slides an element in once it enters the viewport
 *   [data-reveal-delay=ms]   optional stagger for reveal
 *   [data-parallax=0.15]     scroll parallax: moves the element vertically at a fraction of scroll speed
 *   [data-depth=12]          pointer parallax: shifts the element up to N px with the pointer (hero scenes)
 * Only transform and opacity are animated. Everything is switched off for
 * prefers-reduced-motion; scroll/pointer parallax is also off on small screens,
 * in data-saver mode and on low-power devices.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqSmall = window.matchMedia('(max-width: 767px)');
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var conn = navigator.connection || {};
  var lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2) || conn.saveData === true;

  var revealIO = null, visibleIO = null;
  var visible = new Set();
  var scrollTick = false, pointerTick = false;
  var px = 0, py = 0;
  var parallaxEls = [], depthEls = [];

  function motionOK() { return !mqReduce.matches; }
  function parallaxOK() { return motionOK() && !mqSmall.matches && !lowPower; }

  function collect() {
    parallaxEls = [].slice.call(document.querySelectorAll('[data-parallax]'));
    depthEls = [].slice.call(document.querySelectorAll('[data-depth]'));
  }

  function resetTransforms() {
    parallaxEls.concat(depthEls).forEach(function (el) { el.style.transform = ''; });
  }

  function updateScroll() {
    scrollTick = false;
    var vh = window.innerHeight;
    visible.forEach(function (el) {
      var host = el.parentElement;
      if (!host) return;
      var r = host.getBoundingClientRect();
      var d = r.top + r.height / 2 - vh / 2;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      var y = Math.max(-160, Math.min(160, -d * speed));
      el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    });
  }

  function updatePointer() {
    pointerTick = false;
    depthEls.forEach(function (el) {
      var depth = parseFloat(el.getAttribute('data-depth')) || 10;
      el.style.transform = 'translate3d(' + (px * depth).toFixed(1) + 'px,' + (py * depth).toFixed(1) + 'px,0)';
    });
  }

  function onScroll() {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(updateScroll); }
  }
  function onPointer(e) {
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!pointerTick) { pointerTick = true; requestAnimationFrame(updatePointer); }
  }

  function startReveal() {
    var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if (!motionOK() || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    root.classList.add('motion');
    if (revealIO) revealIO.disconnect();
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var delay = en.target.getAttribute('data-reveal-delay');
          if (delay) en.target.style.transitionDelay = delay + 'ms';
          en.target.classList.add('in');
          revealIO.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { if (!el.classList.contains('in')) revealIO.observe(el); });
  }

  function startParallax() {
    if (!parallaxOK()) return;
    root.classList.add('parallax-on');
    if ('IntersectionObserver' in window) {
      visibleIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target);
        });
        onScroll();
      }, { rootMargin: '20% 0px' });
      parallaxEls.forEach(function (el) { visibleIO.observe(el); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    if (mqFine.matches && depthEls.length) window.addEventListener('pointermove', onPointer, { passive: true });
    onScroll();
  }

  function stopParallax() {
    root.classList.remove('parallax-on');
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('pointermove', onPointer);
    if (visibleIO) { visibleIO.disconnect(); visibleIO = null; }
    visible.clear();
    resetTransforms();
  }

  function init() {
    collect();
    startReveal();
    startParallax();
    var change = function () {
      stopParallax();
      if (!motionOK()) {
        if (revealIO) revealIO.disconnect();
        root.classList.remove('motion');
        [].forEach.call(document.querySelectorAll('[data-reveal]'), function (el) { el.classList.add('in'); });
      } else {
        startReveal();
      }
      startParallax();
    };
    [mqReduce, mqSmall].forEach(function (m) {
      if (m.addEventListener) m.addEventListener('change', change); else m.addListener(change);
    });
  }

  window.MotionKit = { refresh: function () { stopParallax(); collect(); startReveal(); startParallax(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

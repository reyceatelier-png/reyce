/* REYCE — page d'accueil premium : diaporama du héros + protocole en parcours (test) */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- Diaporama du héros ---------- */
  (function reel() {
    var hero = document.querySelector('.gx-hero');
    if (!hero) return;
    var slides = [].slice.call(hero.querySelectorAll('.gx-slide'));
    var bars = [].slice.call(hero.querySelectorAll('.gx-reel__bar'));
    var capEl = hero.querySelector('.gx-reel__cap b');
    var reelEl = hero.querySelector('.gx-reel');
    var pp = hero.querySelector('.gx-reel__pp');
    var numEl = hero.querySelector('.gx-reel__num b');
    if (slides.length < 2) return;
    var cur = 0, playing = !reduce;

    /* les photos suivantes ne se chargent qu'une fois la page affichée */
    function loadRest() {
      slides.forEach(function (s) {
        var im = s.querySelector('img');
        if (!im || !im.getAttribute('data-src')) return;
        var ss = im.getAttribute('data-srcset');
        if (ss) im.setAttribute('srcset', ss);
        im.setAttribute('src', im.getAttribute('data-src'));
        im.removeAttribute('data-src'); im.removeAttribute('data-srcset');
      });
    }
    if (document.readyState === 'complete') setTimeout(loadRest, 600);
    else window.addEventListener('load', function () { setTimeout(loadRest, 600); });

    function go(n, manual) {
      n = (n + slides.length) % slides.length;
      if (n === cur && !manual) return;
      loadRest();
      slides.forEach(function (s) { s.classList.remove('is-prev'); });
      slides[cur].classList.remove('is-active'); slides[cur].classList.add('is-prev');
      bars[cur].classList.remove('is-on'); bars[cur].removeAttribute('aria-current');
      cur = n;
      slides[cur].classList.add('is-active');
      bars[cur].classList.add('is-on'); bars[cur].setAttribute('aria-current', 'true');
      /* redémarre la barre de progression */
      var i = bars[cur].querySelector('i'); i.style.animation = 'none'; void i.offsetWidth; i.style.animation = '';
      if (capEl) capEl.textContent = slides[cur].getAttribute('data-cap') || '';
      if (numEl) numEl.textContent = String(cur + 1);
    }

    bars.forEach(function (b, k) {
      b.addEventListener('click', function () { go(k, true); });
      /* la fin de l'animation de la barre déclenche la photo suivante */
      b.querySelector('i').addEventListener('animationend', function () { if (k === cur && playing) go(cur + 1); });
    });

    function setPlaying(v) {
      playing = v;
      reelEl.classList.toggle('is-paused', !v);
      if (pp) pp.setAttribute('aria-label', v ? 'Mettre le diaporama en pause' : 'Relancer le diaporama');
      if (pp) pp.classList.toggle('is-paused', !v);
    }
    if (pp) pp.addEventListener('click', function () { setPlaying(!playing); });
    /* balayage du doigt sur mobile */
    var sx = 0, sy = 0;
    hero.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6) go(cur + (dx < 0 ? 1 : -1), true);
    }, { passive: true });
    setPlaying(playing);
  })();

  /* ---------- Protocole : une étape à la fois ---------- */
  (function journey() {
    var root = document.querySelector('.gx-j');
    if (!root) return;
    var steps = [].slice.call(root.querySelectorAll('.gx-j__step'));
    var imgs = [].slice.call(root.querySelectorAll('.gx-j__frame img'));
    var count = root.querySelector('.gx-j__count b');
    function on(i) {
      steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
      imgs.forEach(function (m, k) { m.classList.toggle('is-on', k === i); });
      if (count) count.textContent = ('0' + (i + 1)).slice(-2);
    }
    root.classList.add('is-live');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) on(steps.indexOf(e.target)); });
    }, { rootMargin: '-46% 0px -46% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
    /* un clic sur une étape la met en avant */
    steps.forEach(function (s, k) { s.addEventListener('click', function () { on(k); }); });
  })();
})();

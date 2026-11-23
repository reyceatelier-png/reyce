/* REYCE — page d'accueil : diaporama du héros + déroulé en parcours (ordinateur) / cartes qui défilent (téléphone) */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- Diaporama du héros : les photos changent seules, en continu (≈ 4 s chacune, fondu 1,2 s) ----------
     Aucune commande visible ; en pause quand on survole ou parcourt les choix au clavier, quand le héros
     sort de l'écran ou que l'onglet est caché. Bouton pause caché, accessible au clavier et aux lecteurs
     d'écran (règle d'accessibilité). Immobile si le téléphone demande moins d'animations. */
  (function reel() {
    var hero = document.querySelector('.gx-hero');
    if (!hero) return;
    var slides = [].slice.call(hero.querySelectorAll('.gx-slide')), pp = hero.querySelector('.gx-pp');
    if (slides.length < 2 || reduce) { if (pp) pp.hidden = true; return; }
    var DELAY = 4000, cur = 0, timer = 0, hold = false, offscreen = false, stopped = false;

    /* les photos suivantes ne se chargent qu'une fois la page affichée */
    function loadRest() {
      slides.forEach(function (s) {
        [].forEach.call(s.querySelectorAll('[data-srcset],[data-src]'), function (el) {
          var ss = el.getAttribute('data-srcset'), sr = el.getAttribute('data-src');
          if (ss) { el.setAttribute('srcset', ss); el.removeAttribute('data-srcset'); }
          if (sr) { el.setAttribute('src', sr); el.removeAttribute('data-src'); }
        });
      });
    }
    if (document.readyState === 'complete') setTimeout(loadRest, 300);
    else window.addEventListener('load', function () { setTimeout(loadRest, 300); });

    function go(n) {
      n = (n + slides.length) % slides.length;
      if (n === cur) return;
      loadRest();
      slides.forEach(function (s) { s.classList.remove('is-prev'); });
      slides[cur].classList.remove('is-active'); slides[cur].classList.add('is-prev');
      cur = n; slides[cur].classList.add('is-active');
    }
    function tick() {
      timer = 0;
      if (!(hold || offscreen || stopped || document.hidden)) go(cur + 1);
      schedule();
    }
    function schedule() { if (!timer && !stopped) timer = setTimeout(tick, DELAY); }
    var pick = hero.querySelector('.gx-pick') || hero;   /* pause pendant que l'on choisit une prestation */
    pick.addEventListener('mouseenter', function () { hold = true; });
    pick.addEventListener('mouseleave', function () { hold = false; });
    pick.addEventListener('focusin', function () { hold = true; });
    pick.addEventListener('focusout', function () { hold = false; });
    if (pp) pp.addEventListener('click', function () {
      stopped = !stopped; pp.setAttribute('aria-pressed', String(stopped));
      pp.textContent = stopped ? 'Relancer le diaporama' : 'Mettre le diaporama en pause';
      if (!stopped) schedule();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { offscreen = !es[0].isIntersecting; }).observe(hero);
    schedule();
  })();

  /* ---------- Déroulé : une étape à la fois ---------- */
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

    /* téléphone : les étapes défilent côte à côte, le compteur suit la carte la plus visible */
    var list = root.querySelector('.gx-j__list'), pos = root.querySelector('.gx-j__pos b');
    if (list && pos) {
      var t = 0;
      list.addEventListener('scroll', function () {
        if (t) return;
        t = setTimeout(function () {
          t = 0;
          var best = 0, bd = 1e9, c = list.scrollLeft + list.clientWidth / 2;
          steps.forEach(function (s, k) { var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - c); if (d < bd) { bd = d; best = k; } });
          pos.textContent = String(best + 1);
        }, 80);
      }, { passive: true });
    }
  })();
})();

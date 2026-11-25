/* REYCE — formulaire de devis « à clics » : une question par écran, un toucher = étape suivante.
   Amélioration du <form data-devis> existant : mêmes champs, même envoi (js/reyce-devis.js), même suivi
   (generate_lead puis /merci-devis). Sans JavaScript, le formulaire complet reste affiché tel quel.
   Ordre : les choix d'abord (un toucher suffit), puis le véhicule, puis les coordonnées et l'envoi.
   Avance automatique seulement au toucher ou au clic : au clavier, le bouton « Continuer » reste là.  */
(function () {
  'use strict';
  var form = document.querySelector('form[data-devis]');
  if (!form || form.getAttribute('data-service') === 'pro' || form.classList.contains('is-steps')) return;

  var kids = [].slice.call(form.children);
  var groups = kids.filter(function (el) { return el.classList.contains('lp-fgroup'); });
  var has = function (g, sel) { return !!g.querySelector(sel); };
  var choiceGroups = groups.filter(function (g) { return has(g, '.lp-choices input[type="radio"]'); });
  var vehGroup = groups.filter(function (g) { return has(g, 'input[name="marque"], input[name="modele"]'); })[0];
  var coordGroup = groups.filter(function (g) { return has(g, 'input[name="nom"]'); })[0];
  var photoGroup = groups.filter(function (g) { return has(g, 'input[type="file"]'); })[0];
  var msgEl = form.querySelector('textarea[name="message"]');
  var msgField = msgEl && msgEl.closest('.field');
  var submit = form.querySelector('[type="submit"]');
  if (!coordGroup || !submit || !choiceGroups.length) return;     // structure inattendue : on ne touche à rien

  var QUESTIONS = [
    [/^Protection souhait/i, 'Quelle protection souhaitez-vous\u00a0?'],
    [/^Durée de protection/i, 'Quelle durée de protection souhaitez-vous\u00a0?'],
    [/^Niveau souhait/i, 'Quel niveau de correction souhaitez-vous\u00a0?'],
    [/^État de la peinture/i, 'Dans quel état est la peinture\u00a0?'],
    [/^État du véhicule/i, 'Dans quel état est votre véhicule\u00a0?'],
    [/^Votre véhicule/i, 'Quel est votre véhicule\u00a0?'],
    [/^Vos coordonnées/i, 'Où vous envoyer le devis\u00a0?']
  ];
  function question(g) {
    var lab = g.querySelector('.lp-glabel'), t = lab ? lab.textContent.replace(/\s+/g, ' ').trim() : '';
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i][0].test(t)) return QUESTIONS[i][1];
    return t;
  }

  // étapes : choix -> véhicule -> coordonnées (+ photos et précisions repliées) -> envoi
  var plan = choiceGroups.slice();
  if (vehGroup) plan.push(vehGroup);
  plan.push(coordGroup);
  var n = plan.length, steps = [], cur = 0;

  var progress = document.createElement('div');
  progress.className = 'lp-progress'; progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  form.insertBefore(progress, plan[0]);

  plan.forEach(function (g, i) {
    var step = document.createElement('div');
    step.className = 'lp-step'; step.setAttribute('data-step', String(i + 1));
    var id = 'lp-q-' + (i + 1);
    step.setAttribute('role', 'group'); step.setAttribute('aria-labelledby', id);
    step.innerHTML = '<div class="lp-step__head"><p class="lp-step__count">Étape ' + (i + 1) + ' sur ' + n + '</p>' +
      (i > 0 ? '<button type="button" class="lp-back">Retour</button>' : '') + '</div><h3 class="lp-step__q" id="' + id + '" tabindex="-1"></h3>';
    step.querySelector('.lp-step__q').textContent = question(g);
    var lab = g.querySelector('.lp-glabel'); if (lab) lab.classList.add('is-q');
    form.insertBefore(step, g);
    step.appendChild(g);
    if (i === n - 1) {
      var extra = [photoGroup, msgField].filter(Boolean);
      if (extra.length) {
        var more = document.createElement('details');
        more.className = 'lp-more';
        more.innerHTML = '<summary>Ajouter des photos ou une précision (facultatif)</summary>';
        extra.forEach(function (el) { more.appendChild(el); });
        step.appendChild(more);
      }
      // bouton d'envoi, WhatsApp, consentement et message d'erreur : dans la dernière étape
      kids.forEach(function (el) {
        if (el === submit || el.classList.contains('lp-wa') || el.classList.contains('lp-consent') || el.classList.contains('lp-err')) step.appendChild(el);
      });
    }
    if (i < n - 1) {
      var nav = document.createElement('div');
      nav.className = 'lp-step__nav';
      nav.innerHTML = '<button type="button" class="btn solid lp-next">Continuer</button>';
      step.appendChild(nav);
    }
    steps.push(step);
  });
  // les étapes dans l'ordre du parcours, juste après la barre de progression
  steps.forEach(function (s) { form.appendChild(s); });
  form.insertBefore(progress, steps[0]);

  // page Tesla : la marque est déjà connue
  var cible = form.elements['cible'] && form.elements['cible'].value;
  if (cible === 'tesla' && form.elements['marque'] && !form.elements['marque'].value) form.elements['marque'].value = 'Tesla';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(i, focus) {
    cur = Math.max(0, Math.min(n - 1, i));
    steps.forEach(function (s, k) { s.hidden = k !== cur; });
    progress.firstChild.style.width = Math.round((cur + 1) / n * 100) + '%';
    if (!focus) return;
    var top = form.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) {
      try { window.scrollTo({ top: window.scrollY + top - 90, behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, window.scrollY + top - 90); }
    }
    var q = steps[cur].querySelector('.lp-step__q'); try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); }
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'devis_etape', etape: cur + 1, etapes: n, service: form.getAttribute('data-service') || '' }); } catch (e) {}
  }
  form.classList.add('is-steps');
  show(0, false);

  // barre fixe du bas (téléphone) : masquée tant que le formulaire est à l'écran, pour ne jamais couvrir ses boutons
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      document.body.classList.toggle('lp-form-in-view', en[0].isIntersecting);
    }, { threshold: 0.15 }).observe(form);
  }

  // un toucher ou un clic sur un choix = étape suivante (au clavier, rien d'automatique)
  var armed = false, timer = null;
  form.addEventListener('pointerdown', function (e) { armed = !!(e.target.closest && e.target.closest('.lp-choice')); }, true);
  form.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('.lp-back')) { show(cur - 1, true); return; }
    if (t.closest('.lp-next')) { show(cur + 1, true); return; }
    if (armed && t.matches && t.matches('input[type="radio"]') && steps[cur].contains(t) && cur < n - 1) {
      armed = false; clearTimeout(timer);
      timer = setTimeout(function () { show(cur + 1, true); }, 260);
    }
  });
  // Entrée dans un champ avant la dernière étape : on avance au lieu d'envoyer un formulaire incomplet
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && cur < n - 1 && e.target.matches && e.target.matches('input:not([type="radio"]):not([type="file"])')) {
      e.preventDefault(); show(cur + 1, true);
    }
  });
})();

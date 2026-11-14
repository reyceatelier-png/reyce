/* REYCE — soirée privée du 3 décembre 2026 : compte à rebours, diaporama, formulaire de réponse.
   Aucune bibliothèque. La réponse part vers /api/soiree/rsvp et arrive dans l'onglet « Soirée » du CRM. */
(function () {
  'use strict';

  var EVENT = { startUtc: Date.UTC(2026, 11, 3, 18, 30), endUtc: Date.UTC(2026, 11, 3, 21, 30), y: 2026, m: 12, d: 3 }; // 19 h 30 – 22 h 30, heure de Paris (UTC+1)
  var PLACE = 'Atelier REYCE, 47 chemin du Pras, 69350 La Mulatière';
  var PHONE = '07 63 00 43 85';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var smooth = reduce ? 'auto' : 'smooth';

  /* ---------- compte à rebours (en jours, date de Paris) ---------- */
  (function countdown() {
    var el = $('count'); if (!el) return;
    var today;
    try {
      var o = {};
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      today = Date.UTC(+o.year, +o.month - 1, +o.day);
    } catch (e) {
      var n = new Date(Date.now() + 3600e3);
      today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    }
    var days = Math.round((Date.UTC(EVENT.y, EVENT.m - 1, EVENT.d) - today) / 864e5);
    el.textContent = days > 1 ? 'Dans ' + days + ' jours' : days === 1 ? 'Demain' : (days === 0 && Date.now() < EVENT.endUtc ? 'Ce soir' : '');
  })();

  /* ---------- formulaire ---------- */
  (function rsvp() {
    var form = $('rsvpForm'); if (!form) return;
    var btn = $('send'), msg = $('msg');
    var formBox = $('formBox'), done = $('done');
    var persBox = $('persBox'), allergBox = $('allergBox');
    var code = (new URLSearchParams(window.location.search).get('i') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);   // code du lien personnel
    var sending = false;

    function radio(name) {
      var r = form.querySelectorAll('input[name="' + name + '"]');
      for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
      return '';
    }
    function field(name) { var e = form.elements[name]; return e && e.length && !e.tagName ? e[0] : e; }   /* un champ, ou le premier d'un groupe de boutons radio */
    function box(name) { var f = field(name); return f && f.closest('.field'); }
    function setError(name, text) {
      var b = box(name), e = $('e-' + name), f = field(name);
      if (!b || !e) return;
      b.classList.toggle('is-invalid', !!text);
      e.hidden = !text; e.textContent = text || '';
      if (f && f.type !== 'radio') { if (text) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }
    }

    var RULES = [
      ['prenom', function (v) { return v.trim() ? '' : 'Merci d’indiquer votre prénom.'; }],
      ['nom', function (v) { return v.trim() ? '' : 'Merci d’indiquer votre nom.'; }],
      ['email', function (v) { return /^[^\s@<>"'`\\]+@[^\s@<>"'`\\]+\.[^\s@<>"'`\\]{2,}$/.test(v.trim()) ? '' : 'Merci d’indiquer une adresse e-mail valide, par exemple prenom@exemple.fr.'; }],
      ['telephone', function (v) { return v.replace(/\D/g, '').length >= 9 ? '' : 'Merci d’indiquer un numéro de téléphone valide (au moins 9 chiffres).'; }],
      ['reponse', function () { return radio('reponse') ? '' : 'Merci de nous dire si vous serez présent(e).'; }]
    ];
    function check(name) {
      for (var i = 0; i < RULES.length; i++) if (RULES[i][0] === name) {
        var f = field(name), t = RULES[i][1](f && f.type !== 'radio' ? f.value : '');
        setError(name, t); return !t;
      }
      return true;
    }
    function checkAll() {
      var first = null;
      RULES.forEach(function (r) { if (!check(r[0]) && !first) first = field(r[0]); });
      return first;
    }
    /* une fois l'erreur affichée, elle disparaît dès que le champ est corrigé */
    RULES.forEach(function (r) {
      var els = form.querySelectorAll('[name="' + r[0] + '"]');
      for (var i = 0; i < els.length; i++) {
        els[i].addEventListener(els[i].type === 'radio' ? 'change' : 'blur', function () { check(r[0]); });
        if (els[i].type !== 'radio') els[i].addEventListener('input', function () { if (box(r[0]).classList.contains('is-invalid')) check(r[0]); });
      }
    });

    function sync() {
      var present = radio('reponse') === 'present';
      persBox.hidden = !present; allergBox.hidden = !present;
      btn.textContent = present ? 'Confirmer ma présence' : 'Envoyer ma réponse';
    }
    [].forEach.call(form.querySelectorAll('input[name="reponse"]'), function (r) { r.addEventListener('change', sync); });
    sync();

    function stamp(t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    function gcal() {
      return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Soirée privée REYCE') +
        '&dates=' + stamp(EVENT.startUtc) + '/' + stamp(EVENT.endUtc) + '&ctz=Europe/Paris&location=' + encodeURIComponent(PLACE) +
        '&details=' + encodeURIComponent('Tenue élégante. Une question : ' + PHONE + '.');
    }
    /* « zoé » → « Zoé », « jean-pierre » → « Jean-Pierre » ; un prénom déjà saisi avec des majuscules et minuscules est laissé tel quel */
    function cap(s) {
      if (!s) return s;
      if (s === s.toLowerCase() || s === s.toUpperCase()) s = s.toLowerCase();
      return s.replace(/(^|[\s'’-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
    }

    function showDone(p, r) {
      var present = p.reponse === 'present';
      $('doneTag').textContent = present ? 'Confirmé' : 'Bien reçu';
      $('doneTitle').textContent = present ? 'À jeudi, ' + cap(p.prenom) + '.' : 'Merci.';
      $('doneText').textContent = present
        ? (r.emailed ? 'Votre place est réservée. Une confirmation vient de vous être envoyée par e-mail.' : 'Votre place est réservée. Ajoutez la soirée à votre agenda ci-dessous.')
        : 'Nous avons bien noté que vous ne pourrez pas venir. Vous nous manquerez.';
      $('doneWhen').hidden = !present;
      $('gcal').href = gcal();
      formBox.hidden = true; done.hidden = false;
      done.focus({ preventScroll: true });
      done.scrollIntoView({ behavior: smooth, block: 'center' });
    }
    $('edit').addEventListener('click', function () {
      done.hidden = true; formBox.hidden = false; msg.textContent = '';
      formBox.scrollIntoView({ behavior: smooth, block: 'start' });
      field('prenom').focus({ preventScroll: true });
    });

    function fail(text) { msg.textContent = text; }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (sending) return;
      msg.textContent = '';
      var bad = checkAll();
      if (bad) { bad.focus(); return; }

      var p = {
        prenom: field('prenom').value.trim(), nom: field('nom').value.trim(), email: field('email').value.trim(),
        telephone: field('telephone').value.trim(), reponse: radio('reponse'),
        personnes: radio('reponse') === 'present' ? Number(radio('personnes') || 1) : 0,
        allergies: radio('reponse') === 'present' ? field('allergies').value.trim() : '',
        website: field('website').value, code: code
      };
      sending = true; btn.disabled = true;
      var label = btn.textContent; btn.textContent = 'Envoi en cours…';

      fetch('/api/soiree/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { status: res.status, d: d }; }); })
        .then(function (o) {
          if (o.d && o.d.ok) {
            /* événement de suivi : uniquement la réponse, aucune donnée personnelle ; ce n'est PAS une conversion publicitaire */
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: 'soiree_rsvp', reponse: p.reponse });
            showDone(p, o.d);
            return;
          }
          var f = o.d && o.d.field;
          if (f && box(f)) { setError(f, o.d.error); field(f).focus(); }
          else fail((o.d && o.d.error) || 'Votre réponse n’a pas pu être envoyée. Réessayez dans un instant, ou appelez-nous au ' + PHONE + '.');
        })
        .catch(function () { fail('Connexion impossible. Vérifiez votre réseau et réessayez, ou appelez-nous au ' + PHONE + '.'); })
        .then(function () { sending = false; btn.disabled = false; btn.textContent = label; });
    });
  })();
})();

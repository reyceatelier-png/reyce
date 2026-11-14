/* REYCE — invitation privée : ouverture, événement, invité reconnu, compte à rebours, formulaire de réponse.
   Aucune bibliothèque. La réponse part vers /api/events/<événement>/rsvp et arrive dans l'onglet « Événements » du CRM. */
(function () {
  'use strict';

  var DEFAULT_SLUG = 'soiree-reyce-2026-12-03';
  var PHONE = '07 63 00 43 85';
  var q = new URLSearchParams(window.location.search);
  var SLUG = /^[a-z0-9-]{3,80}$/.test(q.get('e') || '') ? q.get('e') : DEFAULT_SLUG;
  var CODE = (q.get('i') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);          // code du lien personnel (opaque)
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var smooth = reduce ? 'auto' : 'smooth';

  /* l'événement : valeurs par défaut (soirée du 3 décembre), remplacées par la fiche du CRM dès qu'elle est lue */
  var EV = {
    slug: SLUG, name: 'Soirée REYCE', startUtc: '2026-12-03T18:30:00.000Z', endUtc: '2026-12-03T21:30:00.000Z',
    place: 'Atelier REYCE', address: '47 chemin du Pras, 69350 La Mulatière', dressCode: 'Tenue élégante', deadline: '', closed: false,
    mapsUrl: '', gcalUrl: ''
  };
  var TZ = 'Europe/Paris';
  function fmt(opts, iso) { try { return new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: TZ }, opts)).format(new Date(iso)); } catch (e) { return ''; } }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function name(s) {                                                                                  // « zoé » → « Zoé », « jean-pierre » → « Jean-Pierre »
    if (!s) return s;
    if (s === s.toLowerCase() || s === s.toUpperCase()) s = s.toLowerCase();
    return s.replace(/(^|[\s'’-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function hhmm(iso) { return fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, iso).replace(':', 'h'); }
  function stamp(t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function placeFull() { return [EV.place, EV.address].filter(Boolean).join(', '); }
  function mapsUrl() { return EV.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(placeFull()); }
  function gcalUrl() {
    return EV.gcalUrl || 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(EV.name) + '&dates=' + stamp(EV.startUtc) + '/' + stamp(EV.endUtc) +
      '&ctz=Europe/Paris&location=' + encodeURIComponent(placeFull()) + '&details=' + encodeURIComponent((EV.dressCode ? EV.dressCode + '. ' : '') + 'Une question : ' + PHONE + '.');
  }
  function icsUrl() { return '/api/events/' + EV.slug + '/calendar.ics'; }

  /* ---------- ouverture : reflet sur le monogramme, contournable ---------- */
  (function intro() {
    var el = $('intro'); if (!el) return;
    var done = false;
    function end() {
      if (done) return; done = true;
      root.classList.remove('opening');
      try { sessionStorage.setItem('rv-intro', '1'); } catch (e) {}
      document.removeEventListener('keydown', end); el.removeEventListener('pointerdown', end);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 50);
    }
    if (!root.classList.contains('opening')) { end(); return; }
    el.addEventListener('pointerdown', end); document.addEventListener('keydown', end);
    el.addEventListener('animationend', function (e) { if (e.animationName === 'introOut') end(); });
    setTimeout(end, 4200);                                                                           // filet de sécurité : l'invitation n'est jamais retenue
  })();

  /* ---------- texte de la page selon l'événement ---------- */
  function applyEvent() {
    var d = new Date(EV.startUtc); if (isNaN(d)) return;
    var weekday = cap(fmt({ weekday: 'long' }, EV.startUtc)), day = fmt({ day: 'numeric', month: 'long' }, EV.startUtc);
    var h1 = $('heroDate'); if (h1) { h1.textContent = ''; h1.appendChild(document.createTextNode(weekday + ' ')); var sp = document.createElement('span'); sp.className = 'nb'; sp.textContent = day; h1.appendChild(sp); }
    var when = $('heroWhen');
    if (when) {
      when.textContent = '';
      [hhmm(EV.startUtc), EV.place + ',', EV.address.split(',')[0] + ',', (EV.address.split(',')[1] || '').trim()].filter(function (x) { return x && x !== ','; }).forEach(function (t, i, a) {
        var s = document.createElement('span'); s.className = 'nb'; s.textContent = t; when.appendChild(s);
        if (i === 0) when.appendChild(document.createTextNode(' · ')); else if (i < a.length - 1) when.appendChild(document.createTextNode(' '));
      });
    }
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('cardTitle', weekday + ' ' + day + ' ' + fmt({ year: 'numeric' }, EV.startUtc));
    set('cardTime', hhmm(EV.startUtc) + ' – ' + hhmm(EV.endUtc));
    var pl = $('cardPlace'); if (pl) { pl.textContent = ''; [EV.place].concat(EV.address.split(',').map(function (x) { return x.trim(); })).filter(Boolean).forEach(function (t, i) { if (i) pl.appendChild(document.createElement('br')); pl.appendChild(document.createTextNode(t)); }); }
    var dr = $('cardDressRow'); if (dr) { dr.hidden = !EV.dressCode; set('cardDress', EV.dressCode.replace(/^Tenue\s+/i, function () { return ''; }).replace(/^./, function (c) { return c.toUpperCase(); })); }
    var links = { routeLink: mapsUrl(), cardGcal: gcalUrl(), route: mapsUrl(), gcal: gcalUrl() };
    Object.keys(links).forEach(function (id) { var a = $(id); if (a) a.href = links[id]; });
    ['cardIcs', 'ics'].forEach(function (id) { var a = $(id); if (a) a.href = icsUrl(); });
    document.title = EV.name + ' — ' + weekday.toLowerCase() + ' ' + day + ', ' + hhmm(EV.startUtc);
    countdown();
  }
  function countdown() {
    var el = $('count'); if (!el) return;
    var today;
    try { var o = {}; new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; }); today = Date.UTC(+o.year, +o.month - 1, +o.day); }
    catch (e) { var n = new Date(Date.now() + 3600e3); today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); }
    var p = {}; try { new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(EV.startUtc)).forEach(function (x) { p[x.type] = x.value; }); } catch (e) { return; }
    var days = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - today) / 864e5);
    el.textContent = days > 1 ? 'Dans ' + days + ' jours' : days === 1 ? 'Demain' : (days === 0 && Date.now() < Date.parse(EV.endUtc) ? 'Ce soir' : '');
  }
  applyEvent();

  /* ---------- apparitions sobres au défilement ---------- */
  (function reveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var els = [].slice.call(document.querySelectorAll('.lead, .blocks li, .meta, .card__inner, .teaser__copy, .rsvp__box > .eyebrow, .rsvp__box > h2'));
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (e, i) { e.classList.add('rv'); e.style.transitionDelay = ((i % 4) * 90) + 'ms'; io.observe(e); });
  })();

  /* ---------- formulaire ---------- */
  var form = $('rsvpForm'); if (!form) return;
  var btn = $('send'), msg = $('msg'), formBox = $('formBox'), done = $('done');
  var persBox = $('persBox'), allergBox = $('allergBox'), idFields = $('idFields'), known = $('known');
  var sending = false, knownMode = false, knownFirst = '', needsEmail = false;

  function radio(n) { var r = form.querySelectorAll('input[name="' + n + '"]'); for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value; return ''; }
  function field(n) { var e = form.elements[n]; return e && e.length && !e.tagName ? e[0] : e; }
  function box(n) { var f = field(n); return f && f.closest('.field'); }
  function setError(n, text) {
    var b = box(n), e = $('e-' + n), f = field(n); if (!b || !e) return;
    b.classList.toggle('is-invalid', !!text); e.hidden = !text; e.textContent = text || '';
    if (f && f.type !== 'radio') { if (text) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }
  }
  var RULES = [
    ['prenom', function (v) { return v.trim() ? '' : 'Merci d’indiquer votre prénom.'; }, true],
    ['nom', function (v) { return v.trim() ? '' : 'Merci d’indiquer votre nom.'; }, true],
    ['email', function (v) { return /^[^\s@<>"'`\\]+@[^\s@<>"'`\\]+\.[^\s@<>"'`\\]{2,}$/.test(v.trim()) ? '' : 'Merci d’indiquer une adresse e-mail valide, par exemple prenom@exemple.fr.'; }, true],
    ['telephone', function (v) { return v.replace(/\D/g, '').length >= 9 ? '' : 'Merci d’indiquer un numéro de téléphone valide (au moins 9 chiffres).'; }, true],
    ['reponse', function () { return radio('reponse') ? '' : 'Merci de nous dire si vous serez présent(e).'; }, false]
  ];
  function check(n) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0] === n) {
      var f = field(n), t = '';
      if (knownMode && n !== 'reponse') {                                                                 // invité reconnu : identité déjà connue, l'e-mail reste facultatif
        if (n === 'email' && f && f.value.trim()) t = RULES[i][1](f.value);
      } else t = RULES[i][1](f && f.type !== 'radio' ? f.value : '');
      setError(n, t); return !t;
    }
    return true;
  }
  function checkAll() { var first = null; RULES.forEach(function (r) { if (!check(r[0]) && !first) first = field(r[0]); }); return first; }
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

  /* ---------- invité reconnu par son lien personnel : seul le prénom est lu, jamais l'adresse ni le téléphone ---------- */
  function setKnown(first, st) {
    knownMode = true; knownFirst = first;
    idFields.hidden = true;
    if (needsEmail) { idFields.hidden = false; ['prenom', 'nom', 'telephone'].forEach(function (n) { var b = box(n); if (b) b.hidden = true; }); var eb = box('email'); if (eb) { eb.hidden = false; eb.querySelector('label').textContent = 'E-mail (facultatif, pour recevoir votre confirmation)'; } }
    known.hidden = false; known.textContent = '';
    var b = document.createElement('b'); b.textContent = name(first); known.appendChild(document.createTextNode('Vous répondez en tant que ')); known.appendChild(b); known.appendChild(document.createTextNode('. '));
    var nb = document.createElement('button'); nb.type = 'button'; nb.textContent = 'Ce n’est pas vous ?'; nb.addEventListener('click', unknown); known.appendChild(nb);
    var eye = $('eyebrow'); if (eye) eye.textContent = 'Invitation privée · ' + name(first);
    if (st && st.status && st.status !== 'pending') {
      var r = form.querySelector('input[name="reponse"][value="' + (st.status === 'confirmed' ? 'present' : 'absent') + '"]'); if (r) { r.checked = true; sync(); }
      if (st.status === 'confirmed') { if (st.companions) form.querySelector('#p-2').checked = true; if (st.allergies) field('allergies').value = st.allergies; }
      var note = document.createElement('p'); note.className = 'known-note'; note.id = 'knownNote';
      note.textContent = 'Vous avez déjà répondu : ' + (st.status === 'confirmed' ? 'présence confirmée' : 'invitation déclinée') + '. Vous pouvez modifier votre réponse.'; known.parentNode.insertBefore(note, form);
    }
  }
  function unknown() {                                                                                   // lien transféré : répondre pour soi-même
    knownMode = false; CODE = ''; idFields.hidden = false; known.hidden = true;
    ['prenom', 'nom', 'telephone'].forEach(function (n) { var b = box(n); if (b) b.hidden = false; });
    var eb = box('email'); if (eb) eb.querySelector('label').textContent = 'E-mail';
    var n = $('knownNote'); if (n) n.parentNode.removeChild(n);
    var eye = $('eyebrow'); if (eye) eye.textContent = 'Invitation privée';
    field('prenom').focus({ preventScroll: true });
  }

  function showDone(p, r) {
    var present = p.reponse === 'present'; var first = name(r.firstName || p.prenom || knownFirst);
    $('doneTag').textContent = present ? 'Confirmé' : 'Bien reçu';
    $('doneTitle').textContent = present ? 'À jeudi, ' + first + '.' : 'Merci.';
    $('doneText').textContent = present
      ? (r.emailed ? 'Votre place est réservée. Une confirmation vient de vous être envoyée par e-mail.' : 'Votre place est réservée. Ajoutez la soirée à votre agenda ci-dessous.')
      : 'Nous avons bien noté que vous ne pourrez pas venir. Vous nous manquerez.';
    if (present) { var w = hhmm(EV.startUtc); $('doneWhen').querySelector('.done__date').textContent = cap(fmt({ weekday: 'long', day: 'numeric', month: 'long' }, EV.startUtc)) + ', ' + w; }
    $('doneWhen').hidden = !present;
    var pl = $('doneWhen').querySelector('.done__place'); if (pl) pl.textContent = placeFull();
    $('gcal').href = gcalUrl(); $('route').href = mapsUrl(); $('ics').href = icsUrl();
    formBox.hidden = true; done.hidden = false;
    done.focus({ preventScroll: true });
    done.scrollIntoView({ behavior: smooth, block: 'center' });
  }
  $('edit').addEventListener('click', function () {
    done.hidden = true; formBox.hidden = false; msg.textContent = '';
    formBox.scrollIntoView({ behavior: smooth, block: 'start' });
    var f = knownMode ? form.querySelector('input[name="reponse"]') : field('prenom'); if (f) f.focus({ preventScroll: true });
  });

  function fail(text) { msg.textContent = text; }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return; msg.textContent = '';
    if (EV.closed) { fail('Les réponses sont closes. Appelez-nous au ' + PHONE + '.'); return; }
    var bad = checkAll(); if (bad) { bad.focus(); return; }
    var present = radio('reponse') === 'present';
    var p = {
      code: CODE, reponse: radio('reponse'), personnes: present ? Number(radio('personnes') || 1) : 0, allergies: present ? field('allergies').value.trim() : '', website: field('website').value
    };
    if (!knownMode) { p.prenom = field('prenom').value.trim(); p.nom = field('nom').value.trim(); p.telephone = field('telephone').value.trim(); }
    p.email = field('email').value.trim();
    sending = true; btn.disabled = true;
    var label = btn.textContent; btn.textContent = 'Envoi en cours…';
    fetch('/api/events/' + encodeURIComponent(SLUG) + '/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { status: res.status, d: d }; }); })
      .then(function (o) {
        if (o.d && o.d.ok) {
          /* suivi : uniquement la réponse, aucune donnée personnelle ; ce n'est PAS une conversion publicitaire */
          window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'soiree_rsvp', reponse: p.reponse });
          showDone(p, o.d); return;
        }
        var f = o.d && o.d.field;
        if (f && box(f) && !box(f).hidden) { setError(f, o.d.error); field(f).focus(); }
        else fail((o.d && o.d.error) || 'Votre réponse n’a pas pu être envoyée. Réessayez dans un instant, ou appelez-nous au ' + PHONE + '.');
      })
      .catch(function () { fail('Connexion impossible. Vérifiez votre réseau et réessayez, ou appelez-nous au ' + PHONE + '.'); })
      .then(function () { sending = false; btn.disabled = false; btn.textContent = label; });
  });

  /* ---------- lecture de la fiche de l'événement et du lien personnel ---------- */
  fetch('/api/events/' + encodeURIComponent(SLUG) + '/public').then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok && d.event) {
      EV = Object.assign(EV, d.event, { closed: !!d.closed }); applyEvent();
      if (EV.closed) { var m = document.createElement('p'); m.className = 'known-note'; m.textContent = 'Les réponses sont closes. Une question ? Appelez-nous au ' + PHONE + '.'; form.parentNode.insertBefore(m, form); btn.disabled = true; }
    }
  }).catch(function () { /* la page garde ses valeurs par défaut */ });
  if (CODE.length === 10) {
    idFields.style.visibility = 'hidden';                                                               // évite d'afficher puis de retirer les champs d'identité
    fetch('/api/events/' + encodeURIComponent(SLUG) + '/invite/' + CODE).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok && d.firstName) { needsEmail = !!d.needsEmail; setKnown(d.firstName, d); }
    }).catch(function () { /* le formulaire complet reste disponible */ }).then(function () { idFields.style.visibility = ''; });
  }
})();

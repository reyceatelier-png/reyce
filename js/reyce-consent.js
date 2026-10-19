/* REYCE — consentement aux cookies + Consent Mode v2 (mode « de base »).

   Principe : tant que la personne n'a pas accepté, GTM n'est PAS chargé. Aucune
   requête ne part vers Google (Analytics, Ads, DoubleClick) ni Meta, et aucun
   cookie publicitaire n'est déposé. Le défaut « refusé » est déclaré dans la page
   (avant ce script) ; ce fichier met à jour le consentement puis charge GTM
   uniquement si la personne a accepté au moins une catégorie.

   Deux catégories optionnelles :
     - analytics : mesure d'audience            -> analytics_storage
     - ads       : publicité et marketing       -> ad_storage, ad_user_data,
                   (Google Ads, pixel Meta)        ad_personalization
   Le choix est conservé 6 mois, puis redemandé.                                   */
(function () {
  'use strict';

  var GTM_ID = 'GTM-PLVLP89M';
  var KEY = 'reyce_consent_v1';
  var MAX_AGE = 180 * 24 * 60 * 60 * 1000; // 6 mois
  var ATTR_KEY = 'reyce_attr';

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') { window.gtag = function () { window.dataLayer.push(arguments); }; }

  var gtmLoaded = false;
  var current = null;     // choix en vigueur, ou null
  var root = null;        // bannière
  var returnFocus = null;

  /* ---------- stockage ---------- */
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v || typeof v.ts !== 'number' || Date.now() - v.ts > MAX_AGE) return null;
      return { analytics: !!v.analytics, ads: !!v.ads, ts: v.ts };
    } catch (e) { return null; }
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  /* ---------- cookies Google / Meta déjà posés : retirés au retrait du consentement ---------- */
  function clearTrackingCookies() {
    var host = location.hostname, parts = host.split('.');
    var domains = [host, '.' + host];
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^(_ga|_gid|_gat|_gcl_|_gac_|_fbp|_fbc|FPLC)/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + d;
      });
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    });
  }

  /* ---------- attribution des clics publicitaires (uniquement avec le consentement « ads ») ---------- */
  function captureAttribution() {
    try {
      if (sessionStorage.getItem(ATTR_KEY)) return;
      var q = new URLSearchParams(location.search), out = {}, any = false;
      ['gclid', 'utm_source', 'utm_campaign', 'utm_term'].forEach(function (k) {
        var v = q.get(k); if (v) { out[k] = v.slice(0, 120); any = true; }
      });
      if (!any) return;
      out.page = location.pathname; // jamais l'URL complète
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(out));
    } catch (e) {}
  }
  function clearAttribution() { try { sessionStorage.removeItem(ATTR_KEY); } catch (e) {} }
  window.reyceAttribution = {
    get: function () {
      if (!current || !current.ads) return null;
      try { return JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { return null; }
    }
  };
  window.reyceConsent = { get: function () { return current ? { analytics: current.analytics, ads: current.ads } : null; } };

  /* ---------- GTM : chargé seulement après accord ---------- */
  function loadGTM() {
    if (gtmLoaded) return;
    gtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
  }

  function apply(s) {
    var before = current;
    current = s;
    gtag('consent', 'update', {
      analytics_storage: s.analytics ? 'granted' : 'denied',
      ad_storage: s.ads ? 'granted' : 'denied',
      ad_user_data: s.ads ? 'granted' : 'denied',
      ad_personalization: s.ads ? 'granted' : 'denied'
    });
    if (s.ads) captureAttribution(); else clearAttribution();
    if (s.analytics || s.ads) loadGTM();
    if (before && ((before.analytics && !s.analytics) || (before.ads && !s.ads))) clearTrackingCookies();
    window.dataLayer.push({ event: 'reyce_consent', consent_analytics: !!s.analytics, consent_ads: !!s.ads });
    document.dispatchEvent(new CustomEvent('reyce:consent', { detail: { analytics: s.analytics, ads: s.ads } }));
  }

  function choose(analytics, ads) {
    var s = { analytics: !!analytics, ads: !!ads, ts: Date.now() };
    write(s);
    apply(s);
    close();
  }

  /* ---------- interface ---------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function btn(label, cls, fn) {
    var b = el('button', { type: 'button', 'class': cls, text: label });
    b.addEventListener('click', fn); return b;
  }
  function toggle(id, titre, desc, checked, locked) {
    var input = el('input', { type: 'checkbox', id: id });
    input.checked = !!checked; if (locked) { input.disabled = true; input.checked = true; }
    var label = el('label', { 'for': id, 'class': 'cc-row' }, [
      el('span', { 'class': 'cc-row-t' }, [el('b', { text: titre }), el('small', { text: desc })]),
      input, el('span', { 'class': 'cc-sw', 'aria-hidden': 'true' })
    ]);
    return { node: label, input: input };
  }

  function build(startInPanel) {
    var a = toggle('cc-analytics', 'Mesure d’audience', 'Statistiques de fréquentation (Google Analytics), pour améliorer le site.', current && current.analytics);
    var p = toggle('cc-ads', 'Publicité et marketing', 'Mesure des résultats de nos annonces (Google Ads) et, si activé, de nos campagnes Meta.', current && current.ads);
    var n = toggle('cc-necessary', 'Strictement nécessaires', 'Toujours actifs : mémorisent votre choix et le bon fonctionnement du site. Aucune donnée personnelle.', true, true);

    var main = el('div', { 'class': 'cc-main' }, [
      el('p', { 'class': 'cc-text', text: 'REYCE utilise des cookies pour mesurer l’audience du site et l’efficacité de ses annonces. Rien n’est activé sans votre accord, et vous pouvez changer d’avis à tout moment depuis « Gérer les cookies », en bas de page.' }),
      el('p', { 'class': 'cc-text' }, [
        el('a', { href: 'confidentialite.html', text: 'Politique de confidentialité' })
      ]),
      el('div', { 'class': 'cc-actions' }, [
        btn('Tout refuser', 'cc-btn', function () { choose(false, false); }),
        btn('Tout accepter', 'cc-btn', function () { choose(true, true); })
      ]),
      btn('Personnaliser', 'cc-link', function () { showPanel(true); })
    ]);

    var panel = el('div', { 'class': 'cc-panel', hidden: '' }, [
      n.node, a.node, p.node,
      el('div', { 'class': 'cc-actions' }, [
        btn('Tout refuser', 'cc-btn', function () { choose(false, false); }),
        btn('Enregistrer mes choix', 'cc-btn', function () { choose(a.input.checked, p.input.checked); }),
        btn('Tout accepter', 'cc-btn', function () { choose(true, true); })
      ])
    ]);

    var box = el('div', { id: 'cc', role: 'dialog', 'aria-labelledby': 'cc-title', 'aria-modal': 'false', tabindex: '-1', 'class': 'cc' }, [
      el('div', { 'class': 'cc-head' }, [el('h2', { id: 'cc-title', text: 'Vos choix sur les cookies' })]),
      main, panel
    ]);
    if (current) { // déjà un choix : on peut fermer sans rien changer
      box.querySelector('.cc-head').appendChild(btn('Fermer', 'cc-x', function () { close(); }));
    }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!panel.hidden && !current) showPanel(false); else if (current) close(); }
    });
    box._main = main; box._panel = panel;
    if (startInPanel) showPanel(true, box);
    return box;
  }

  function showPanel(on, box) {
    box = box || root; if (!box) return;
    box._panel.hidden = !on; box._main.hidden = on;
    var first = on ? box._panel.querySelector('input:not([disabled]), button') : box._main.querySelector('button');
    if (first) first.focus();
  }

  function open(startInPanel) {
    if (root) return;
    returnFocus = document.activeElement;
    root = build(!!startInPanel);
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.classList.add('on'); root.focus({ preventScroll: true }); });
  }
  function close() {
    if (!root) return;
    var r = root; root = null;
    r.classList.remove('on');
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 250);
    if (returnFocus && returnFocus.focus && document.contains(returnFocus)) { try { returnFocus.focus(); } catch (e) {} }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cc-open]');
    if (!t) return;
    e.preventDefault(); open(true);
  });

  function start() {
    var saved = read();
    if (saved) apply(saved); else open(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

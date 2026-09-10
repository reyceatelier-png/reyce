/* REYCE — formulaires de devis spécialisés + tracking Google Ads / GTM
   Chargé uniquement sur les landing pages PPF / Polissage / Céramique.

   Conversion : l'événement `generate_lead` n'est poussé dans le dataLayer
   QUE lorsque le serveur a réellement accepté la demande (res.ok). Un simple
   clic sur « Envoyer » ne déclenche jamais la conversion. Après succès, la
   page redirige vers /merci-devis.html?service=… (page destination Ads).      */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  function push(obj) { try { window.dataLayer.push(obj); } catch (e) {} }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var svcBody = document.body.getAttribute('data-lp-service') || '';

  /* ---------- Tracking clics CTA + téléphone (délégation) ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      push({ event: 'tel_click', service: svcBody });
    } else if (a.hasAttribute('data-cta')) {
      push({ event: 'cta_click', cta: a.getAttribute('data-cta') || 'devis', service: svcBody });
    }
  }, true);

  /* ---------- Barre CTA collante (mobile) ---------- */
  var sticky = document.querySelector('.lp-sticky');
  if (sticky) {
    var hero = document.querySelector('.phero');
    var onScroll = function () {
      var trigger = hero ? hero.offsetHeight * 0.85 : 500;
      sticky.classList.toggle('on', window.scrollY > trigger);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Formulaire de devis qualifiant ---------- */
  var form = document.querySelector('form[data-devis]');
  if (!form) return;

  var service = form.getAttribute('data-service') || 'devis';
  var wrap    = form.closest('[data-lp-form-wrap]') || form.parentElement;
  var errEl   = wrap.querySelector('.lp-err');
  var btn     = form.querySelector('[type="submit"]');
  var btnText = btn ? btn.textContent : '';

  function showErr(msg) {
    if (errEl) { errEl.textContent = msg; errEl.classList.add('on'); }
    if (btn) { btn.disabled = false; btn.textContent = btnText; }
  }
  function val(name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : '';
  }
  function splitName(full) {
    var p = full.split(/\s+/).filter(Boolean);
    return { firstName: p.shift() || full, lastName: p.join(' ') };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (errEl) errEl.classList.remove('on');

    var nom   = val('nom');
    var email = val('email');
    var phone = val('phone');

    if (!nom) return showErr('Merci d’indiquer votre nom.');
    if (!phone) return showErr('Un numéro de téléphone est nécessaire pour vous recontacter.');
    if (!email || !EMAIL_RE.test(email)) return showErr('Merci d’indiquer une adresse e-mail valide.');

    if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }

    var nm = splitName(nom);

    /* --- composition du message qualifiant --- */
    var vParts = [val('marque'), val('modele'), val('annee'), val('couleur')].filter(Boolean);
    var vehicleInfo = vParts.join(' · ');

    var lines = [];
    var proteg = form.querySelector('input[name="protection"]:checked');
    var etat   = form.querySelector('input[name="etat"]:checked');
    if (proteg) lines.push('Prestation souhaitée : ' + proteg.value);
    if (etat)   lines.push('État du véhicule : ' + etat.value);
    var extra = val('message');
    if (extra) lines.push(extra);
    var message = lines.join('\n');

    var subjectMap = { ppf: 'Devis PPF', polissage: 'Devis polissage', ceramique: 'Devis céramique' };
    var subject = subjectMap[service] || 'Demande de devis';
    var sourceTag = 'Landing ' + service + (window.location.search || '');

    var files = form.elements['photos'] && form.elements['photos'].files;
    var done = function (ok) {
      if (!ok) {
        showErr('L’envoi a échoué. Réessayez dans un instant, ou appelez-nous directement.');
        return;
      }
      push({ event: 'generate_lead', service: service, form_location: 'landing_' + service, currency: 'EUR', value: 0 });
      var target = 'merci-devis.html?service=' + encodeURIComponent(service);
      setTimeout(function () { window.location.href = target; }, 250);
    };

    if (files && files.length) {
      var fd = new FormData();
      fd.append('firstName', nm.firstName);
      fd.append('lastName', nm.lastName);
      fd.append('email', email);
      fd.append('phone', phone);
      fd.append('subject', subject);
      fd.append('vehicleInfo', vehicleInfo);
      fd.append('message', message);
      for (var i = 0; i < files.length && i < 3; i++) fd.append('photos', files[i]);
      fetch('/api/devis-photos', { method: 'POST', body: fd })
        .then(function (r) { done(r.ok); })
        .catch(function () { done(false); });
    } else {
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'devis',
          firstName: nm.firstName, lastName: nm.lastName,
          email: email, phone: phone,
          subject: subject, vehicleInfo: vehicleInfo,
          message: message, source: sourceTag
        })
      })
        .then(function (r) { done(r.ok); })
        .catch(function () { done(false); });
    }
  });
})();

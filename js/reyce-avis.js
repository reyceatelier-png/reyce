/* REYCE — avis Google, alimentés par assets/data/avis.json.
   Règle : uniquement des valeurs réelles. Si le fichier est vide, la section reste
   masquée et rien n'est affiché ni déclaré. Les textes sont insérés en texte brut. */
(function () {
  'use strict';
  var sec = document.querySelector('[data-avis]');
  if (!sec) return;
  fetch('assets/data/avis.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      var note = typeof d.note === 'number' && d.note > 0 && d.note <= 5 ? d.note : null;
      var nb = typeof d.nombre === 'number' && d.nombre > 0 ? d.nombre : null;
      var lien = typeof d.lien === 'string' && /^https:\/\//.test(d.lien) ? d.lien : null;
      var avis = (Array.isArray(d.avis) ? d.avis : []).filter(function (a) { return a && a.texte && a.auteur; });
      var score = note && nb;
      if (!score && !avis.length) return;                       // rien de réel à montrer

      var s = sec.querySelector('[data-avis-score]');
      if (s && score) s.textContent = note.toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' ★ · ' + nb + ' avis Google';
      var l = sec.querySelector('[data-avis-link]');
      if (l) {
        if (lien) {
          var a = document.createElement('a');
          a.href = lien; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Voir nos avis sur Google';
          a.style.color = '#fff';
          l.appendChild(a);
        } else { l.parentNode.hidden = true; }
      }
      var list = sec.querySelector('[data-avis-list]');
      if (list) avis.forEach(function (a) {
        var card = document.createElement('figure'); card.className = 'avis-card';
        var q = document.createElement('blockquote'); q.textContent = a.texte;
        var c = document.createElement('cite'); c.textContent = a.auteur + (a.date ? ' · ' + a.date : '');
        card.appendChild(q); card.appendChild(c); list.appendChild(card);
      });
      sec.hidden = false;
    })
    .catch(function () { /* section masquée */ });
})();

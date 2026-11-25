/* REYCE — offres à durée limitée.
   Tout élément portant data-offre-fin="AAAA-MM-JJTHH:MM:SS+01:00" disparaît de lui-même après cette date (heure de Paris).
   Black Friday 2026 : jusqu'au dimanche 13 décembre 2026, 23 h 59. Après la fin, retirer aussi le bandeau des pages. */
(function () {
  'use strict';
  var now = Date.now();
  [].forEach.call(document.querySelectorAll('[data-offre-fin]'), function (el) {
    var end = Date.parse(el.getAttribute('data-offre-fin'));
    if (!isNaN(end) && now > end) el.parentNode && el.parentNode.removeChild(el);
  });
})();

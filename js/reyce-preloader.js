/* PRECHARGEUR REYCE — indépendant de tout autre script.
   S'exécute avant que #pre soit peint : si l'intro a déjà été vue dans
   cette session, la page ne la rejoue pas (navigation interne fluide). */
(function(){
  var seen = false;
  try { seen = sessionStorage.getItem('reyceIntro') === '1'; } catch(e){}
  if (seen) {
    document.documentElement.classList.add('intro-seen');
    return; // #pre est masqué instantanément par CSS, rien à animer ni à minuter
  }
  try { sessionStorage.setItem('reyceIntro', '1'); } catch(e){}

  function kill(){
    var p = document.getElementById('pre');
    if (!p) return;
    p.classList.add('done');
    setTimeout(function(){ p.style.display = 'none'; }, 350);
  }
  /* filet de sécurité unique : un peu après la fin du rideau (2.1s + 1.7s) */
  setTimeout(kill, 4200);
})();

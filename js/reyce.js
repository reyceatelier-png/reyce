/* Le masquage de #pre est entièrement géré par js/reyce-preloader.js
   (chargé en <head>, seule source de vérité — évite deux minuteries
   concurrentes sur le même élément). */

/* ---- curseur personnalisé + magnétique ---- */
(function(){
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!fine||rm)return;
  var dot=document.getElementById('cdot'),ring=document.getElementById('cring');
  if(!dot||!ring)return;
  document.body.classList.add('cursor-on');
  var mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my,sc=1,ts=1;
  addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;
    dot.style.transform='translate('+mx+'px,'+my+'px) translate(-50%,-50%)';},{passive:true});
  /* échelle interpolée (GPU) au lieu d'animer width/height */
  (function loop(){rx+=(mx-rx)*0.19;ry+=(my-ry)*0.19;sc+=(ts-sc)*0.2;
    ring.style.transform='translate('+rx+'px,'+ry+'px) translate(-50%,-50%) scale('+sc.toFixed(3)+')';
    requestAnimationFrame(loop);})();
  function setScale(v){ts=v}
  var hot='a,button,.chip,.opt,.rcard,.bcard,.svc,.tcard,.formcard,.optcard,.gabo';
  document.querySelectorAll(hot).forEach(function(el){
    el.addEventListener('mouseenter',function(){ring.classList.add('hot');dot.classList.add('hot');setScale(1.7)});
    el.addEventListener('mouseleave',function(){ring.classList.remove('hot');dot.classList.remove('hot');setScale(1)});
  });
  var ba=document.getElementById('ba');
  if(ba){ba.addEventListener('mouseenter',function(){ring.classList.add('drag');setScale(2)});
         ba.addEventListener('mouseleave',function(){ring.classList.remove('drag');setScale(1)});}
})();

/* ---- transitions entre pages ---- */
(function(){
  var veil=document.getElementById('veil');if(!veil)return;
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(rm)return;
  document.querySelectorAll('a[href]').forEach(function(a){
    var href=a.getAttribute('href');
    if(!href||href.charAt(0)==='#'||href.indexOf('http')===0||href.indexOf('tel:')===0||href.indexOf('mailto:')===0||a.hasAttribute('download')||a.target)return;
    a.addEventListener('click',function(e){
      e.preventDefault();veil.classList.add('on');
      setTimeout(function(){location.href=href},520);
    });
  });
  addEventListener('pageshow',function(e){if(e.persisted)veil.classList.remove('on')});
})();
var head=document.getElementById('head');
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var prog=document.getElementById('progress');
var plx=[].slice.call(document.querySelectorAll('[data-plx]'));
var ticking=false;
function frame(){
  var st=scrollY,vh=innerHeight,doc=document.documentElement.scrollHeight-vh;
  if(head)head.classList.toggle('stuck',st>40);
  if(prog)prog.style.transform='scaleX('+(doc>0?st/doc:0)+')';
  if(!reduce){plx.forEach(function(el){var r=el.getBoundingClientRect();var s=parseFloat(el.dataset.plx);
    var off=(r.top+r.height/2-vh/2)*s;el.style.transform='translate3d(0,'+off.toFixed(1)+'px,0)';});}
  ticking=false;
}
addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(frame)}},{passive:true});
addEventListener('resize',frame);frame();
var burger=document.getElementById('burger'),drawer=document.getElementById('drawer');
burger.addEventListener('click',()=>{burger.classList.toggle('open');drawer.classList.toggle('open')});
drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{burger.classList.remove('open');drawer.classList.remove('open')}));
// staggered reveals
document.querySelectorAll('.stagger').forEach(function(g){[].slice.call(g.children).forEach(function(c,i){if(c.classList.contains('reveal'))c.style.transitionDelay=(i*0.14)+'s';});});
var io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');
  if(e.target.dataset.count){countUp(e.target);}io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.reveal,[data-count]').forEach(el=>io.observe(el));
/* Le HTML contient déjà la vraie valeur (SEO/no-JS/lecteurs d'écran) ; si JS
   tourne, on repart de 0 pour l'effet de comptage au scroll — purement cosmétique. */
if(!reduce) document.querySelectorAll('[data-count]').forEach(el=>{el.textContent='0';});
function countUp(el){var t=parseInt(el.dataset.count,10),d=1400,s=null;
  function step(ts){if(!s)s=ts;var p=Math.min((ts-s)/d,1);var e=1-Math.pow(1-p,3);
    el.firstChild.textContent=Math.round(e*t);if(p<1)requestAnimationFrame(step);}
  if(reduce){el.firstChild.textContent=t;return;}requestAnimationFrame(step);}

// vidéos hors écran (histoire, récit) : ne commencent à charger/jouer
// qu'à l'approche du scroll — évite de télécharger ~22 Mo dès l'arrivée
// sur la page pour des vidéos que le visiteur n'a peut-être pas encore
// atteintes.
(function(){
  var vids=document.querySelectorAll('video.lazyvid');
  if(!vids.length)return;
  var vio=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;
    var v=e.target;
    v.load();v.play().catch(function(){});
    vio.unobserve(v);
  });},{rootMargin:'150px 0px'});
  vids.forEach(function(v){vio.observe(v);});
})();

// Filtres de la galerie Réalisations. Les pastilles existaient déjà en
// façade mais ne filtraient rien : elles agissent maintenant sur les
// cartes via data-cat. Sans JS, toutes les cartes restent visibles.
(function(){
  var bar=document.querySelector('.filters[data-gallery]');
  if(!bar)return;
  var grid=document.querySelector('.rgrid');
  if(!grid)return;
  var chips=[].slice.call(bar.querySelectorAll('[data-filter]'));
  var cards=[].slice.call(grid.querySelectorAll('.rcard'));
  chips.forEach(function(ch){ch.setAttribute('role','button');ch.tabIndex=0;
    ch.setAttribute('aria-pressed', ch.classList.contains('sel')?'true':'false');});
  function apply(f){
    chips.forEach(function(c){var on=c.dataset.filter===f;
      c.classList.toggle('sel',on);c.setAttribute('aria-pressed',on?'true':'false');});
    cards.forEach(function(c){
      var show=(f==='*'||c.dataset.cat===f);
      c.hidden=!show;
      /* la carte reste révélée : on ne rejoue pas l'animation d'entrée
         à chaque changement de filtre, ce serait épileptique */
      if(show)c.classList.add('in');
    });
  }
  chips.forEach(function(ch){
    ch.addEventListener('click',function(){apply(ch.dataset.filter)});
    ch.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();apply(ch.dataset.filter);}
    });
  });
})();

// Bandeau de contact rapide (téléphone). Un seul script pour tout le site ;
// absent sur le tunnel de réservation et les pages techniques.
(function(){
  if(!matchMedia('(max-width:820px)').matches)return;
  if(/rendez-vous|confirmation|cancel|admin|care-report|merci-devis|404/.test(location.pathname))return;
  // Les pages PPF, polissage et céramique ont déjà leur propre barre collante : pas de seconde barre par-dessus.
  if(document.querySelector('.lp-sticky'))return;
  var bar=document.createElement('div');bar.className='mbar';bar.setAttribute('role','navigation');bar.setAttribute('aria-label','Contact rapide');
  bar.innerHTML='<a class="mb-call" href="tel:+33763004385" data-ev="mbar_call">Appeler</a><a class="mb-book" href="rendez-vous.html" data-ev="mbar_book">Réserver</a>';
  document.body.appendChild(bar);document.body.classList.add('has-mbar');
  function sync(){bar.classList.toggle('on',window.scrollY>360)}
  addEventListener('scroll',sync,{passive:true});sync();
  bar.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&window.dataLayer)window.dataLayer.push({event:a.dataset.ev,page_path:location.pathname});});
})();

// Suivi des contacts : téléphone et WhatsApp, sur toutes les pages.
// Aucune donnée personnelle : seulement l'événement, l'emplacement du lien, le type
// de page et la cible de la page. Les événements restent sans effet tant que GTM
// n'est pas chargé (c'est-à-dire tant que le consentement n'est pas donné).
(function(){
  window.dataLayer=window.dataLayer||[];
  function pageType(){
    var p=location.pathname.replace(/^\//,'')||'index.html';
    if(p==='index.html')return 'accueil';
    if(/^ppf-(voiture-neuve|tesla|sportives)\.html$/.test(p))return 'landing_ppf_cible';
    if(p==='ppf.html')return 'landing_ppf';
    if(/^(polissage|ceramique)\.html$/.test(p))return 'landing_service';
    if(/^(ppf|polissage|ceramique|nettoyage|covering)-/.test(p))return 'page_locale';
    if(/^(realisation|guide)/.test(p))return 'contenu';
    return 'page';
  }
  function cible(){return document.body.getAttribute('data-cible')||'general';}
  function emplacement(a){
    if(a.closest('.lp-sticky,.mbar'))return 'sticky_bar';
    if(a.closest('header,#drawer'))return 'header';
    if(a.closest('footer'))return 'footer';
    if(a.closest('form,.lp-form'))return 'form';
    if(a.closest('.phero,.hero'))return 'hero';
    return 'content';
  }
  window.reyceTrack={pageType:pageType,cible:cible};   // réutilisé par js/reyce-devis.js pour generate_lead
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;
    var h=a.getAttribute('href')||'',ev=null;
    if(/^tel:/i.test(h))ev='click_phone';
    else if(/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(h))ev='click_whatsapp';
    if(!ev)return;
    window.dataLayer.push({event:ev,link_location:emplacement(a),page_type:pageType(),cible:cible(),lead_source:(location.pathname.replace(/^\//,'')||'index.html')});
  },true);
})();

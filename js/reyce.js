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
    if(!href||href.charAt(0)==='#'||href.indexOf('http')===0||a.target)return;
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
function countUp(el){var t=parseInt(el.dataset.count,10),d=1400,s=null;
  function step(ts){if(!s)s=ts;var p=Math.min((ts-s)/d,1);var e=1-Math.pow(1-p,3);
    el.firstChild.textContent=Math.round(e*t);if(p<1)requestAnimationFrame(step);}
  if(reduce){el.firstChild.textContent=t;return;}requestAnimationFrame(step);}

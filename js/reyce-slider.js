(function(){var wrap=document.getElementById('ba');if(!wrap)return;
var before=document.getElementById('baBefore'),line=document.getElementById('baLine'),handle=document.getElementById('baHandle');var drag=false;
function set(x){var r=wrap.getBoundingClientRect();var p=(x-r.left)/r.width;p=Math.max(0,Math.min(1,p));var pc=p*100;
before.style.clipPath='inset(0 '+(100-pc)+'% 0 0)';line.style.left=pc+'%';handle.style.left=pc+'%';}
var s=function(){drag=true},e=function(){drag=false};
var m=function(ev){if(!drag)return;var x=ev.touches?ev.touches[0].clientX:ev.clientX;set(x)};
handle.addEventListener('mousedown',s);wrap.addEventListener('mousedown',function(ev){s();set(ev.clientX)});
addEventListener('mouseup',e);addEventListener('mousemove',m);
handle.addEventListener('touchstart',s,{passive:true});wrap.addEventListener('touchstart',function(ev){s();set(ev.touches[0].clientX)},{passive:true});
addEventListener('touchend',e);addEventListener('touchmove',m,{passive:true});})();

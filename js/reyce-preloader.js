/* SECURITE PRECHARGEUR - independant de tout autre script */
(function(){function kill(){var p=document.getElementById('pre');var hw=document.querySelector('.hero-words');if(hw)hw.classList.add('go');if(p){p.style.opacity='0';p.style.visibility='hidden';p.style.pointerEvents='none';setTimeout(function(){p.style.display='none';},900);}}
setTimeout(kill,2200);
window.addEventListener('load',function(){setTimeout(kill,1000);});})();

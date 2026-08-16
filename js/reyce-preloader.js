/* SECURITE PRECHARGEUR - independant de tout autre script */
(function(){function kill(){var p=document.getElementById('pre');if(p){p.classList.add('done');setTimeout(function(){p.style.display='none';},350);}}
setTimeout(kill,4400);
window.addEventListener('load',function(){setTimeout(kill,3200);});})();

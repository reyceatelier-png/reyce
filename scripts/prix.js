#!/usr/bin/env node
/* REYCE — source unique des prix.
 *
 * Le site n'a pas d'étape de génération : chaque page contient ses prix en dur,
 * ce qui est voulu (titre, meta description et données structurées doivent être
 * lisibles par Google sans JavaScript). Ce script garde donc data/prix.json comme
 * seule référence, et applique un changement de prix partout d'un seul coup.
 *
 *   node scripts/prix.js --check            vérifie que toutes les pages disent la même chose
 *   node scripts/prix.js --set bloc_avant=2490    change le prix partout (pages + llms.txt) et dans prix.json
 *
 * Après un --set : relire `git diff --stat`, c'est la vérification finale.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FICHIER = path.join(ROOT, 'data', 'prix.json');
const cfg = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const prix = cfg.prix;

// Une même somme s'écrit de plusieurs façons dans le HTML.
const SEP = '(?:[ \\u00a0\\u202f]|&nbsp;|&thinsp;)?';
function motif(n) {
  const s = String(n);
  const milliers = s.length > 3 ? s.slice(0, -3) + SEP + s.slice(-3) : s;
  return new RegExp('(?<![\\d])' + milliers + '(?!\\d)(?=(?:[ \\u00a0\\u202f]|&nbsp;|&thinsp;)*(?:€|&euro;))', 'g');
}
function motifJsonLd(n) {
  return new RegExp('("(?:price|minPrice|lowPrice)"\\s*:\\s*")' + n + '(")', 'g');
}
function formater(n, modele) {
  // reprend le séparateur de l'occurrence remplacée
  const s = String(n);
  if (s.length <= 3) return s;
  const sep = modele.replace(/\d/g, '');
  return s.slice(0, -3) + sep + s.slice(-3);
}

function fichiers() {
  return fs.readdirSync(ROOT).filter(f => f.endsWith('.html') || f === 'llms.txt').map(f => path.join(ROOT, f));
}

const contextes = {
  bloc_avant: /bloc avant[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
  ppf_complet: /(?:ppf complet|v[ée]hicule complet|complet du v[ée]hicule)[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
  pack_bloc_avant_ceramique: /pack[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
};
const valeur = txt => parseInt(txt.replace(/\D/g, ''), 10);

function check() {
  let problemes = 0;
  const compte = {};
  for (const f of fichiers()) {
    const t = fs.readFileSync(f, 'utf8');
    for (const [cle, re] of Object.entries(contextes)) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        const v = valeur(m[1]);
        compte[cle] = (compte[cle] || 0) + 1;
        if (v !== prix[cle]) { problemes++; console.log(`✗ ${path.basename(f)} : « ${cle} » affiche ${v} au lieu de ${prix[cle]}`); }
      }
    }
    for (const n of [prix.bloc_avant]) {
      const jl = [...t.matchAll(/"(?:price|minPrice)"\s*:\s*"(\d+)"/g)].map(m => parseInt(m[1], 10));
      for (const v of jl) if (/ppf/.test(path.basename(f)) && v !== prix.bloc_avant) { problemes++; console.log(`✗ ${path.basename(f)} : donnée structurée à ${v} au lieu de ${prix.bloc_avant}`); }
    }
  }
  console.log('Occurrences contrôlées :', JSON.stringify(compte));
  console.log(problemes ? `${problemes} incohérence(s).` : '✓ Tous les prix sont cohérents avec data/prix.json.');
  process.exit(problemes ? 1 : 0);
}

function set(arg) {
  const [cle, brut] = String(arg || '').split('=');
  const nouveau = parseInt(brut, 10);
  if (!(cle in prix) || !Number.isFinite(nouveau) || nouveau <= 0) {
    console.error('Usage : node scripts/prix.js --set <' + Object.keys(prix).join('|') + '>=<montant entier>');
    process.exit(2);
  }
  const ancien = prix[cle];
  if (ancien === nouveau) { console.log('Déjà à ' + nouveau + '.'); return; }
  let total = 0, nbFichiers = 0;
  for (const f of fichiers()) {
    let t = fs.readFileSync(f, 'utf8'), n = 0;
    t = t.replace(motif(ancien), m => { n++; return formater(nouveau, m.replace(/\d/g, '')); });
    t = t.replace(motifJsonLd(ancien), (m, a, b) => { n++; return a + nouveau + b; });
    if (n) { fs.writeFileSync(f, t); total += n; nbFichiers++; }
  }
  cfg.prix[cle] = nouveau;
  fs.writeFileSync(FICHIER, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`${cle} : ${ancien} → ${nouveau} (${total} remplacement(s) dans ${nbFichiers} fichier(s)).`);
  console.log('Attention : tout montant identique à l\'ancien prix a été remplacé, quel que soit son contexte. Relire `git diff --stat`.');
}

const [, , mode, arg] = process.argv;
if (mode === '--check') check();
else if (mode === '--set') set(arg);
else { console.log('Usage : node scripts/prix.js --check | --set cle=montant'); process.exit(2); }

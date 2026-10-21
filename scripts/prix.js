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
 *   node scripts/prix.js --set tesla_brillant=4190  change un prix propre à une page (voir « portee » dans prix.json)
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


// ---- Prix propres à une page (« portee » dans prix.json) -----------------
// La page Tesla affiche 3 990 € (brillant) alors que le PPF complet général vaut aussi 3 990 €.
// Un changement global ne doit pas toucher le prix Tesla, et inversement : ces montants sont
// donc masqués pendant les opérations globales, et ne se modifient qu'avec leur propre clé.
const portee = cfg.portee || {};
const MOTS = { tesla_brillant: 'brillant', tesla_mat: '\\bmat\\b' };   // mot qui précède le montant dans la page
const EURO = '(?=(?:[ \\u00a0\\u202f]|&nbsp;|&thinsp;)*(?:€|&euro;))';
function montant(n) {
  const s = String(n);
  return '(?<![\\d])' + (s.length > 3 ? s.slice(0, -3) + SEP + s.slice(-3) : s) + '(?!\\d)';
}
const ANY = '\\d{1,2}' + SEP + '\\d{3}';
function reScope(cle, amt, flags) {
  return [
    new RegExp('(' + MOTS[cle] + '[^<>"€]{0,60}?)(' + amt + ')' + EURO, flags),          // « brillant dès 3 990 € »
    new RegExp('(data-prix="' + cle + '"[^>]*>[^<€]{0,40}?)(' + amt + ')' + EURO, flags), // cellule de tableau balisée
  ];
}
function cles(fichier) { return Object.keys(portee).filter(k => path.basename(fichier) === portee[k]); }
function masquer(fichier, texte) {
  const jetons = [];
  const garder = b => { jetons.push(b); return '⟦' + (jetons.length - 1) + '⟧'; };
  for (const k of cles(fichier)) {
    for (const re of reScope(k, montant(prix[k]), 'gi')) texte = texte.replace(re, (m, a, b) => a + garder(b));
    texte = texte.replace(motifJsonLd(prix[k]), (m, a, b) => garder(a + prix[k] + b));   // price / minPrice des données structurées
  }
  return { texte, rendre: t => t.replace(/⟦(\d+)⟧/g, (m, i) => jetons[+i]) };
}

const contextes = {
  bloc_avant: /bloc avant(?!\s*\+)[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
  ppf_complet: /(?:ppf complet|v[ée]hicule complet|complet du v[ée]hicule)[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
  pack_bloc_avant_ceramique: /pack[^<>"]{0,70}?(\d{1,2}(?:[   ]|&nbsp;|&thinsp;)?\d{3})(?:[   ]|&nbsp;|&thinsp;)*(?:€|&euro;)/gi,
};
const valeur = txt => parseInt(txt.replace(/\D/g, ''), 10);

function check() {
  let problemes = 0;
  const compte = {};
  for (const f of fichiers()) {
    const brut = fs.readFileSync(f, 'utf8');
    const t = masquer(f, brut).texte;       // les prix propres à une page sont contrôlés plus bas
    for (const k of cles(f)) {
      for (const re of reScope(k, ANY, 'gi')) {
        for (const m of brut.matchAll(re)) {
          const v = valeur(m[2]); compte[k] = (compte[k] || 0) + 1;
          if (v !== prix[k]) { problemes++; console.log(`✗ ${path.basename(f)} : « ${k} » affiche ${v} au lieu de ${prix[k]}`); }
        }
      }
    }
    if (cles(f).length) {                    // données structurées d'une page à prix propres : seulement ses propres prix
      const attendus = cles(f).map(x => prix[x]);
      for (const m of brut.matchAll(/"(?:price|minPrice)"\s*:\s*"(\d+)"/g)) {
        if (!attendus.includes(parseInt(m[1], 10))) { problemes++; console.log(`✗ ${path.basename(f)} : donnée structurée à ${m[1]}, attendu ${attendus.join(' ou ')}`); }
      }
    }
    for (const [cle, re] of Object.entries(contextes)) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        const v = valeur(m[1]);
        compte[cle] = (compte[cle] || 0) + 1;
        if (v !== prix[cle]) { problemes++; console.log(`✗ ${path.basename(f)} : « ${cle} » affiche ${v} au lieu de ${prix[cle]}`); }
      }
    }
    for (const m of t.matchAll(/data-prix="(\w+)"[^>]*>\s*(?:<span[^>]*>[^<]*<\/span>)?\s*([\d&;a-z\s]+?)\s*(?:€|&euro;)/gi)) {
      const v = valeur(m[2].replace(/&[a-z]+;/g, ''));
      compte['carte:' + m[1]] = (compte['carte:' + m[1]] || 0) + 1;
      if (v !== prix[m[1]]) { problemes++; console.log(`✗ ${path.basename(f)} : carte « ${m[1]} » affiche ${v} au lieu de ${prix[m[1]]}`); }
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
  if (cle in portee) {                       // prix propre à une page : seulement dans cette page
    const f = path.join(ROOT, portee[cle]);
    let t = fs.readFileSync(f, 'utf8'), n = 0;
    for (const re of reScope(cle, montant(ancien), 'gi')) t = t.replace(re, (m, a, b) => { n++; return a + formater(nouveau, b.replace(/\d/g, '')); });
    t = t.replace(motifJsonLd(ancien), (m, a, b) => { n++; return a + nouveau + b; });
    if (n) { fs.writeFileSync(f, t); total += n; nbFichiers++; }
  } else for (const f of fichiers()) {      // prix général : partout, sauf les prix propres à une page
    const brut = fs.readFileSync(f, 'utf8');
    const mk = masquer(f, brut); let t = mk.texte, n = 0;
    t = t.replace(motif(ancien), m => { n++; return formater(nouveau, m.replace(/\d/g, '')); });
    t = t.replace(motifJsonLd(ancien), (m, a, b) => { n++; return a + nouveau + b; });
    if (n) { fs.writeFileSync(f, mk.rendre(t)); total += n; nbFichiers++; }
  }
  cfg.prix[cle] = nouveau;
  fs.writeFileSync(FICHIER, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`${cle} : ${ancien} → ${nouveau} (${total} remplacement(s) dans ${nbFichiers} fichier(s)).`);
  console.log(cle in portee ? 'Prix propre à ' + portee[cle] + ' : le reste du site n\'a pas été touché.' : 'Attention : tout montant général identique à l\'ancien prix a été remplacé, quel que soit son contexte (les prix propres à une page sont protégés). Relire `git diff --stat`.');
}

const [, , mode, arg] = process.argv;
if (mode === '--check') check();
else if (mode === '--set') set(arg);
else { console.log('Usage : node scripts/prix.js --check | --set cle=montant'); process.exit(2); }

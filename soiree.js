'use strict';
/* ============================================================
   Soirée privée REYCE — réponses des invités (page /soiree)

   Mécanisme réutilisé du site : chaque réponse est enregistrée dans la table EventLog comme une fiche « lead »
   (même stockage que les demandes de devis et de contact, donc dans le même CRM), avec kind = 'soiree'.
   - une même adresse e-mail ne crée jamais de doublon : la réponse est mise à jour ;
   - les fiches « soirée » sont tenues à l'écart du pipeline commercial et des statistiques de campagnes
     (voir loadLeads dans server.js) et listées dans l'onglet « Soirée » du CRM ;
   - un e-mail de notification part vers l'atelier à chaque réponse, un e-mail de confirmation (avec le fichier
     agenda .ics) part vers l'invité qui vient.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SOIREE = {
  label: 'Soirée 3 décembre 2026',
  subject: 'Soirée du 3 décembre 2026',
  startUtc: Date.UTC(2026, 11, 3, 18, 30),   // jeudi 3 décembre 2026, 19 h 30 à Paris (UTC+1)
  endUtc: Date.UTC(2026, 11, 3, 21, 30),     // 22 h 30
  place: 'Atelier REYCE, 47 chemin du Pras, 69350 La Mulatière'
};

module.exports = function registerSoiree(app, d) {
  const { prisma, express, rateLimit, sendEmail, escapeHtml, cleanText, cleanPhone, isValidEmail, loadLeads } = d;

  // ---------- fichier agenda (.ics) : 19 h 30 – 22 h 30, heure de Paris ----------
  const stamp = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ICS_PATH = path.join(__dirname, 'assets', 'soiree', 'soiree-reyce.ics');
  let icsBuffer = null;
  try { icsBuffer = fs.readFileSync(ICS_PATH); } catch (e) { /* le fichier est facultatif pour l'e-mail */ }

  // ---------- limitation : un invité répond une ou deux fois, pas vingt ----------
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Trop de réponses envoyées depuis cette connexion. Réessayez dans un moment, ou répondez-nous directement.' },
  });

  // ---------- un seul enregistrement à la fois par adresse e-mail (deux envois simultanés ne créent pas de doublon) ----------
  const locks = new Map();
  async function withLock(key, fn) {
    const prev = locks.get(key) || Promise.resolve();
    let release; const mine = new Promise(r => { release = r; });
    const chain = prev.then(() => mine);
    locks.set(key, chain);
    await prev;
    try { return await fn(); }
    finally { release(); if (locks.get(key) === chain) locks.delete(key); }
  }

  const present = r => r.reponse === 'present';
  const statutLabel = r => (present(r) ? 'Présent' : 'Absent');
  function noteText(r) {
    const parts = [statutLabel(r)];
    if (present(r)) parts.push(r.personnes === 2 ? '2 personnes (avec un(e) invité(e))' : '1 personne');
    if (r.allergies) parts.push('Allergies / préférences : ' + r.allergies);
    if (r.code) parts.push('Lien personnel : ' + r.code);
    return parts.join(' · ');
  }

  async function save(r) {
    return withLock(r.email, async () => {
      const existing = await prisma.eventLog.findFirst({
        where: { type: 'lead', AND: [{ payload: { path: ['kind'], equals: 'soiree' } }, { payload: { path: ['email'], equals: r.email } }] },
        orderBy: { createdAt: 'asc' }
      });
      const now = new Date().toISOString();
      const rsvp = { statut: statutLabel(r), reponse: r.reponse, personnes: r.personnes, allergies: r.allergies, code: r.code };
      if (existing) {
        const p = { ...(existing.payload || {}) };
        const before = p.rsvp || {};
        p.firstName = r.firstName; p.lastName = r.lastName; p.phone = r.phone;
        p.message = noteText(r);
        p.rsvp = { ...rsvp, answeredAt: before.answeredAt || existing.createdAt.toISOString(), updatedAt: now, reponses: (before.reponses || 1) + 1, code: r.code || before.code || '' };
        p.history = [...(p.history || []), { at: now, from: before.reponse, to: r.reponse }];
        p.archived = false;
        const row = await prisma.eventLog.update({ where: { id: existing.id }, data: { payload: p } });
        return { row, updated: true, before };
      }
      const row = await prisma.eventLog.create({
        data: {
          type: 'lead',
          payload: {
            kind: 'soiree', origin: 'site',
            firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
            vehicle: '', subject: SOIREE.subject, message: noteText(r),
            source: SOIREE.label, attribution: {}, channel: 'Soirée', photos: 0,
            status: 'new', archived: false, notes: [], history: [{ at: now, to: r.reponse }],
            rsvp: { ...rsvp, answeredAt: now, updatedAt: now, reponses: 1 }
          }
        }
      });
      return { row, updated: false, before: null };
    });
  }

  // ---------- e-mails (même charte sombre que les autres e-mails du site) ----------
  const BASE = () => process.env.BASE_URL || 'https://www.reyce.fr';
  const CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#070707;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e0e0e0;-webkit-font-smoothing:antialiased}
  .wrap{max-width:560px;margin:0 auto;padding:56px 32px}
  .logo{font-size:18px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;color:#fff;margin-bottom:56px}
  .title{font-size:30px;font-weight:300;color:#fff;line-height:1.2;margin-bottom:12px}
  .sub{font-size:14px;color:#8a8a8a;margin-bottom:36px;line-height:1.75}
  .table{width:100%;border-collapse:collapse;margin-bottom:28px}
  .table td{padding:13px 0;border-bottom:1px solid #1b1b1b;font-size:14px;vertical-align:top;line-height:1.5}
  .table td.lbl{color:#666;font-size:10px;letter-spacing:.18em;text-transform:uppercase;width:38%;padding-top:15px}
  .btn{display:block;text-align:center;padding:14px 28px;background:#fff;color:#080808!important;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-bottom:12px}
  .btn2{display:block;text-align:center;padding:13px 28px;border:1px solid #444;color:#ddd!important;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-bottom:12px}
  .footer{border-top:1px solid #141414;padding-top:24px;margin-top:40px}
  .footer p{font-size:11px;color:#555;line-height:1.8}`;
  const shell = body => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head><body><div class="wrap">
  <div class="logo"><img src="${BASE()}/assets/images/logo.png" width="30" height="36" alt="REYCE" style="display:block;margin:0 0 12px;border:0;"><span>REYCE</span></div>${body}
  <div class="footer"><p>REYCE · Atelier · Lyon<br>47 chemin du Pras, 69350 La Mulatière · 07 63 00 43 85<br>www.reyce.fr · @reyce.lyon</p></div></div></body></html>`;

  function guestEmail(r) {
    const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Soirée privée REYCE') +
      '&dates=' + stamp(SOIREE.startUtc) + '/' + stamp(SOIREE.endUtc) + '&ctz=Europe/Paris&location=' + encodeURIComponent(SOIREE.place) +
      '&details=' + encodeURIComponent('Tenue élégante. Une question : 07 63 00 43 85.');
    const who = r.personnes === 2 ? 'Votre place et celle de votre invité(e) sont réservées.' : 'Votre place est réservée.';
    const html = shell(`
  <p class="title">À jeudi, ${escapeHtml(r.firstName)}.</p>
  <p class="sub">${who} Nous avons hâte de vous accueillir à l'atelier.</p>
  <table class="table">
    <tr><td class="lbl">Date</td><td>Jeudi 3 décembre 2026</td></tr>
    <tr><td class="lbl">Heure</td><td>19 h 30</td></tr>
    <tr><td class="lbl">Lieu</td><td>${escapeHtml(SOIREE.place)}</td></tr>
    <tr><td class="lbl">Tenue</td><td>Élégante</td></tr>
    <tr><td class="lbl">Personnes</td><td>${r.personnes === 2 ? '2 (vous et un(e) invité(e))' : '1'}</td></tr>
    ${r.allergies ? `<tr><td class="lbl">Allergie / préférence</td><td>${escapeHtml(r.allergies)}</td></tr>` : ''}
  </table>
  <a class="btn" href="${gcal}">Ajouter à Google Agenda</a>
  <p class="sub" style="margin-top:8px">Apple Agenda, Outlook : ouvrez la pièce jointe « soiree-reyce.ics ».</p>
  <p class="sub">Un empêchement, une question ? Répondez simplement à cet e-mail.</p>`);
    return { subject: 'Votre place est réservée — soirée REYCE, jeudi 3 décembre', html };
  }

  function ownerEmail(r, info) {
    const html = shell(`
  <p class="title">${escapeHtml(statutLabel(r))} — ${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</p>
  <p class="sub">${info.updated ? 'Réponse modifiée par l\'invité (la fiche du CRM a été mise à jour).' : 'Nouvelle réponse à la soirée du 3 décembre.'}</p>
  <table class="table">
    <tr><td class="lbl">Réponse</td><td>${escapeHtml(statutLabel(r))}${present(r) ? ' · ' + (r.personnes === 2 ? '2 personnes' : '1 personne') : ''}</td></tr>
    <tr><td class="lbl">Nom</td><td>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</td></tr>
    <tr><td class="lbl">Téléphone</td><td>${escapeHtml(r.phone)}</td></tr>
    <tr><td class="lbl">E-mail</td><td>${escapeHtml(r.email)}</td></tr>
    ${r.allergies ? `<tr><td class="lbl">Allergie / préférence</td><td>${escapeHtml(r.allergies)}</td></tr>` : ''}
    ${r.code ? `<tr><td class="lbl">Lien personnel</td><td>${escapeHtml(r.code)}</td></tr>` : ''}
  </table>
  <a class="btn2" href="${BASE()}/admin.html">Ouvrir le CRM (onglet Soirée)</a>`);
    return { subject: `[Soirée] ${statutLabel(r)} — ${r.firstName} ${r.lastName}${present(r) && r.personnes === 2 ? ' (+1)' : ''}`, html };
  }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
  const mailReady = () => !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN);

  // ---------- réception d'une réponse ----------
  app.post('/api/soiree/rsvp', limiter, express.json({ limit: '8kb' }), async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true });   // champ piège rempli : c'est un robot, on ne dit rien et on n'enregistre rien

    const r = {
      firstName: cleanText(b.prenom, 80),
      lastName: cleanText(b.nom, 80),
      email: typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 254) : '',
      phone: cleanPhone(b.telephone),
      reponse: b.reponse === 'present' ? 'present' : (b.reponse === 'absent' ? 'absent' : ''),
      personnes: 0, allergies: '',
      code: String(b.code == null ? '' : b.code).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
    };
    const bad = (field, error) => res.status(400).json({ ok: false, field, error });
    if (!r.firstName) return bad('prenom', 'Merci d’indiquer votre prénom.');
    if (!r.lastName) return bad('nom', 'Merci d’indiquer votre nom.');
    if (!isValidEmail(r.email)) return bad('email', 'Merci d’indiquer une adresse e-mail valide.');
    if (r.phone.replace(/\D/g, '').length < 9) return bad('telephone', 'Merci d’indiquer un numéro de téléphone valide.');
    if (!r.reponse) return bad('reponse', 'Merci de nous dire si vous serez présent(e).');
    if (present(r)) {
      r.personnes = Number(b.personnes) === 2 ? 2 : 1;
      r.allergies = cleanText(b.allergies, 300, true);
    }

    let saved;
    try { saved = await save(r); }
    catch (err) {
      console.error('[Soirée] enregistrement impossible :', err.message);
      return res.status(503).json({ ok: false, error: 'Votre réponse n’a pas pu être enregistrée. Réessayez dans un instant, ou appelez-nous au 07 63 00 43 85.' });
    }

    // e-mails : l'atelier est prévenu à chaque réponse ; l'invité reçoit sa confirmation s'il vient
    let emailed = false;
    if (mailReady()) {
      const owner = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com';
      const jobs = [];
      const mo = ownerEmail(r, saved);
      jobs.push(withTimeout(sendEmail(owner, mo.subject, mo.html, null, { replyTo: r.email }), 8000).catch(e => console.error('[Soirée] e-mail atelier :', e.message)));
      if (present(r)) {
        const mg = guestEmail(r);
        const att = icsBuffer ? [{ filename: 'soiree-reyce.ics', contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', buffer: icsBuffer }] : null;
        jobs.push(withTimeout(sendEmail(r.email, mg.subject, mg.html, att, { replyTo: owner }).then(() => { emailed = true; }), 8000)
          .catch(e => console.error('[Soirée] e-mail invité :', e.message)));
      }
      await Promise.all(jobs);
    }
    res.json({ ok: true, reponse: r.reponse, personnes: r.personnes, emailed, updated: saved.updated });
  });

  // ---------- CRM : liste, export, suppression ----------
  app.get('/api/admin/soiree', async (req, res) => {
    const rows = (await loadLeads({ soiree: true })).map(l => ({
      id: l.id, createdAt: l.createdAt, firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone,
      reponse: (l.rsvp || {}).reponse || '', statut: (l.rsvp || {}).statut || '', personnes: (l.rsvp || {}).personnes || 0,
      allergies: (l.rsvp || {}).allergies || '', code: (l.rsvp || {}).code || '',
      updatedAt: (l.rsvp || {}).updatedAt || l.createdAt, reponses: (l.rsvp || {}).reponses || 1, notes: l.notes || []
    }));
    const pres = rows.filter(x => x.reponse === 'present');
    res.json({
      responses: rows,
      totals: { total: rows.length, present: pres.length, absent: rows.filter(x => x.reponse === 'absent').length, persons: pres.reduce((a, x) => a + (x.personnes || 1), 0) }
    });
  });

  const csvCell = v => {
    let s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;                      // jamais de formule dans un tableur
    return '"' + s.replace(/"/g, '""') + '"';
  };
  app.get('/api/admin/soiree.csv', async (req, res) => {
    const rows = await loadLeads({ soiree: true });
    const head = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Statut', 'Personnes', 'Allergies / préférences', 'Lien personnel', 'Première réponse', 'Dernière réponse'];
    const lines = [head.map(csvCell).join(';')].concat(rows.map(l => {
      const q = l.rsvp || {};
      return [l.firstName, l.lastName, l.email, l.phone, q.statut, q.personnes, q.allergies, q.code, l.createdAt, q.updatedAt || l.createdAt].map(csvCell).join(';');
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="soiree-reyce-reponses.csv"');
    res.send('﻿' + lines.join('\r\n'));
  });

  app.delete('/api/admin/soiree/:id', async (req, res) => {
    const row = await prisma.eventLog.findFirst({ where: { id: String(req.params.id), type: 'lead' } });
    if (!row || (row.payload || {}).kind !== 'soiree') return res.status(404).json({ error: 'Réponse introuvable' });
    await prisma.eventLog.delete({ where: { id: row.id } });
    res.json({ ok: true });
  });
};

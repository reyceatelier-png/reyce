'use strict';
/* ============================================================
   Événements REYCE — invitations, réponses, jour J (CRM + page d'invitation)

   Stockage : table EventLog (aucune migration), deux types de lignes :
   - « event »  : la fiche d'un événement (nom, horaires, lieu, tenue, message d'invitation…)
   - « eguest » : une participation (une personne invitée ou qui a répondu à un événement)
   Ce ne sont jamais des « leads » : une réponse à un événement n'entre pas dans le pipeline commercial.

   Identité d'un invité : son code personnel (opaque, aléatoire) ; à défaut son adresse e-mail (une réponse = une fiche, jamais de doublon).
   Un lien personnel transféré à quelqu'un d'autre ne remplace pas l'invité d'origine : une réponse avec une autre adresse crée sa propre fiche.
   ============================================================ */
const crypto = require('crypto');

const DEFAULT_SLUG = 'soiree-reyce-2026-12-03';
const DEFAULT_EVENT = {
  slug: DEFAULT_SLUG, name: 'Soirée REYCE', kind: 'Soirée privée', path: '/soiree',
  startUtc: '2026-12-03T18:30:00.000Z', endUtc: '2026-12-03T21:30:00.000Z',          // jeudi 3 décembre 2026, 19 h 30 – 22 h 30, heure de Paris
  place: 'Atelier REYCE', address: '47 chemin du Pras, 69350 La Mulatière', dressCode: 'Tenue élégante', deadline: '',
  inviteMessage: 'Bonjour {prenom}, REYCE vous invite à une soirée privée à l\'atelier, le jeudi 3 décembre à 19h30. Votre invitation personnelle : {lien}',
  notes: '', status: 'active'
};
const CHANNELS = ['WhatsApp', 'E-mail', 'SMS', 'En main propre', 'Lien partagé', 'Lien transféré', 'Sur place'];
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

module.exports = function registerEvents(app, d) {
  const { prisma, express, rateLimit, sendEmail, escapeHtml, cleanText, cleanPhone, isValidEmail } = d;
  const BASE = () => (process.env.BASE_URL || 'https://www.reyce.fr').replace(/\/+$/, '');

  // ---------- utilitaires ----------
  const newCode = () => { const b = crypto.randomBytes(10); let s = ''; for (let i = 0; i < 10; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length]; return s; };
  const goodCode = c => typeof c === 'string' && /^[a-z0-9]{10}$/.test(c);
  const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  const stamp = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const nowIso = () => new Date().toISOString();

  const PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parisParts = iso => { const o = {}; PARIS.formatToParts(new Date(iso)).forEach(p => { o[p.type] = p.value; }); return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` }; };
  function parisToUtc(dateStr, timeStr) {                                   // « 2026-12-03 » + « 19:30 » (heure de Paris) → instant UTC
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''), t = /^(\d{1,2}):(\d{2})$/.exec(timeStr || '');
    if (!m || !t) return null;
    const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]); let guess = want;
    for (let i = 0; i < 3; i++) { const p = parisParts(new Date(guess).toISOString()); const [y, mo, da] = p.date.split('-').map(Number); const [h, mi] = p.time.split(':').map(Number); guess += want - Date.UTC(y, mo - 1, da, h, mi); }
    return new Date(guess).toISOString();
  }
  const when = ev => { const a = parisParts(ev.startUtc), b = parisParts(ev.endUtc); return { date: a.date, start: a.time, end: b.time }; };
  const longDate = ev => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ev.startUtc));
  const hhmm = ev => parisParts(ev.startUtc).time.replace(':', 'h');
  const placeFull = ev => [ev.place, ev.address].filter(Boolean).join(', ');
  const mapsUrl = ev => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(placeFull(ev) || ev.name);
  const gcalUrl = ev => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.name) + '&dates=' + stamp(ev.startUtc) + '/' + stamp(ev.endUtc) +
    '&ctz=Europe/Paris&location=' + encodeURIComponent(placeFull(ev)) + '&details=' + encodeURIComponent([ev.dressCode, 'Une question : 07 63 00 43 85.'].filter(Boolean).join('. '));
  const icsText = ev => {
    const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//REYCE//Evenements//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${ev.slug}@reyce.fr`, `DTSTAMP:${stamp(ev.createdAt || ev.startUtc)}`,
      `DTSTART:${stamp(ev.startUtc)}`, `DTEND:${stamp(ev.endUtc)}`, `SUMMARY:${esc(ev.name)}`, `LOCATION:${esc(placeFull(ev))}`,
      `DESCRIPTION:${esc([ev.dressCode, 'Une question : 07 63 00 43 85.'].filter(Boolean).join('. '))}`, 'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  };

  // ---------- un seul traitement à la fois par clé (pas de doublon si deux envois arrivent ensemble) ----------
  const locks = new Map();
  async function withLock(key, fn) {
    const prev = locks.get(key) || Promise.resolve(); let release; const mine = new Promise(r => { release = r; });
    const chain = prev.then(() => mine); locks.set(key, chain); await prev;
    try { return await fn(); } finally { release(); if (locks.get(key) === chain) locks.delete(key); }
  }

  // ---------- accès aux données ----------
  const eventRow = slug => prisma.eventLog.findFirst({ where: { type: 'event', payload: { path: ['slug'], equals: slug } } });
  const evOf = row => ({ id: row.id, createdAt: row.createdAt.toISOString(), ...row.payload });
  async function getEvent(slug) { const r = await eventRow(slug); return r ? evOf(r) : null; }
  async function listEvents() { return (await prisma.eventLog.findMany({ where: { type: 'event' }, orderBy: { createdAt: 'asc' }, take: 200 })).map(evOf); }
  const guestRows = slug => prisma.eventLog.findMany({ where: { type: 'eguest', payload: { path: ['eventSlug'], equals: slug } }, orderBy: { createdAt: 'asc' }, take: 5000 });
  const gOf = row => ({ id: row.id, createdAt: row.createdAt.toISOString(), ...row.payload });
  const guestByCode = (slug, code) => prisma.eventLog.findFirst({ where: { type: 'eguest', AND: [{ payload: { path: ['eventSlug'], equals: slug } }, { payload: { path: ['code'], equals: code } }] } });
  const guestByEmail = (slug, email) => prisma.eventLog.findFirst({ where: { type: 'eguest', AND: [{ payload: { path: ['eventSlug'], equals: slug } }, { payload: { path: ['email'], equals: email } }] }, orderBy: { createdAt: 'asc' } });
  const saveGuest = (row, p) => prisma.eventLog.update({ where: { id: row.id }, data: { payload: p } });
  async function clientFor(email) {                                          // contact déjà connu (client avec réservation ou fiche client)
    if (!email) return null;
    try { const c = await prisma.client.findUnique({ where: { email } }); if (c) return { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone || '' }; } catch (e) { /* sans importance */ }
    try { const a = await prisma.appointment.findFirst({ where: { guestEmail: email, status: { not: 'pending_payment' } } }); if (a) return { id: '', firstName: a.guestFirstName, lastName: a.guestLastName, phone: a.guestPhone || '' }; } catch (e) { /* sans importance */ }
    return null;
  }

  // la fiche de la soirée du 3 décembre existe dès le démarrage ; l'ajout est sans risque si elle existe déjà
  (async () => {
    try { if (!(await eventRow(DEFAULT_SLUG))) await prisma.eventLog.create({ data: { type: 'event', payload: DEFAULT_EVENT } }); }
    catch (e) { console.error('[Événements] fiche par défaut :', e.message); }
  })();

  const present = g => g.status === 'confirmed';
  const personsOf = g => (present(g) ? 1 + (g.companions || 0) : 0);
  const totals = gs => ({
    invited: gs.length, pending: gs.filter(g => g.status === 'pending').length, confirmed: gs.filter(present).length, declined: gs.filter(g => g.status === 'declined').length,
    persons: gs.reduce((a, g) => a + personsOf(g), 0), arrived: gs.filter(g => g.attendance === 'present').length,
    arrivedPersons: gs.filter(g => g.attendance === 'present').reduce((a, g) => a + (g.arrivedPersons || personsOf(g) || 1), 0)
  });
  const linkOf = (ev, g) => BASE() + (ev.path || '/soiree') + (String(ev.path || '/soiree').includes('?') ? '&' : '?') + 'i=' + g.code;
  const publicEvent = ev => ({ slug: ev.slug, name: ev.name, kind: ev.kind, startUtc: ev.startUtc, endUtc: ev.endUtc, place: ev.place, address: ev.address, dressCode: ev.dressCode, deadline: ev.deadline || '', mapsUrl: mapsUrl(ev), gcalUrl: gcalUrl(ev) });
  const closed = ev => { if (!ev.deadline) return false; const end = parisToUtc(ev.deadline, '23:59'); return !!end && Date.now() > Date.parse(end); };

  // ---------- e-mails (même charte sombre que les autres e-mails du site) ----------
  const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{background:#070707;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e0e0e0;-webkit-font-smoothing:antialiased}
  .wrap{max-width:560px;margin:0 auto;padding:56px 32px}.logo{font-size:18px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;color:#fff;margin-bottom:56px}
  .title{font-size:30px;font-weight:300;color:#fff;line-height:1.2;margin-bottom:12px}.sub{font-size:14px;color:#8a8a8a;margin-bottom:36px;line-height:1.75}
  .table{width:100%;border-collapse:collapse;margin-bottom:28px}.table td{padding:13px 0;border-bottom:1px solid #1b1b1b;font-size:14px;vertical-align:top;line-height:1.5}
  .table td.lbl{color:#666;font-size:10px;letter-spacing:.18em;text-transform:uppercase;width:38%;padding-top:15px}
  .btn{display:block;text-align:center;padding:14px 28px;background:#fff;color:#080808!important;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-bottom:12px}
  .btn2{display:block;text-align:center;padding:13px 28px;border:1px solid #444;color:#ddd!important;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-bottom:12px}
  .footer{border-top:1px solid #141414;padding-top:24px;margin-top:40px}.footer p{font-size:11px;color:#555;line-height:1.8}`;
  const shell = body => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head><body><div class="wrap">
  <div class="logo"><img src="${BASE()}/assets/images/logo.png" width="30" height="36" alt="REYCE" style="display:block;margin:0 0 12px;border:0;"><span>REYCE</span></div>${body}
  <div class="footer"><p>REYCE · Atelier · Lyon<br>47 chemin du Pras, 69350 La Mulatière · 07 63 00 43 85<br>www.reyce.fr · @reyce.lyon</p></div></div></body></html>`;
  const guestEmail = (ev, g) => {
    const who = g.companions ? 'Votre place et celle de votre invité(e) sont réservées.' : 'Votre place est réservée.';
    return { subject: `Votre place est réservée — ${ev.name}, ${longDate(ev).replace(/ \d{4}$/, '')}`, html: shell(`
  <p class="title">À jeudi, ${escapeHtml(g.firstName)}.</p>
  <p class="sub">${who} Nous avons hâte de vous accueillir à l'atelier.</p>
  <table class="table">
    <tr><td class="lbl">Date</td><td>${escapeHtml(longDate(ev))}</td></tr><tr><td class="lbl">Heure</td><td>${escapeHtml(hhmm(ev))}</td></tr>
    <tr><td class="lbl">Lieu</td><td>${escapeHtml(placeFull(ev))}</td></tr>${ev.dressCode ? `<tr><td class="lbl">Tenue</td><td>${escapeHtml(ev.dressCode)}</td></tr>` : ''}
    <tr><td class="lbl">Personnes</td><td>${g.companions ? '2 (vous et un(e) invité(e))' : '1'}</td></tr>${g.allergies ? `<tr><td class="lbl">Allergie / préférence</td><td>${escapeHtml(g.allergies)}</td></tr>` : ''}
  </table>
  <a class="btn" href="${gcalUrl(ev)}">Ajouter à Google Agenda</a><a class="btn2" href="${mapsUrl(ev)}">Itinéraire</a>
  <p class="sub" style="margin-top:8px">Apple Agenda, Outlook : ouvrez la pièce jointe « reyce-evenement.ics ».</p>
  <p class="sub">Un empêchement, une question ? Répondez simplement à cet e-mail.</p>`) };
  };
  const ownerEmail = (ev, g, updated) => {
    const label = present(g) ? 'Présent' : 'Absent';
    return { subject: `[${ev.name}] ${label} — ${g.firstName} ${g.lastName}${present(g) && g.companions ? ' (+1)' : ''}`, html: shell(`
  <p class="title">${label} — ${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</p>
  <p class="sub">${updated ? 'Réponse modifiée par l\'invité (la fiche a été mise à jour).' : 'Nouvelle réponse.'}${g.via ? ' Réponse faite avec un lien transféré.' : ''}</p>
  <table class="table"><tr><td class="lbl">Réponse</td><td>${label}${present(g) ? ' · ' + (g.companions ? '2 personnes' : '1 personne') : ''}</td></tr>
    <tr><td class="lbl">Nom</td><td>${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</td></tr><tr><td class="lbl">Téléphone</td><td>${escapeHtml(g.phone)}</td></tr><tr><td class="lbl">E-mail</td><td>${escapeHtml(g.email)}</td></tr>
    ${g.allergies ? `<tr><td class="lbl">Allergie / préférence</td><td>${escapeHtml(g.allergies)}</td></tr>` : ''}</table>
  <a class="btn2" href="${BASE()}/admin.html">Ouvrir le CRM (Événements)</a>`) };
  };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
  const mailReady = () => !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN);

  // ---------- limitation des envois ----------
  const rsvpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.RSVP_LIMIT) || 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de réponses envoyées depuis cette connexion. Réessayez dans un moment, ou appelez-nous au 07 63 00 43 85.' } });
  const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de demandes. Réessayez dans un moment.' } });

  // ============================================================
  // Public : informations de l'événement, invitation personnelle, réponse
  // ============================================================
  app.get('/api/events/:slug/public', readLimiter, async (req, res) => {
    const ev = await getEvent(String(req.params.slug));
    if (!ev || ev.status === 'archived') return res.status(404).json({ error: 'Événement introuvable' });
    res.json({ ok: true, event: publicEvent(ev), closed: closed(ev) });
  });

  app.get('/api/events/:slug/calendar.ics', readLimiter, async (req, res) => {
    const ev = await getEvent(String(req.params.slug));
    if (!ev) return res.status(404).type('text/plain').send('Introuvable');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="reyce-evenement.ics"');
    res.send(icsText(ev));
  });

  // Reconnaissance d'un lien personnel : seul le prénom est renvoyé (jamais le nom, l'e-mail ni le téléphone)
  app.get('/api/events/:slug/invite/:code', readLimiter, async (req, res) => {
    const slug = String(req.params.slug), code = String(req.params.code);
    if (!goodCode(code)) return res.json({ ok: false });
    const row = await guestByCode(slug, code);
    if (!row) return res.json({ ok: false });
    const g = gOf(row);
    res.json({ ok: true, firstName: g.firstName, status: g.status, companions: g.companions || 0, allergies: g.allergies || '', needsEmail: !g.email });
  });

  app.post(['/api/events/:slug/rsvp', '/api/soiree/rsvp'], rsvpLimiter, express.json({ limit: '8kb' }), async (req, res) => {
    const slug = req.params.slug || DEFAULT_SLUG; const b = req.body || {};
    if (b.website) return res.json({ ok: true });                                  // champ piège rempli : un robot, on ne dit rien et on n'enregistre rien
    const ev = await getEvent(slug);
    if (!ev || ev.status === 'archived') return res.status(404).json({ ok: false, error: 'Cet événement est introuvable.' });
    if (closed(ev)) return res.status(409).json({ ok: false, error: 'Les réponses sont closes. Appelez-nous au 07 63 00 43 85.' });
    const bad = (field, error) => res.status(400).json({ ok: false, field, error });

    const reponse = b.reponse === 'present' ? 'present' : (b.reponse === 'absent' ? 'absent' : '');
    if (!reponse) return bad('reponse', 'Merci de nous dire si vous serez présent(e).');
    const code = goodCode(String(b.code || '').toLowerCase()) ? String(b.code).toLowerCase() : '';
    const inEmail = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 254) : '';
    const inFirst = cleanText(b.prenom, 80), inLast = cleanText(b.nom, 80), inPhone = cleanPhone(b.telephone);
    const companions = reponse === 'present' && Number(b.personnes) === 2 ? 1 : 0;
    const allergies = reponse === 'present' ? cleanText(b.allergies, 300, true) : '';

    let invited = null;
    if (code) { const row = await guestByCode(slug, code); if (row) invited = row; }
    // lien personnel utilisé avec une autre adresse que celle de l'invité : lien transféré, on ne touche pas à la fiche d'origine
    const transferred = !!(invited && inEmail && invited.payload.email && inEmail !== invited.payload.email);
    const target = invited && !transferred ? invited : null;

    let firstName = inFirst, lastName = inLast, email = inEmail, phone = inPhone;
    if (target) { const p = target.payload; firstName = p.firstName || inFirst; lastName = p.lastName || inLast; email = p.email || inEmail; phone = p.phone || inPhone; }
    if (!firstName) return bad('prenom', 'Merci d’indiquer votre prénom.');
    if (!lastName && !target) return bad('nom', 'Merci d’indiquer votre nom.');
    if (email ? !isValidEmail(email) : !target) return bad('email', 'Merci d’indiquer une adresse e-mail valide.');
    if (!target && phone.replace(/\D/g, '').length < 9) return bad('telephone', 'Merci d’indiquer un numéro de téléphone valide.');

    let saved;
    try {
      saved = await withLock(slug + ':' + (target ? 'c:' + code : 'e:' + email), async () => {
        const now = nowIso(); const status = reponse === 'present' ? 'confirmed' : 'declined';
        let row = target ? await prisma.eventLog.findUnique({ where: { id: target.id } }) : await guestByEmail(slug, email);
        if (row) {
          const p = { ...row.payload }; const before = p.status;
          if (!p.email && email) p.email = email; if (!p.phone && phone) p.phone = phone; if (!p.lastName && lastName) p.lastName = lastName;
          p.status = status; p.companions = companions; p.allergies = allergies; p.respondedAt = p.respondedAt || now; p.updatedAt = now; p.answers = (p.answers || 0) + 1;
          p.history = [...(p.history || []), { at: now, what: 'Réponse : ' + (status === 'confirmed' ? 'présence confirmée' : 'invitation déclinée') + (before && before !== status ? ' (avant : ' + (before === 'pending' ? 'en attente' : before === 'confirmed' ? 'présence confirmée' : 'déclinée') + ')' : '') }];
          const upd = await saveGuest(row, p); return { guest: gOf(upd), updated: true };
        }
        const known = await clientFor(email);
        const p = { eventSlug: slug, code: newCode(), firstName, lastName, email, phone, channel: transferred ? 'Lien transféré' : 'Lien partagé', via: transferred ? invited.payload.code : '', clientId: known ? known.id : '',
          status, companions, allergies, invitedAt: null, respondedAt: now, updatedAt: now, answers: 1, attendance: 'unknown', arrivedAt: '', arrivedPersons: 0, notes: '',
          history: [{ at: now, what: (transferred ? 'Réponse avec un lien transféré : ' : 'Réponse : ') + (status === 'confirmed' ? 'présence confirmée' : 'invitation déclinée') }] };
        const created = await prisma.eventLog.create({ data: { type: 'eguest', payload: p } }); return { guest: gOf(created), updated: false };
      });
    } catch (err) {
      console.error('[Événements] enregistrement impossible :', err.message);
      return res.status(503).json({ ok: false, error: 'Votre réponse n’a pas pu être enregistrée. Réessayez dans un instant, ou appelez-nous au 07 63 00 43 85.' });
    }

    // e-mails : l'atelier est prévenu à chaque réponse ; l'invité reçoit sa confirmation s'il vient et si on connaît son adresse
    const g = saved.guest; let emailed = false;
    if (mailReady()) {
      const owner = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com'; const jobs = [];
      const mo = ownerEmail(ev, g, saved.updated);
      jobs.push(withTimeout(sendEmail(owner, mo.subject, mo.html, null, { replyTo: g.email || owner }), 8000).catch(e => console.error('[Événements] e-mail atelier :', e.message)));
      if (present(g) && g.email) {
        const mg = guestEmail(ev, g);
        const att = [{ filename: 'reyce-evenement.ics', contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', buffer: Buffer.from(icsText(ev), 'utf8') }];
        jobs.push(withTimeout(sendEmail(g.email, mg.subject, mg.html, att, { replyTo: owner }).then(() => { emailed = true; }), 8000).catch(e => console.error('[Événements] e-mail invité :', e.message)));
      }
      await Promise.all(jobs);
    }
    res.json({ ok: true, reponse, personnes: companions ? 2 : 1, firstName: g.firstName, emailed, updated: saved.updated });
  });

  // ============================================================
  // CRM (authentification et garde d'origine déjà appliquées à /api/admin)
  // ============================================================
  const rowOut = async (ev, gs) => {
    const emails = [...new Set(gs.map(g => g.email).filter(Boolean))];
    const known = new Set();
    if (emails.length) {
      try { (await prisma.client.findMany({ where: { email: { in: emails } }, select: { email: true } })).forEach(c => known.add(c.email)); } catch (e) { /* sans importance */ }
      try { (await prisma.appointment.findMany({ where: { guestEmail: { in: emails }, status: { not: 'pending_payment' } }, select: { guestEmail: true }, distinct: ['guestEmail'] })).forEach(a => known.add(a.guestEmail)); } catch (e) { /* sans importance */ }
    }
    return gs.map(g => ({ ...g, persons: personsOf(g), link: linkOf(ev, g), isClient: !!(g.email && known.has(g.email)) }));
  };
  const evOut = (ev, t) => ({ ...ev, ...when(ev), totals: t, longDate: longDate(ev), mapsUrl: mapsUrl(ev), closed: closed(ev) });

  app.get('/api/admin/events', async (req, res) => {
    const evs = await listEvents(); const out = [];
    for (const ev of evs) out.push(evOut(ev, totals((await guestRows(ev.slug)).map(gOf))));
    const upcoming = e => e.status !== 'archived' && Date.parse(e.endUtc) > Date.now();            // à venir d'abord (le plus proche en premier), puis terminés et archivés (le plus récent en premier)
    out.sort((a, b) => (upcoming(b) ? 1 : 0) - (upcoming(a) ? 1 : 0) || (upcoming(a) ? Date.parse(a.startUtc) - Date.parse(b.startUtc) : Date.parse(b.startUtc) - Date.parse(a.startUtc)));
    res.json({ events: out, channels: CHANNELS });
  });

  app.post('/api/admin/events', express.json({ limit: '16kb' }), async (req, res) => {
    const b = req.body || {}; const name = cleanText(b.name, 100);
    const start = parisToUtc(b.date, b.start), end = parisToUtc(b.date, b.end);
    if (!name) return res.status(400).json({ error: 'Le nom de l’événement est obligatoire.' });
    if (!start || !end || Date.parse(end) <= Date.parse(start)) return res.status(400).json({ error: 'Date, heure de début et heure de fin sont obligatoires (la fin après le début).' });
    let slug = slugify(name) + '-' + b.date; if (await eventRow(slug)) slug += '-' + newCode().slice(0, 4);
    const ev = { slug, name, kind: cleanText(b.kind, 60) || 'Événement', path: '/soiree?e=' + slug, startUtc: start, endUtc: end, place: cleanText(b.place, 120) || 'Atelier REYCE', address: cleanText(b.address, 200) || '47 chemin du Pras, 69350 La Mulatière',
      dressCode: cleanText(b.dressCode, 80), deadline: /^\d{4}-\d{2}-\d{2}$/.test(b.deadline || '') ? b.deadline : '', inviteMessage: cleanText(b.inviteMessage, 500, true) || DEFAULT_EVENT.inviteMessage, notes: cleanText(b.notes, 1000, true), status: 'active', pageReady: false };
    const row = await prisma.eventLog.create({ data: { type: 'event', payload: ev } });
    res.json({ ok: true, event: evOut(evOf(row), totals([])) });
  });

  app.get('/api/admin/events/by-email/:email', async (req, res) => {         // historique d'une personne (fiche contact)
    const email = String(req.params.email || '').trim().toLowerCase(); if (!email) return res.json({ events: [] });
    const rows = await prisma.eventLog.findMany({ where: { type: 'eguest', payload: { path: ['email'], equals: email } }, orderBy: { createdAt: 'desc' }, take: 50 });
    const out = [];
    for (const r of rows) { const g = gOf(r); const ev = await getEvent(g.eventSlug); out.push({ event: ev ? ev.name : g.eventSlug, date: ev ? longDate(ev) : '', status: g.status, companions: g.companions || 0, attendance: g.attendance, channel: g.channel }); }
    res.json({ events: out });
  });

  app.get('/api/admin/events/:slug', async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const gs = (await guestRows(ev.slug)).map(gOf);
    res.json({ event: evOut(ev, totals(gs)), guests: (await rowOut(ev, gs)).reverse(), channels: CHANNELS });
  });

  app.patch('/api/admin/events/:slug', express.json({ limit: '16kb' }), async (req, res) => {
    const row = await eventRow(String(req.params.slug)); if (!row) return res.status(404).json({ error: 'Événement introuvable' });
    const b = req.body || {}; const p = { ...row.payload };
    if (b.name !== undefined) { const n = cleanText(b.name, 100); if (!n) return res.status(400).json({ error: 'Le nom est obligatoire.' }); p.name = n; }
    if (b.kind !== undefined) p.kind = cleanText(b.kind, 60) || p.kind;
    if (b.date || b.start || b.end) {
      const cur = when(p); const date = b.date || cur.date, s = b.start || cur.start, e = b.end || cur.end;
      const st = parisToUtc(date, s), en = parisToUtc(date, e);
      if (!st || !en || Date.parse(en) <= Date.parse(st)) return res.status(400).json({ error: 'Date et heures invalides (la fin doit suivre le début).' });
      p.startUtc = st; p.endUtc = en;
    }
    for (const [k, max] of [['place', 120], ['address', 200], ['dressCode', 80]]) if (b[k] !== undefined) p[k] = cleanText(b[k], max);
    if (b.deadline !== undefined) p.deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline || '') ? b.deadline : '';
    if (b.inviteMessage !== undefined) p.inviteMessage = cleanText(b.inviteMessage, 500, true) || DEFAULT_EVENT.inviteMessage;
    if (b.notes !== undefined) p.notes = cleanText(b.notes, 1000, true);
    if (b.status === 'active' || b.status === 'archived') p.status = b.status;
    const upd = await prisma.eventLog.update({ where: { id: row.id }, data: { payload: p } });
    const ev = evOf(upd); res.json({ ok: true, event: evOut(ev, totals((await guestRows(ev.slug)).map(gOf))) });
  });

  // création d'invitations (une à une ou en liste) : un code personnel opaque est généré, rien n'est envoyé
  async function createInvite(ev, o) {
    const firstName = cleanText(o.firstName, 80), lastName = cleanText(o.lastName, 80);
    const email = typeof o.email === 'string' ? o.email.trim().toLowerCase().slice(0, 254) : ''; const phone = cleanPhone(o.phone);
    if (!firstName) return { error: 'Prénom manquant' };
    if (email && !isValidEmail(email)) return { error: 'E-mail invalide (' + email + ')' };
    return withLock(ev.slug + ':e:' + (email || firstName + lastName), async () => {
      if (email) { const ex = await guestByEmail(ev.slug, email); if (ex) return { existing: gOf(ex) }; }
      else { const all = (await guestRows(ev.slug)).map(gOf).find(g => !g.email && g.firstName.toLowerCase() === firstName.toLowerCase() && (g.lastName || '').toLowerCase() === lastName.toLowerCase()); if (all) return { existing: all }; }
      const known = await clientFor(email); const now = nowIso();
      const channel = CHANNELS.includes(o.channel) ? o.channel : (phone && !email ? 'WhatsApp' : 'E-mail');
      const p = { eventSlug: ev.slug, code: newCode(), firstName, lastName: lastName || (known ? known.lastName : ''), email, phone: phone || (known ? known.phone : ''), channel, via: '', clientId: known ? known.id : '',
        status: o.status === 'confirmed' ? 'confirmed' : 'pending', companions: o.companions ? 1 : 0, allergies: '', invitedAt: null, respondedAt: o.status === 'confirmed' ? now : null, updatedAt: now, answers: 0,
        attendance: o.attendance === 'present' ? 'present' : 'unknown', arrivedAt: o.attendance === 'present' ? now : '', arrivedPersons: 0, notes: cleanText(o.notes, 300, true), history: [{ at: now, what: o.channel === 'Sur place' ? 'Ajouté sur place' : 'Invitation préparée (' + channel + ')' }] };
      return { guest: gOf(await prisma.eventLog.create({ data: { type: 'eguest', payload: p } })) };
    });
  }
  app.post('/api/admin/events/:slug/guests', express.json({ limit: '16kb' }), async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const b = req.body || {}; const r = await createInvite(ev, { firstName: b.firstName, lastName: b.lastName, email: b.email, phone: b.phone, channel: b.channel, notes: b.notes, status: b.status, companions: b.companions, attendance: b.attendance });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, existing: !!r.existing, guest: (await rowOut(ev, [r.guest || r.existing]))[0] });
  });
  app.post('/api/admin/events/:slug/guests/bulk', express.json({ limit: '200kb' }), async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const lines = String(req.body && req.body.lines || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 1000);
    let created = 0, existing = 0; const errors = [];
    for (const [i, line] of lines.entries()) {
      const sep = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
      const [firstName, lastName, email, phone, channel] = line.split(sep).map(s => s.trim());
      if (/^pr[ée]nom$/i.test(firstName || '')) continue;                       // ligne d'en-tête
      const r = await createInvite(ev, { firstName, lastName, email, phone, channel });
      if (r.error) errors.push(`Ligne ${i + 1} : ${r.error}`); else if (r.existing) existing++; else created++;
    }
    res.json({ ok: true, created, existing, errors: errors.slice(0, 20) });
  });

  app.patch('/api/admin/events/:slug/guests/:id', express.json({ limit: '8kb' }), async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const row = await prisma.eventLog.findFirst({ where: { id: String(req.params.id), type: 'eguest' } });
    if (!row || row.payload.eventSlug !== ev.slug) return res.status(404).json({ error: 'Invité introuvable' });
    const b = req.body || {}; const p = { ...row.payload }; const now = nowIso(); const log = w => { p.history = [...(p.history || []), { at: now, what: w }]; };
    if (['pending', 'confirmed', 'declined'].includes(b.status) && b.status !== p.status) { p.status = b.status; if (b.status !== 'confirmed') p.companions = 0; p.respondedAt = p.respondedAt || now; log('Statut changé dans le CRM : ' + ({ pending: 'en attente', confirmed: 'présence confirmée', declined: 'déclinée' })[b.status]); }
    if (b.companions !== undefined) { p.companions = Number(b.companions) ? 1 : 0; }
    if (b.attendance !== undefined && ['unknown', 'present', 'absent'].includes(b.attendance) && b.attendance !== p.attendance) {
      p.attendance = b.attendance; p.arrivedAt = b.attendance === 'present' ? now : '';
      p.arrivedPersons = b.attendance === 'present' ? Math.max(1, Math.min(5, Number(b.arrivedPersons) || (personsOf(p) || 1))) : 0;
      log(b.attendance === 'present' ? 'Arrivé(e) à l’événement' : b.attendance === 'absent' ? 'Non venu(e)' : 'Présence constatée retirée');
    } else if (b.arrivedPersons !== undefined && p.attendance === 'present') p.arrivedPersons = Math.max(1, Math.min(5, Number(b.arrivedPersons) || 1));
    if (b.channel !== undefined && CHANNELS.includes(b.channel)) p.channel = b.channel;
    if (b.notes !== undefined) p.notes = cleanText(b.notes, 300, true);
    if (b.allergies !== undefined) p.allergies = cleanText(b.allergies, 300, true);
    if (b.invited === true && !p.invitedAt) { p.invitedAt = now; log('Invitation envoyée (' + p.channel + ')'); }
    for (const [k, max] of [['firstName', 80], ['lastName', 80]]) if (b[k] !== undefined) { const v = cleanText(b[k], max); if (v) p[k] = v; }
    if (b.phone !== undefined) p.phone = cleanPhone(b.phone);
    if (b.email !== undefined) { const e = String(b.email).trim().toLowerCase(); if (e === '' || isValidEmail(e)) p.email = e; else return res.status(400).json({ error: 'E-mail invalide' }); }
    p.updatedAt = now;
    const upd = await saveGuest(row, p);
    res.json({ ok: true, guest: (await rowOut(ev, [gOf(upd)]))[0], totals: totals((await guestRows(ev.slug)).map(gOf)) });
  });

  app.delete('/api/admin/events/:slug/guests/:id', async (req, res) => {
    const row = await prisma.eventLog.findFirst({ where: { id: String(req.params.id), type: 'eguest' } });
    if (!row || row.payload.eventSlug !== String(req.params.slug)) return res.status(404).json({ error: 'Invité introuvable' });
    await prisma.eventLog.delete({ where: { id: row.id } }); res.json({ ok: true });
  });

  // ---------- contacts déjà connus du CRM (clients avec réservation, fiches clients, demandes de devis et messages) ----------
  const LEAD_SOURCE = { devis: 'Demande de devis', pro: 'Demande professionnelle', message: 'Message', manuel: 'Saisie manuelle' };
  async function crmContacts() {
    const map = new Map();
    const add = (email, o) => {
      email = String(email || '').trim().toLowerCase(); if (!email || !isValidEmail(email)) return;
      const cur = map.get(email);
      if (!cur) map.set(email, { email, firstName: o.firstName || '', lastName: o.lastName || '', phone: o.phone || '', source: o.source });
      else { cur.firstName = cur.firstName || o.firstName || ''; cur.lastName = cur.lastName || o.lastName || ''; cur.phone = cur.phone || o.phone || ''; if (o.source === 'Client') cur.source = 'Client'; }
    };
    try { (await prisma.appointment.findMany({ where: { status: { not: 'pending_payment' } }, select: { guestEmail: true, guestFirstName: true, guestLastName: true, guestPhone: true }, distinct: ['guestEmail'], take: 3000 }))
      .forEach(a => add(a.guestEmail, { firstName: a.guestFirstName, lastName: a.guestLastName, phone: a.guestPhone, source: 'Client' })); } catch (e) { console.error('[Événements] contacts clients :', e.message); }
    try { (await prisma.client.findMany({ take: 3000 })).forEach(c => add(c.email, { firstName: c.firstName, lastName: c.lastName, phone: c.phone, source: 'Client' })); } catch (e) { console.error('[Événements] fiches clients :', e.message); }
    try { (await prisma.eventLog.findMany({ where: { type: 'lead' }, orderBy: { createdAt: 'desc' }, take: 3000 })).forEach(r => { const l = r.payload || {}; add(l.email, { firstName: l.firstName, lastName: l.lastName, phone: l.phone, source: LEAD_SOURCE[l.kind] || 'Demande' }); }); } catch (e) { console.error('[Événements] demandes :', e.message); }
    return map;
  }
  app.get('/api/admin/events/:slug/crm-contacts', async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const invited = new Set((await guestRows(ev.slug)).map(r => r.payload.email).filter(Boolean));
    const contacts = [...(await crmContacts()).values()].filter(c => c.firstName && !invited.has(c.email))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
    res.json({ contacts: contacts.slice(0, 3000), alreadyInvited: invited.size });
  });
  app.post('/api/admin/events/:slug/guests/from-crm', express.json({ limit: '64kb' }), async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const wanted = [...new Set((Array.isArray(req.body && req.body.emails) ? req.body.emails : []).map(e => String(e).trim().toLowerCase()))].slice(0, 500);
    const all = await crmContacts(); let created = 0, existing = 0, skipped = 0;
    for (const email of wanted) {                                          // les coordonnées viennent du CRM, jamais du navigateur
      const c = all.get(email); if (!c || !c.firstName) { skipped++; continue; }
      const r = await createInvite(ev, { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, channel: c.phone ? 'WhatsApp' : 'E-mail' });
      if (r.error) skipped++; else if (r.existing) existing++; else created++;
    }
    res.json({ ok: true, created, existing, skipped });
  });

  const csvCell = v => { let s = String(v == null ? '' : v).replace(/\r?\n/g, ' '); if (/^[=+\-@\t]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  app.get('/api/admin/events/:slug/export.csv', async (req, res) => {
    const ev = await getEvent(String(req.params.slug)); if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const gs = (await guestRows(ev.slug)).map(gOf);
    const st = { pending: 'En attente', confirmed: 'Présence confirmée', declined: 'Invitation déclinée' };
    const head = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Canal', 'Statut', 'Accompagnants', 'Personnes attendues', 'Allergies / préférences', 'Présence constatée', 'Personnes arrivées', 'Lien personnel', 'Invité le', 'Réponse le', 'Notes'];
    const lines = [head.map(csvCell).join(';')].concat(gs.map(g => [g.firstName, g.lastName, g.email, g.phone, g.channel, st[g.status], g.companions || 0, personsOf(g), g.allergies, g.attendance === 'present' ? 'Arrivé(e)' : g.attendance === 'absent' ? 'Non venu(e)' : '', g.attendance === 'present' ? g.arrivedPersons : '', linkOf(ev, g), g.invitedAt || '', g.respondedAt || '', g.notes].map(csvCell).join(';')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${ev.slug}-invites.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  });
};
module.exports.DEFAULT_SLUG = DEFAULT_SLUG;

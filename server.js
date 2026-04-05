'use strict';
require('dotenv').config();

const express    = require('express');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const fs         = require('fs');
const path       = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS = path.join(DATA_DIR, 'bookings.json');

// ============================================================
// Configuration des prestations
// ============================================================
const SERVICES = {
  'lavage-confort': {
    name:         'Lavage Confort',
    depositCents: 4000,
    durationMin:  60,
    slots:        ['09:00', '11:00', '14:00', '16:00']
  },
  'lavage-premium': {
    name:         'Lavage Premium',
    depositCents: 4000,
    durationMin:  120,
    slots:        ['09:00', '11:30', '14:00']
  },
  'lavage-experience': {
    name:         'Lavage Expérience',
    depositCents: 4000,
    durationMin:  480,
    slots:        ['09:00']
  },
  'vitres-teintees': {
    name:         'Vitres Teintées',
    depositCents: 4000,
    durationMin:  240,
    slots:        ['09:00', '13:30']
  }
};

// ============================================================
// Helpers — dates
// ============================================================
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin',
                   'juillet','août','septembre','octobre','novembre','décembre'];
const DAYS_FR   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

// ============================================================
// Helpers — réservations
// ============================================================
function readBookings() {
  if (!fs.existsSync(BOOKINGS)) return [];
  try { return JSON.parse(fs.readFileSync(BOOKINGS, 'utf8')); }
  catch { return []; }
}

function saveBooking(booking) {
  const all = readBookings();
  all.push(booking);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOOKINGS, JSON.stringify(all, null, 2));
}

// ============================================================
// Emails — Resend
// ============================================================

// ── Email client : confirmation de réservation ────────────────
function buildClientEmail(data, svc) {
  const tintLine = data.tintOption
    ? `<tr><td class="label">Film teinté</td><td>${data.tintOption === 'legal' ? 'Homologuée' : 'Très sombre'}</td></tr>`
    : '';
  const vehicleLine = [data.vehicleType, data.vehicleModel].filter(Boolean).join(' — ') || '—';
  const notesLine = data.client.notes?.trim()
    ? `<tr><td class="label">Notes</td><td>${data.client.notes}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#070707; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#e0e0e0; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:560px; margin:0 auto; padding:56px 32px; }
  .logo { font-size:18px; font-weight:600; letter-spacing:0.38em; text-transform:uppercase; color:#fff; margin-bottom:56px; }
  .check { width:48px; height:48px; border:1px solid rgba(191,200,208,0.3); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:28px; }
  .title { font-size:30px; font-weight:300; color:#fff; line-height:1.2; margin-bottom:10px; font-style:italic; }
  .sub { font-size:14px; color:#777; margin-bottom:48px; line-height:1.75; }
  .badge { display:inline-block; border:1px solid #222; padding:5px 14px; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:#bfc8d0; margin-bottom:28px; }
  .table { width:100%; border-collapse:collapse; margin-bottom:28px; }
  .table td { padding:14px 0; border-bottom:1px solid #181818; font-size:14px; vertical-align:top; line-height:1.5; }
  .table td.lbl { color:#555; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; width:40%; padding-top:16px; }
  .table td.val { color:#e0e0e0; }
  .accent { color:#bfc8d0; font-weight:500; }
  .box { background:#0f0f0f; border:1px solid #1c1c1c; padding:20px 24px; margin-bottom:32px; }
  .box p { font-size:13px; color:#666; line-height:1.8; }
  .box strong { color:#999; }
  .divider { border:none; border-top:1px solid #181818; margin:32px 0; }
  .addr-title { font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:#555; margin-bottom:12px; }
  .addr-val { font-size:13px; color:#888; line-height:1.9; }
  .addr-val a { color:#999; text-decoration:none; }
  .footer { border-top:1px solid #141414; padding-top:24px; margin-top:40px; }
  .footer p { font-size:11px; color:#444; line-height:1.8; }
  .footer a { color:#555; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">

  <div class="logo">REYCE</div>

  <div class="check">
    <svg width="16" height="13" viewBox="0 0 16 13" fill="none"><path d="M1 6.5l4.5 4.5L15 1" stroke="#bfc8d0" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>

  <p class="title">Votre rendez-vous<br>est confirmé.</p>
  <p class="sub">
    Bonjour ${data.client.firstName},<br>
    votre acompte a bien été encaissé. Nous avons hâte de prendre soin de votre véhicule.
  </p>

  <div class="badge">Récapitulatif de réservation</div>

  <table class="table">
    <tr><td class="lbl">Prestation</td><td class="val">${svc.name}</td></tr>
    <tr><td class="lbl">Date</td><td class="val">${formatDate(data.date)}</td></tr>
    <tr><td class="lbl">Heure</td><td class="val">${data.time}</td></tr>
    <tr><td class="lbl">Véhicule</td><td class="val">${vehicleLine}</td></tr>
    ${tintLine}
    ${notesLine}
    <tr><td class="lbl">Acompte payé</td><td class="val"><span class="accent">${svc.depositCents / 100}&thinsp;€</span> — déduit du montant final</td></tr>
  </table>

  <div class="box">
    <p>
      <strong>Annulation :</strong> toute annulation moins de 24h avant le rendez-vous ou absence non signalée pourra entraîner la conservation de l'acompte.<br><br>
      Pour modifier ou annuler, contactez-nous le plus tôt possible.
    </p>
  </div>

  <hr class="divider">

  <p class="addr-title">Où nous trouver</p>
  <p class="addr-val">
    47 chemin du Pras · La Mulatière, Lyon<br>
    07 63 00 43 85<br>
    reyceatelier@gmail.com
  </p>

  <div class="footer">
    <p>
      REYCE · Atelier automobile premium · Lyon<br>
      www.reyce.fr · @reyce.lyon
    </p>
  </div>

</div>
</body>
</html>`;

  return {
    subject: `Réservation confirmée — ${svc.name} · ${formatDate(data.date)}`,
    html
  };
}

// ── Email propriétaire : nouvelle réservation ─────────────────
function buildOwnerEmail(data, svc) {
  const tintLine = data.tintOption
    ? `<tr><td class="label">Film teinté</td><td>${data.tintOption === 'legal' ? 'Homologuée' : 'Très sombre'}</td></tr>`
    : '';
  const vehicleLine = [data.vehicleType, data.vehicleModel].filter(Boolean).join(' — ') || '—';
  const notesLine = data.client.notes?.trim()
    ? `<tr><td class="label">Notes client</td><td>${data.client.notes}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#080808; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#e8e8e8; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:560px; margin:0 auto; padding:48px 24px; }
  .logo { font-size:22px; font-weight:500; letter-spacing:0.35em; text-transform:uppercase; color:#ffffff; margin-bottom:48px; }
  .badge { display:inline-block; background:#1a1a1a; border:1px solid #2a2a2a; padding:6px 14px; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#bfc8d0; margin-bottom:32px; }
  .title { font-size:24px; font-weight:300; color:#ffffff; line-height:1.2; margin-bottom:8px; }
  .sub { font-size:14px; color:#888; margin-bottom:32px; line-height:1.7; }
  .table { width:100%; border-collapse:collapse; margin-bottom:32px; }
  .table td { padding:13px 0; border-bottom:1px solid #1c1c1c; font-size:14px; vertical-align:top; }
  .table td.label { color:#666; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; width:38%; padding-top:15px; }
  .table td:last-child { color:#e8e8e8; }
  .amount { font-size:20px; color:#bfc8d0; font-weight:400; }
  .footer { border-top:1px solid #1a1a1a; padding-top:28px; }
  .footer p { font-size:12px; color:#555; line-height:1.8; }
</style>
</head>
<body>
<div class="wrap">

  <div class="logo">REYCE</div>
  <div class="badge">Nouvelle réservation</div>

  <p class="title">Nouveau rendez-vous confirmé.</p>
  <p class="sub">Un client vient de réserver et de payer son acompte avec succès.</p>

  <table class="table">
    <tr><td class="label">Prestation</td><td>${svc.name}</td></tr>
    <tr><td class="label">Date</td><td>${formatDate(data.date)}</td></tr>
    <tr><td class="label">Heure</td><td>${data.time}</td></tr>
    <tr><td class="label">Véhicule</td><td>${vehicleLine}</td></tr>
    ${tintLine}
    <tr><td class="label">Client</td><td>${data.client.firstName} ${data.client.lastName}</td></tr>
    <tr><td class="label">Téléphone</td><td>${data.client.phone}</td></tr>
    <tr><td class="label">Email</td><td>${data.client.email}</td></tr>
    ${notesLine}
    <tr><td class="label">Acompte reçu</td><td><span class="amount">${svc.depositCents / 100}&thinsp;€</span></td></tr>
  </table>

  <div class="footer">
    <p>Email automatique — REYCE Booking System</p>
  </div>

</div>
</body>
</html>`;

  return {
    subject: `[RDV] ${svc.name} — ${data.client.firstName} ${data.client.lastName} · ${formatDate(data.date)} à ${data.time}`,
    html
  };
}

// ── Envoi des deux emails ─────────────────────────────────────
async function sendConfirmationEmails(data, svc) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY non configuré — emails ignorés');
    return;
  }

  const resend      = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.EMAIL_FROM || 'REYCE <onboarding@resend.dev>';
  const ownerEmail  = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com';

  try {
    const clientMail = buildClientEmail(data, svc);
    const ownerMail  = buildOwnerEmail(data, svc);

    const [clientResult, ownerResult] = await Promise.allSettled([
      resend.emails.send({ from: fromAddress, to: data.client.email,  subject: clientMail.subject, html: clientMail.html }),
      resend.emails.send({ from: fromAddress, to: ownerEmail,          subject: ownerMail.subject,  html: ownerMail.html  })
    ]);

    if (clientResult.status === 'fulfilled') {
      console.log(`[Email] ✓ Client → ${data.client.email} | id: ${clientResult.value?.data?.id}`);
    } else {
      console.error(`[Email] ✗ Client → ${data.client.email} | erreur: ${JSON.stringify(clientResult.reason)}`);
    }

    if (ownerResult.status === 'fulfilled') {
      console.log(`[Email] ✓ Owner  → ${ownerEmail} | id: ${ownerResult.value?.data?.id}`);
    } else {
      console.error(`[Email] ✗ Owner  → ${ownerEmail} | erreur: ${JSON.stringify(ownerResult.reason)}`);
    }
  } catch (err) {
    console.error('[Email] Erreur envoi :', err.message);
  }
}

// ============================================================
// Webhook Stripe
// IMPORTANT : avant express.json() — Stripe nécessite le body brut
// ============================================================
app.post('/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[Webhook] Signature invalide :', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.metadata?.bookingType === 'reyce') {
        try {
          const data = JSON.parse(session.metadata.bookingData);
          const svc  = SERVICES[data.service];

          saveBooking({
            sessionId:  session.id,
            status:     'confirmed',
            paidAt:     new Date().toISOString(),
            amountPaid: session.amount_total,
            ...data
          });

          console.log(`[Webhook] ✓ Réservation confirmée : ${session.id}`);

          // Envoi des emails de confirmation (non bloquant)
          sendConfirmationEmails(data, svc).catch(err =>
            console.error('[Email] Erreur post-webhook :', err.message)
          );

        } catch (e) {
          console.error('[Webhook] Erreur sauvegarde :', e);
        }
      }
    }

    res.json({ received: true });
  }
);

// ============================================================
// Middleware
// IMPORTANT : express.static et express.json après le webhook
// ============================================================
app.use(express.static(path.join(__dirname)));

// ============================================================
// Routes API
// ============================================================

// ── Contact / Devis ──────────────────────────────────────────
app.use('/api/contact', express.json());
app.post('/api/contact', async (req, res) => {
  const { type, firstName, lastName, email, phone, subject, message, source, vehicleInfo } = req.body;

  if (!email || !firstName) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('[Contact] RESEND_API_KEY non configuré — email ignoré');
    return res.json({ ok: true });
  }

  const resend      = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.EMAIL_FROM || 'REYCE <onboarding@resend.dev>';
  const ownerEmail  = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com';

  const isDevis   = type === 'devis';
  const subjectLine = isDevis
    ? `[Devis] ${subject || 'Demande de devis'} — ${firstName} ${lastName}`
    : `[Contact] ${subject || 'Message'} — ${firstName} ${lastName}`;

  const vehicleBlock = vehicleInfo
    ? `<tr><td class="lbl">Véhicule</td><td>${vehicleInfo}</td></tr>` : '';
  const sourceBlock  = source
    ? `<tr><td class="lbl">Source</td><td>${source}</td></tr>` : '';
  const subjectBlock = subject
    ? `<tr><td class="lbl">Objet</td><td>${subject}</td></tr>` : '';
  const messageBlock = message
    ? `<tr><td class="lbl">Message</td><td style="white-space:pre-wrap">${message}</td></tr>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{background:#080808;margin:0;padding:40px 20px;font-family:sans-serif;}
  .wrap{max-width:560px;margin:0 auto;background:#111;padding:40px;color:#e0e0e0;}
  .logo{font-size:18px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:#fff;margin-bottom:32px;}
  .badge{display:inline-block;background:#1a1a1a;border:1px solid #2a2a2a;padding:5px 12px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#bfc8d0;margin-bottom:28px;}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;}
  td{padding:10px 0;border-bottom:1px solid #1e1e1e;font-size:13px;line-height:1.6;}
  .lbl{color:#666;font-size:11px;letter-spacing:.12em;text-transform:uppercase;width:36%;vertical-align:top;padding-top:12px;}
  .reply{display:block;text-align:center;padding:12px 28px;background:#fff;color:#080808;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-top:32px;}
  .foot{font-size:11px;color:#444;text-align:center;margin-top:32px;}
</style></head><body>
<div class="wrap">
  <div class="logo">REYCE</div>
  <div class="badge">${isDevis ? 'Demande de devis' : 'Message de contact'}</div>
  <table>
    <tr><td class="lbl">Nom</td><td>${firstName} ${lastName}</td></tr>
    <tr><td class="lbl">Email</td><td>${email}</td></tr>
    <tr><td class="lbl">Téléphone</td><td>${phone || '—'}</td></tr>
    ${vehicleBlock}${subjectBlock}${sourceBlock}${messageBlock}
  </table>
  <p style="text-align:center;font-size:12px;color:#666;">Répondre directement à cet email pour contacter ${firstName}</p>
  <p class="foot">Reçu via le site reyce.fr</p>
</div></body></html>`;

  const from = 'REYCE <onboarding@resend.dev>';
  console.log(`[Contact] Envoi → from: ${from} | to: ${ownerEmail} | replyTo: ${email}`);
  try {
    const result = await resend.emails.send({
      from,
      to:      ownerEmail,
      subject: subjectLine,
      html,
      replyTo: email
    });
    console.log('[Contact] ✓ Email envoyé, id:', result?.id || JSON.stringify(result));
    res.json({ ok: true });
  } catch (err) {
    console.error('[Contact] ✗ Erreur Resend :', JSON.stringify(err));
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/slots', (req, res) => {
  const { service, date } = req.query;

  if (!service || !date || !SERVICES[service]) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) return res.json({ slots: [] });

  const taken = readBookings()
    .filter(b => b.service === service && b.date === date && b.status !== 'cancelled')
    .map(b => b.time);

  res.json({ slots: SERVICES[service].slots.filter(s => !taken.includes(s)) });
});

app.use('/api/create-checkout-session', express.json());
app.post('/api/create-checkout-session', async (req, res) => {
  const { service, vehicleType, vehicleModel, tintOption, date, time, client } = req.body;

  if (!SERVICES[service])
    return res.status(400).json({ error: 'Prestation invalide' });
  if (!date || !time)
    return res.status(400).json({ error: 'Date et créneau obligatoires' });
  if (!client?.email || !client?.firstName || !client?.lastName || !client?.phone)
    return res.status(400).json({ error: 'Coordonnées incomplètes' });

  const conflict = readBookings().filter(
    b => b.service === service && b.date === date && b.time === time && b.status !== 'cancelled'
  );
  if (conflict.length > 0)
    return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Veuillez choisir un autre horaire.' });

  const svc         = SERVICES[service];
  const bookingData = { service, vehicleType, vehicleModel, tintOption, date, time, client };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency:     'eur',
          product_data: {
            name:        `Acompte — ${svc.name}`,
            description: [`Rendez-vous : ${date} à ${time}`, vehicleType, vehicleModel]
              .filter(Boolean).join(' · ')
          },
          unit_amount: svc.depositCents
        },
        quantity: 1
      }],
      mode:           'payment',
      customer_email: client.email,
      locale:         'fr',
      success_url:    `${process.env.BASE_URL}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:     `${process.env.BASE_URL}/rendez-vous.html`,
      metadata: {
        bookingType: 'reyce',
        bookingData: JSON.stringify(bookingData)
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Erreur :', err.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement. Réessayez.' });
  }
});

app.get('/api/booking/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    if (!session || session.metadata?.bookingType !== 'reyce')
      return res.status(404).json({ error: 'Réservation introuvable' });

    const data = JSON.parse(session.metadata.bookingData);
    const svc  = SERVICES[data.service];

    res.json({
      ...data,
      serviceName:   svc?.name || data.service,
      depositAmount: (svc?.depositCents || 0) / 100,
      paymentStatus: session.payment_status,
      sessionId:     session.id
    });
  } catch {
    res.status(404).json({ error: 'Réservation introuvable' });
  }
});

// ============================================================
app.listen(PORT, () => {
  console.log(`\n  REYCE — Serveur démarré`);
  console.log(`  → http://localhost:${PORT}\n`);
  if (!process.env.RESEND_API_KEY) {
    console.log('  ⚠  RESEND_API_KEY non configuré — emails désactivés\n');
  }
});

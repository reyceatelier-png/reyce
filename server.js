'use strict';
require('dotenv').config();

const express    = require('express');
const crypto     = require('crypto');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Email via Gmail REST API (HTTPS uniquement — pas bloqué par Railway)
const path       = require('path');
const multer     = require('multer');
const upload     = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 3 } });
const prisma     = require('./db');

const app      = express();
const PORT     = process.env.PORT || 3000;

// Toute route async qui rejette (ex. base de données injoignable) doit
// répondre 500 au client au lieu de crasher tout le process Node (rejet de
// promesse non capturé). On enveloppe automatiquement chaque handler async
// enregistré via app.get/post/patch/delete — aucune route à modifier une
// par une, aucun risque d'en oublier une nouvelle à l'avenir.
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
['get', 'post', 'patch', 'delete'].forEach(method => {
  const original = app[method].bind(app);
  app[method] = (routePath, ...handlers) => original(
    routePath,
    ...handlers.map(h => (h.constructor.name === 'AsyncFunction' ? ah(h) : h))
  );
});

// ============================================================
// Configuration des prestations
// ============================================================
// Tarifs de base (gabarit Citadine). Le supplément gabarit (voir GABARIT_SUPP)
// est ajouté au moment de la création de la session Stripe.
const SERVICES = {
  'nettoyage-int-confort':      { name: 'Nettoyage Intérieur — Confort',      priceCents:  6900, depositCents: 4000, durationMin: 60,  slots: ['09:00', '11:00', '14:00', '16:00'] },
  'nettoyage-int-premium':      { name: 'Nettoyage Intérieur — Premium',      priceCents: 12900, depositCents: 4000, durationMin: 90,  slots: ['09:00', '11:30', '14:00'] },
  'nettoyage-int-experience':   { name: 'Nettoyage Intérieur — Expérience',   priceCents: 22900, depositCents: 4000, durationMin: 240, slots: ['09:00'] },
  'nettoyage-ext-confort':      { name: 'Nettoyage Extérieur — Confort',      priceCents:  4900, depositCents: 4000, durationMin: 45,  slots: ['09:00', '11:00', '14:00', '16:00'] },
  'nettoyage-ext-premium':      { name: 'Nettoyage Extérieur — Premium',      priceCents:  8900, depositCents: 4000, durationMin: 75,  slots: ['09:00', '11:30', '14:00'] },
  'nettoyage-ext-experience':   { name: 'Nettoyage Extérieur — Expérience',   priceCents: 14900, depositCents: 4000, durationMin: 180, slots: ['09:00'] },
  'nettoyage-duo-confort':      { name: 'Nettoyage Intérieur + Extérieur — Confort',    priceCents:  9900, depositCents: 4000, durationMin: 90,  slots: ['09:00', '11:00', '14:00', '16:00'] },
  'nettoyage-duo-premium':      { name: 'Nettoyage Intérieur + Extérieur — Premium',    priceCents: 19900, depositCents: 4000, durationMin: 150, slots: ['09:00', '11:30', '14:00'] },
  'nettoyage-duo-experience':   { name: 'Nettoyage Intérieur + Extérieur — Expérience', priceCents: 34900, depositCents: 4000, durationMin: 480, slots: ['09:00'] }
};

// Supplément (en centimes) ajouté au prix de base selon le gabarit détecté du véhicule.
const GABARIT_SUPP_CENTS = {
  citadine: 0,
  berline:  2000,
  suv:      4000,
  van:      7000,
  sportive: 6000
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
// Helpers — réservations (base de données PostgreSQL via Prisma)
// ============================================================
// Le reste du fichier manipule les réservations sous la forme "plate"
// historique ({ sessionId, status, date, time, client:{...}, ... }) afin de
// ne rien changer au comportement existant. Ces helpers font la traduction
// entre cette forme et le modèle Appointment de la base.

function dateToStr(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function strToDate(s) {
  return new Date(`${s}T00:00:00.000Z`);
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Statuts pilotables par l'admin (le statut "pending_payment" est interne,
// jamais exposé/settable depuis le dashboard : un rendez-vous n'existe pour
// l'admin qu'une fois le paiement confirmé par Stripe côté serveur).
const ADMIN_SETTABLE_STATUSES = ['confirmed', 'in_progress', 'ready', 'completed', 'cancelled', 'no_show'];

function toBooking(row) {
  return {
    sessionId:    row.stripeSessionId,
    status:       row.status,
    paidAt:       row.paidAt ? row.paidAt.toISOString() : null,
    amountPaid:   row.amountPaidCents,
    totalCents:   row.totalCents,
    remainingCents: Math.max(0, row.totalCents - row.amountPaidCents),
    service:      row.serviceId,
    serviceName:  SERVICES[row.serviceId]?.name || row.serviceId,
    vehicleType:  row.vehicleCategory,
    vehicleModel: row.vehicleLabel,
    tintOption:   row.tintOption,
    date:         dateToStr(row.date),
    time:         row.startTime,
    paymentType:  row.paymentType,
    internalNotes: row.internalNotes,
    client: {
      firstName: row.guestFirstName,
      lastName:  row.guestLastName,
      email:     row.guestEmail,
      phone:     row.guestPhone,
      notes:     row.guestNotes
    }
  };
}

async function readBookings() {
  const rows = await prisma.appointment.findMany({
    where: { status: { not: 'pending_payment' } }
  });
  return rows.map(toBooking);
}

async function findBookingBySessionId(sessionId) {
  const row = await prisma.appointment.findUnique({ where: { stripeSessionId: sessionId } });
  return row ? toBooking(row) : null;
}

// Pose une réservation "en attente de paiement" avant la création de la
// session Stripe (créneau tenu / soft-hold). La contrainte EXCLUDE en base
// (voir migration 20260101000001_no_overlap_constraint) rejette toute
// tentative concurrente sur le même service/créneau, indépendamment de la
// vérification applicative déjà faite plus haut dans la route.
async function holdSlot({ service, svc, date, time, vehicleType, vehicleModel, tintOption, client, paymentType, totalCents, depositCents }) {
  const placeholder = `pending_${crypto.randomUUID()}`;
  const row = await prisma.appointment.create({
    data: {
      serviceId:       service,
      date:            strToDate(date),
      startTime:       time,
      endTime:         addMinutes(time, svc.durationMin),
      durationMin:     svc.durationMin,
      status:          'pending_payment',
      guestFirstName:  client.firstName,
      guestLastName:   client.lastName,
      guestEmail:      client.email,
      guestPhone:      client.phone,
      guestNotes:      client.notes || null,
      vehicleLabel:    vehicleModel || null,
      vehicleCategory: vehicleType || null,
      tintOption:      tintOption || null,
      totalCents,
      depositCents,
      paymentType:     paymentType || 'deposit',
      stripeSessionId: placeholder
    }
  });
  return row;
}

async function attachStripeSession(appointmentId, sessionId) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { stripeSessionId: sessionId }
  });
}

async function releaseHold(appointmentId) {
  await prisma.appointment.delete({ where: { id: appointmentId } }).catch(() => {});
}

// Réservation directe, sans paiement en ligne (acompte/Stripe désactivés
// pour l'instant) : confirmée immédiatement, bloque le créneau tout de
// suite via la même contrainte que le flux Stripe.
async function createDirectBooking({ service, svc, date, time, vehicleType, vehicleModel, tintOption, client, totalCents }) {
  const localId = `local_${crypto.randomUUID()}`;
  const row = await prisma.appointment.create({
    data: {
      serviceId:       service,
      date:            strToDate(date),
      startTime:       time,
      endTime:         addMinutes(time, svc.durationMin),
      durationMin:     svc.durationMin,
      status:          'confirmed',
      guestFirstName:  client.firstName,
      guestLastName:   client.lastName,
      guestEmail:      client.email,
      guestPhone:      client.phone,
      guestNotes:      client.notes || null,
      vehicleLabel:    vehicleModel || null,
      vehicleCategory: vehicleType || null,
      tintOption:      tintOption || null,
      totalCents,
      depositCents:    0,
      amountPaidCents: 0,
      paymentType:     'on_site',
      paidAt:          null,
      stripeSessionId: localId
    }
  });
  return row;
}

async function confirmPayment(sessionId, session) {
  const existing = await prisma.appointment.findUnique({ where: { stripeSessionId: sessionId } });
  if (existing) {
    return prisma.appointment.update({
      where: { stripeSessionId: sessionId },
      data: {
        status:              'confirmed',
        paidAt:              new Date(),
        amountPaidCents:     session.amount_total,
        stripePaymentStatus: session.payment_status
      }
    });
  }
  // Filet de sécurité : pas de ligne "en attente" trouvée (ne devrait pas
  // arriver en fonctionnement normal). On enregistre quand même le paiement
  // pour ne jamais perdre une réservation payée.
  const data = JSON.parse(session.metadata.bookingData);
  const svc  = SERVICES[data.service];
  return prisma.appointment.create({
    data: {
      serviceId:           data.service,
      date:                strToDate(data.date),
      startTime:           data.time,
      endTime:             addMinutes(data.time, svc.durationMin),
      durationMin:         svc.durationMin,
      status:              'confirmed',
      guestFirstName:      data.client.firstName,
      guestLastName:       data.client.lastName,
      guestEmail:          data.client.email,
      guestPhone:          data.client.phone,
      guestNotes:          data.client.notes || null,
      vehicleLabel:        data.vehicleModel || null,
      vehicleCategory:     data.vehicleType || null,
      tintOption:          data.tintOption || null,
      totalCents:          session.amount_total,
      depositCents:        svc.depositCents,
      amountPaidCents:     session.amount_total,
      paymentType:         data.paymentType || 'deposit',
      paidAt:              new Date(),
      stripeSessionId:     sessionId,
      stripePaymentStatus: session.payment_status
    }
  });
}

async function readBlocked() {
  const rows = await prisma.unavailability.findMany({ where: { source: 'manual' } });
  const dates = [];
  const slots = {};
  for (const r of rows) {
    const date = dateToStr(r.startDate);
    if (!r.startTime) {
      if (!dates.includes(date)) dates.push(date);
    } else {
      if (!slots[date]) slots[date] = [];
      if (!slots[date].includes(r.startTime)) slots[date].push(r.startTime);
    }
  }
  return { dates, slots };
}

async function blockDate(date) {
  const already = await prisma.unavailability.findFirst({
    where: { startDate: strToDate(date), endDate: strToDate(date), startTime: null }
  });
  if (already) return;
  await prisma.unavailability.create({
    data: { startDate: strToDate(date), endDate: strToDate(date), reason: 'Journée bloquée (admin)', source: 'manual' }
  });
}

async function unblockDate(date) {
  await prisma.unavailability.deleteMany({
    where: { startDate: strToDate(date), endDate: strToDate(date), startTime: null }
  });
}

async function blockSlot(date, time) {
  const already = await prisma.unavailability.findFirst({
    where: { startDate: strToDate(date), endDate: strToDate(date), startTime: time }
  });
  if (already) return;
  await prisma.unavailability.create({
    data: { startDate: strToDate(date), endDate: strToDate(date), startTime: time, endTime: time, reason: 'Créneau bloqué (admin)', source: 'manual' }
  });
}

async function unblockSlot(date, time) {
  await prisma.unavailability.deleteMany({
    where: { startDate: strToDate(date), endDate: strToDate(date), startTime: time }
  });
}

// Libère les créneaux "tenus" (pending_payment) dont le paiement Stripe a
// été abandonné ou a échoué — sans quoi un panier abandonné bloquerait le
// créneau indéfiniment.
const HOLD_TIMEOUT_MIN = 30;
async function cleanupAbandonedHolds() {
  try {
    const cutoff = new Date(Date.now() - HOLD_TIMEOUT_MIN * 60000);
    const { count } = await prisma.appointment.deleteMany({
      where: { status: 'pending_payment', createdAt: { lt: cutoff } }
    });
    if (count > 0) console.log(`[Holds] ${count} créneau(x) en attente expiré(s) libéré(s)`);
  } catch (err) {
    console.error('[Holds] Erreur nettoyage :', err.message);
  }
}
setInterval(cleanupAbandonedHolds, 5 * 60000);

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
  const onSite = data.paymentType === 'on_site';
  const paymentRow = onSite
    ? `<tr><td class="lbl">Montant estimé</td><td class="val"><span class="accent">${((data.totalCents ?? svc.priceCents) / 100)}&thinsp;€</span> — à régler sur place</td></tr>`
    : `<tr><td class="lbl">Acompte payé</td><td class="val"><span class="accent">${svc.depositCents / 100}&thinsp;€</span> — déduit du montant final</td></tr>`;
  const cancelBoxText = onSite
    ? `<strong>Annulation :</strong> merci de nous prévenir le plus tôt possible en cas d'empêchement, idéalement plus de 24h à l'avance.`
    : `<strong>Annulation :</strong> toute annulation moins de 24h avant le rendez-vous ou absence non signalée pourra entraîner la conservation de l'acompte.<br><br>Pour modifier ou annuler, contactez-nous le plus tôt possible.`;

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
    ${onSite ? 'votre créneau est réservé.' : 'votre acompte a bien été encaissé.'} Nous avons hâte de prendre soin de votre véhicule.
  </p>

  <div class="badge">Récapitulatif de réservation</div>

  <table class="table">
    <tr><td class="lbl">Prestation</td><td class="val">${svc.name}</td></tr>
    <tr><td class="lbl">Date</td><td class="val">${formatDate(data.date)}</td></tr>
    <tr><td class="lbl">Heure</td><td class="val">${data.time}</td></tr>
    <tr><td class="lbl">Véhicule</td><td class="val">${vehicleLine}</td></tr>
    ${tintLine}
    ${notesLine}
    ${paymentRow}
  </table>

  <div class="box">
    <p>${cancelBoxText}</p>
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
  const onSite = data.paymentType === 'on_site';
  const paymentRow = onSite
    ? `<tr><td class="label">Montant estimé</td><td><span class="amount">${((data.totalCents ?? svc.priceCents) / 100)}&thinsp;€</span> — à régler sur place</td></tr>`
    : `<tr><td class="label">Acompte reçu</td><td><span class="amount">${svc.depositCents / 100}&thinsp;€</span></td></tr>`;

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
  <p class="sub">${onSite ? 'Un client vient de réserver un créneau (règlement sur place).' : 'Un client vient de réserver et de payer son acompte avec succès.'}</p>

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
    ${paymentRow}
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

// ── Gmail OAuth2 : obtenir un access token ────────────────────
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth2 token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Envoi via Gmail REST API (HTTPS port 443) ─────────────────
async function sendEmail(to, subject, html, attachments) {
  const accessToken = await getAccessToken();
  const from        = `"REYCE" <${process.env.GMAIL_USER}>`;
  const subjectHdr  = `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  let raw;
  if (attachments && attachments.length) {
    const boundary = 'reyce_' + Date.now();
    const parts = [
      `From: ${from}`,
      `To: ${to}`,
      subjectHdr,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html).toString('base64'),
      ''
    ];
    attachments.forEach(att => {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.buffer.toString('base64'),
        ''
      );
    });
    parts.push(`--${boundary}--`);
    raw = parts.join('\r\n');
  } else {
    raw = [
      `From: ${from}`,
      `To: ${to}`,
      subjectHdr,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html).toString('base64')
    ].join('\r\n');
  }

  const encoded = Buffer.from(raw).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ raw: encoded })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Envoi des deux emails de confirmation ─────────────────────
async function sendConfirmationEmails(data, svc) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    console.error('[Email] Variables Gmail OAuth2 manquantes — emails ignorés');
    return;
  }

  if (!svc) {
    console.error('[Email] Service introuvable — emails ignorés');
    return;
  }

  const clientMail = buildClientEmail(data, svc);
  const ownerMail  = buildOwnerEmail(data, svc);
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;

  try {
    await sendEmail(data.client.email, clientMail.subject, clientMail.html);
    console.log(`[Email] ✓ Client → ${data.client.email}`);
  } catch (err) {
    console.error(`[Email] ✗ Client → ${data.client.email} | ${err.message}`);
  }

  try {
    await sendEmail(ownerEmail, ownerMail.subject, ownerMail.html);
    console.log(`[Email] ✓ Owner → ${ownerEmail}`);
  } catch (err) {
    console.error(`[Email] ✗ Owner → ${ownerEmail} | ${err.message}`);
  }
}

// ============================================================
// SMS via Twilio
// ============================================================
async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.log('[SMS] Twilio non configuré — ignoré');
    return;
  }

  const phone = to.startsWith('+') ? to : `+33${to.replace(/^0/, '')}`;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method:  'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ From: from, To: phone, Body: body })
  });

  if (!res.ok) { const e = await res.text(); throw new Error(`Twilio ${res.status}: ${e}`); }
  console.log(`[SMS] ✓ Envoyé → ${phone}`);
  return res.json();
}

// ============================================================
// Google Calendar
// ============================================================
async function createCalendarEvent(data, svc) {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('[Calendar] GOOGLE_CALENDAR_REFRESH_TOKEN non configuré — ignoré');
    return;
  }

  try {
    // Obtenir un access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`OAuth: ${JSON.stringify(tokenData)}`);
    const accessToken = tokenData.access_token;

    // Calculer start/end
    const [y, m, d]  = data.date.split('-').map(Number);
    const [h, min]   = data.time.split(':').map(Number);
    const start      = new Date(y, m - 1, d, h, min);
    const end        = new Date(start.getTime() + svc.durationMin * 60000);

    const pad = n => String(n).padStart(2, '0');
    const fmt = dt => `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;

    const vehicleStr = [data.vehicleType, data.vehicleModel].filter(Boolean).join(' — ') || '—';

    const event = {
      summary:     `${svc.name} — ${data.client.firstName} ${data.client.lastName}`,
      description: [
        `Prestation : ${svc.name}`,
        `Client : ${data.client.firstName} ${data.client.lastName}`,
        `Téléphone : ${data.client.phone}`,
        `Email : ${data.client.email}`,
        `Véhicule : ${vehicleStr}`,
        data.paymentType === 'on_site'
          ? `Règlement : sur place — ${((data.totalCents ?? svc.priceCents) / 100)} €`
          : `Acompte payé : ${svc.depositCents / 100} €`,
        data.client.notes?.trim() ? `Notes : ${data.client.notes}` : null
      ].filter(Boolean).join('\n'),
      start: { dateTime: fmt(start), timeZone: 'Europe/Paris' },
      end:   { dateTime: fmt(end),   timeZone: 'Europe/Paris' }
    };

    const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(event)
    });

    if (!calRes.ok) { const e = await calRes.text(); throw new Error(`${calRes.status}: ${e}`); }
    const created = await calRes.json();
    console.log('[Calendar] ✓ Événement créé', created.id);
    return created.id;
  } catch (err) {
    console.error('[Calendar] ✗', err.message);
    return null;
  }
}

// Crée l'événement Calendar puis enregistre son id / statut de synchro sur
// la réservation. Une réservation payée n'est JAMAIS perdue si Calendar
// échoue : on marque simplement google_sync_status="error" pour un retry
// ultérieur, le rendez-vous reste "confirmed" en base.
async function syncCalendarForBooking(sessionId, data, svc) {
  const eventId = await createCalendarEvent(data, svc);
  try {
    await prisma.appointment.update({
      where: { stripeSessionId: sessionId },
      data: eventId
        ? { googleEventId: eventId, googleSyncStatus: 'synced', googleSyncError: null }
        : { googleSyncStatus: 'error', googleSyncError: 'Échec de création de l\'événement Calendar' }
    });
  } catch (err) {
    console.error('[Calendar] ✗ Enregistrement du statut de synchro impossible :', err.message);
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
        // Validation côté serveur : on ne considère jamais un rendez-vous
        // comme payé sur la seule base de l'événement webhook, on vérifie
        // explicitement le statut de paiement renvoyé par Stripe.
        if (session.payment_status !== 'paid') {
          console.warn(`[Webhook] Session ${session.id} complétée mais payment_status="${session.payment_status}" — ignorée`);
          res.json({ received: true });
          return;
        }

        try {
          const data = JSON.parse(session.metadata.bookingData);
          const svc  = SERVICES[data.service];

          await confirmPayment(session.id, session);

          console.log(`[Webhook] ✓ Réservation confirmée : ${session.id}`);

          // Envoi des emails de confirmation (non bloquant)
          sendConfirmationEmails(data, svc).catch(err =>
            console.error('[Email] Erreur post-webhook :', err.message)
          );

          // Création de l'événement Google Calendar (non bloquant)
          syncCalendarForBooking(session.id, data, svc).catch(err =>
            console.error('[Calendar] Erreur post-webhook :', err.message)
          );

          // SMS de confirmation (non bloquant)
          if (data.client?.phone) {
            const smsBody = `REYCE — Votre réservation est confirmée.\n${svc.name} · ${formatDate(data.date)} à ${data.time}\nAtelier : 47 chemin du Pras, La Mulatière`;
            sendSMS(data.client.phone, smsBody).catch(err =>
              console.error('[SMS] Erreur post-webhook :', err.message)
            );
          }

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

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('[Contact] Variables Gmail OAuth2 manquantes — email ignoré');
    return res.json({ ok: true });
  }

  const ownerEmail = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com';

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

  console.log(`[Contact] Envoi → to: ${ownerEmail}`);
  try {
    await sendEmail(ownerEmail, subjectLine, html);
    console.log('[Contact] ✓ Email envoyé');
    res.json({ ok: true });
  } catch (err) {
    console.error('[Contact] ✗ Erreur Brevo :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Demande de devis "projet" avec photos jointes (jusqu'à 3)
// ============================================================
app.post('/api/devis-photos', upload.array('photos', 3), async (req, res) => {
  const { firstName, lastName, email, phone, subject, message, vehicleInfo } = req.body;

  if (!email || !firstName) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('[Devis photos] Variables Gmail OAuth2 manquantes — email ignoré');
    return res.json({ ok: true });
  }

  const ownerEmail = process.env.OWNER_EMAIL || 'reyceatelier@gmail.com';
  const subjectLine = `[Devis] ${subject || 'Discuter d\'un projet'} — ${firstName} ${lastName || ''}`.trim();

  const files = Array.isArray(req.files) ? req.files : [];
  const photoNote = files.length
    ? `<tr><td class="lbl">Photos</td><td>${files.length} photo${files.length > 1 ? 's' : ''} jointe${files.length > 1 ? 's' : ''}</td></tr>` : '';
  const vehicleBlock = vehicleInfo
    ? `<tr><td class="lbl">Véhicule</td><td>${vehicleInfo}</td></tr>` : '';
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
  .foot{font-size:11px;color:#444;text-align:center;margin-top:32px;}
</style></head><body>
<div class="wrap">
  <div class="logo">REYCE</div>
  <div class="badge">Demande de devis — projet</div>
  <table>
    <tr><td class="lbl">Nom</td><td>${firstName} ${lastName || ''}</td></tr>
    <tr><td class="lbl">Email</td><td>${email}</td></tr>
    <tr><td class="lbl">Téléphone</td><td>${phone || '—'}</td></tr>
    ${vehicleBlock}${messageBlock}${photoNote}
  </table>
  <p style="text-align:center;font-size:12px;color:#666;">Répondre directement à cet email pour contacter ${firstName}</p>
  <p class="foot">Reçu via le site reyce.fr</p>
</div></body></html>`;

  const attachments = files.map((f, i) => ({
    filename: f.originalname || `photo-${i + 1}.jpg`,
    contentType: f.mimetype,
    buffer: f.buffer
  }));

  console.log(`[Devis photos] Envoi → to: ${ownerEmail} (${files.length} photo(s))`);
  try {
    await sendEmail(ownerEmail, subjectLine, html, attachments);
    console.log('[Devis photos] ✓ Email envoyé');
    res.json({ ok: true });
  } catch (err) {
    console.error('[Devis photos] ✗ Erreur :', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/slots', async (req, res) => {
  const { service, date } = req.query;

  if (!service || !date || !SERVICES[service]) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) return res.json({ slots: [] });

  const blocked = await readBlocked();

  // Date entièrement bloquée
  if (blocked.dates.includes(date)) return res.json({ slots: [] });

  // Créneaux déjà pris : réservations actives (y compris les tenues
  // "en attente de paiement" en cours de checkout Stripe).
  const activeRows = await prisma.appointment.findMany({
    where: { serviceId: service, date: strToDate(date), status: { notIn: ['cancelled', 'no_show'] } },
    select: { startTime: true }
  });
  const taken = activeRows.map(r => r.startTime);

  const blockedSlots = blocked.slots[date] || [];

  res.json({ slots: SERVICES[service].slots.filter(s => !taken.includes(s) && !blockedSlots.includes(s)) });
});

app.use('/api/create-checkout-session', express.json());
app.post('/api/create-checkout-session', async (req, res) => {
  const { service, vehicleType, vehicleModel, tintOption, date, time, client, paymentType } = req.body;

  if (!SERVICES[service])
    return res.status(400).json({ error: 'Prestation invalide' });
  if (!date || !time)
    return res.status(400).json({ error: 'Date et créneau obligatoires' });
  if (!client?.email || !client?.firstName || !client?.lastName || !client?.phone)
    return res.status(400).json({ error: 'Coordonnées incomplètes' });

  const svc         = SERVICES[service];
  const isFull      = paymentType === 'full';
  const suppCents   = GABARIT_SUPP_CENTS[vehicleType] || 0;
  const amountCents = isFull ? (svc.priceCents + suppCents) : svc.depositCents;
  const productName = isFull ? `Paiement complet — ${svc.name}` : `Acompte — ${svc.name}`;
  const bookingData = { service, vehicleType, vehicleModel, tintOption, date, time, client, paymentType: paymentType || 'deposit' };

  // Pose une réservation "en attente de paiement" avant de créer la session
  // Stripe : la contrainte EXCLUDE de la base rejette immédiatement toute
  // tentative concurrente sur le même créneau (double-réservation impossible
  // même en cas de deux requêtes simultanées).
  let hold;
  try {
    hold = await holdSlot({
      service, svc, date, time, vehicleType, vehicleModel, tintOption, client,
      paymentType: paymentType || 'deposit',
      totalCents:   isFull ? amountCents : svc.priceCents + suppCents,
      depositCents: svc.depositCents
    });
  } catch (err) {
    console.error('[Slots] Conflit de réservation :', err.message);
    return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Veuillez choisir un autre horaire.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency:     'eur',
          product_data: {
            name:        productName,
            description: [`Rendez-vous : ${date} à ${time}`, vehicleType, vehicleModel]
              .filter(Boolean).join(' · ')
          },
          unit_amount: amountCents
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

    await attachStripeSession(hold.id, session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Erreur :', err.message);
    await releaseHold(hold.id);
    res.status(500).json({ error: 'Erreur lors de la création du paiement. Réessayez.' });
  }
});

// Réservation directe sans paiement en ligne (acompte/Stripe désactivés) :
// le créneau est bloqué et confirmé immédiatement, comme le ferait le
// webhook Stripe, mais sans étape de paiement.
app.use('/api/create-booking', express.json());
app.post('/api/create-booking', async (req, res) => {
  const { service, vehicleType, vehicleModel, tintOption, date, time, client } = req.body;

  if (!SERVICES[service])
    return res.status(400).json({ error: 'Prestation invalide' });
  if (!date || !time)
    return res.status(400).json({ error: 'Date et créneau obligatoires' });
  if (!client?.email || !client?.firstName || !client?.lastName || !client?.phone)
    return res.status(400).json({ error: 'Coordonnées incomplètes' });

  const svc         = SERVICES[service];
  const suppCents   = GABARIT_SUPP_CENTS[vehicleType] || 0;
  const totalCents  = svc.priceCents + suppCents;

  let booking;
  try {
    booking = await createDirectBooking({ service, svc, date, time, vehicleType, vehicleModel, tintOption, client, totalCents });
  } catch (err) {
    console.error('[Booking] Conflit de réservation :', err.message);
    return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Veuillez choisir un autre horaire.' });
  }

  const data = { service, vehicleType, vehicleModel, tintOption, date, time, client, paymentType: 'on_site', totalCents };

  sendConfirmationEmails(data, svc).catch(err => console.error('[Email] Erreur post-réservation :', err.message));
  syncCalendarForBooking(booking.stripeSessionId, data, svc).catch(err => console.error('[Calendar] Erreur post-réservation :', err.message));
  if (client.phone) {
    const smsBody = `REYCE — Votre réservation est confirmée.\n${svc.name} · ${formatDate(date)} à ${time}\nAtelier : 47 chemin du Pras, La Mulatière`;
    sendSMS(client.phone, smsBody).catch(err => console.error('[SMS] Erreur post-réservation :', err.message));
  }

  res.json({ ok: true, sessionId: booking.stripeSessionId });
});

app.get('/api/booking/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  // Réservation directe (sans Stripe) : les infos sont en base, pas côté Stripe.
  if (sessionId.startsWith('local_')) {
    const booking = await findBookingBySessionId(sessionId);
    if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });
    return res.json({
      ...booking,
      paymentStatus: 'on_site',
      depositAmount: 0
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

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
// Admin API
// ============================================================
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;
  const valid = !!expected && !!token
    && token.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!valid) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

app.use('/api/admin', express.json(), requireAdmin);

// Lister toutes les réservations
app.get('/api/admin/bookings', async (req, res) => {
  const bookings = (await readBookings())
    .sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1);
  res.json({ bookings });
});

// Vue d'ensemble : compteurs, chiffre d'affaires, RDV du jour/lendemain
app.get('/api/admin/dashboard', async (req, res) => {
  const bookings = await readBookings();
  const active   = bookings.filter(b => !['cancelled', 'no_show'].includes(b.status));

  const now       = new Date();
  const todayStr  = dateToStr(now);
  const tomorrow  = new Date(now.getTime() + 86400000);
  const tomorrowStr = dateToStr(tomorrow);
  const in7Str    = dateToStr(new Date(now.getTime() + 7 * 86400000));

  const todayList    = active.filter(b => b.date === todayStr).sort((a, b) => a.time < b.time ? -1 : 1);
  const tomorrowList = active.filter(b => b.date === tomorrowStr).sort((a, b) => a.time < b.time ? -1 : 1);
  const upcomingList = active.filter(b => b.date > tomorrowStr && b.date <= in7Str).sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1);

  const revenueCents  = active.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const pendingCents  = active.reduce((s, b) => s + (b.remainingCents || 0), 0);

  const byStatus = {};
  for (const s of ADMIN_SETTABLE_STATUSES) byStatus[s] = bookings.filter(b => b.status === s).length;

  res.json({
    todayCount: todayList.length,
    tomorrowCount: tomorrowList.length,
    upcomingCount: upcomingList.length,
    totalCount: bookings.length,
    revenueCents,
    pendingCents,
    byStatus,
    today: todayList,
    tomorrow: tomorrowList,
    upcoming: upcomingList
  });
});

// Liste des clients agrégée à partir des réservations (pas de compte
// client — regroupement par email, avec notes internes éditables)
app.get('/api/admin/clients', async (req, res) => {
  const bookings = await readBookings();
  const byEmail = new Map();

  for (const b of bookings.sort((a, z) => (a.date + a.time) < (z.date + z.time) ? -1 : 1)) {
    const email = b.client.email;
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email,
        firstName: b.client.firstName,
        lastName:  b.client.lastName,
        phone:     b.client.phone,
        vehicles:  new Set(),
        appointmentCount: 0,
        totalSpentCents: 0,
        lastDate: null,
        notes: null
      });
    }
    const c = byEmail.get(email);
    c.firstName = b.client.firstName;
    c.lastName  = b.client.lastName;
    c.phone     = b.client.phone;
    if (b.vehicleModel) c.vehicles.add(b.vehicleModel);
    c.appointmentCount += 1;
    if (b.status !== 'cancelled') c.totalSpentCents += (b.amountPaid || 0);
    c.lastDate = b.date;
  }

  const notesRows = await prisma.client.findMany({ where: { email: { in: [...byEmail.keys()] } } });
  for (const row of notesRows) {
    const c = byEmail.get(row.email);
    if (c) c.notes = row.notes;
  }

  const clients = [...byEmail.values()].map(c => ({ ...c, vehicles: [...c.vehicles] }));
  res.json({ clients });
});

// Crée la fiche client (table Client) si elle n'existe pas encore, à
// partir de la dernière réservation connue pour cet email.
async function ensureClient(email) {
  const existing = await prisma.client.findUnique({ where: { email } });
  if (existing) return existing;

  const latest = await prisma.appointment.findFirst({
    where: { guestEmail: email },
    orderBy: { createdAt: 'desc' }
  });
  if (!latest) return null;

  return prisma.client.create({
    data: { email, firstName: latest.guestFirstName, lastName: latest.guestLastName, phone: latest.guestPhone }
  });
}

// Enregistrer une note interne sur un client (crée la fiche client si besoin)
app.patch('/api/admin/clients/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { notes } = req.body;

  const client = await ensureClient(email);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });

  await prisma.client.update({ where: { email }, data: { notes } });
  res.json({ ok: true });
});

// Détail d'un client : coordonnées, véhicules enregistrés, historique complet
app.get('/api/admin/clients/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email);

  const client = await ensureClient(email);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });

  const [vehicles, appointments] = await Promise.all([
    prisma.vehicle.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }),
    prisma.appointment.findMany({
      where: { guestEmail: email, status: { not: 'pending_payment' } },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }]
    })
  ]);

  res.json({
    client: { email: client.email, firstName: client.firstName, lastName: client.lastName, phone: client.phone, notes: client.notes },
    vehicles,
    appointments: appointments.map(toBooking)
  });
});

// Ajouter un véhicule à la fiche client
app.post('/api/admin/clients/:email/vehicles', async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { make, model, plate, category, notes } = req.body;

  const client = await ensureClient(email);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  if (!make && !model && !plate) return res.status(400).json({ error: 'Renseignez au moins la marque, le modèle ou l\'immatriculation' });

  const vehicle = await prisma.vehicle.create({
    data: { clientId: client.id, make: make || null, model: model || null, plate: plate || null, category: category || null, notes: notes || null }
  });
  res.json({ ok: true, vehicle });
});

// Retirer un véhicule d'une fiche client
app.delete('/api/admin/vehicles/:vehicleId', async (req, res) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.vehicleId } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Véhicule introuvable' });
  }
});

// Annuler / modifier le statut d'une réservation
app.patch('/api/admin/booking/:sessionId', async (req, res) => {
  const { sessionId }        = req.params;
  const { status, internalNotes } = req.body;

  if (status && !ADMIN_SETTABLE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  try {
    const data = {};
    if (status !== undefined) data.status = status;
    if (internalNotes !== undefined) data.internalNotes = internalNotes;
    if (!Object.keys(data).length) data.status = 'cancelled';
    await prisma.appointment.update({ where: { stripeSessionId: sessionId }, data });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Réservation introuvable' });
  }
});

// Lire les blocages
app.get('/api/admin/blocked', async (req, res) => {
  res.json(await readBlocked());
});

// Bloquer une date entière
app.post('/api/admin/block-date', async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date requise' });
  await blockDate(date);
  res.json({ ok: true });
});

// Débloquer une date
app.delete('/api/admin/block-date', async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date requise' });
  await unblockDate(date);
  res.json({ ok: true });
});

// Bloquer un créneau spécifique
app.post('/api/admin/block-slot', async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Date et créneau requis' });
  await blockSlot(date, time);
  res.json({ ok: true });
});

// Débloquer un créneau
app.delete('/api/admin/block-slot', async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Date et créneau requis' });
  await unblockSlot(date, time);
  res.json({ ok: true });
});

// Email + SMS de rappel de rendez-vous (envoi manuel, typiquement la veille)
app.post('/api/admin/send-reminder', async (req, res) => {
  const { sessionId } = req.body;
  const booking = await findBookingBySessionId(sessionId);
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });

  const firstName = booking.client?.firstName || 'Client';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{background:#070707;margin:0;padding:48px 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}
  .wrap{max-width:520px;margin:0 auto;padding:0;}
  .logo{font-size:16px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;color:#fff;margin-bottom:48px;}
  .title{font-size:28px;font-weight:300;color:#fff;line-height:1.2;font-style:italic;margin-bottom:16px;}
  .body{font-size:14px;color:#888;line-height:1.8;margin-bottom:32px;}
  .box{background:#0f0f0f;border:1px solid #1c1c1c;padding:20px 24px;margin-bottom:32px;}
  .box .lbl{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin-bottom:4px;}
  .box .val{font-size:15px;color:#e0e0e0;margin-bottom:14px;}
  .divider{border:none;border-top:1px solid #1a1a1a;margin:32px 0;}
  .addr{font-size:12px;color:#555;line-height:1.9;}
  .foot{font-size:11px;color:#333;margin-top:40px;}
</style></head><body>
<div class="wrap">
  <div class="logo">REYCE</div>
  <p class="title">À demain,<br>${firstName}.</p>
  <p class="body">Petit rappel : votre rendez-vous approche. Nous avons hâte de prendre soin de votre véhicule.</p>
  <div class="box">
    <div class="lbl">Prestation</div><div class="val">${booking.serviceName || booking.service}</div>
    <div class="lbl">Date</div><div class="val">${formatDate(booking.date)}</div>
    <div class="lbl">Heure</div><div class="val">${booking.time}</div>
  </div>
  <hr class="divider">
  <p class="addr">47 chemin du Pras · La Mulatière, Lyon<br>07 63 00 43 85</p>
  <p class="foot">REYCE · Atelier automobile premium · Lyon</p>
</div></body></html>`;

  try {
    await sendEmail(booking.client.email, `Rappel — Votre rendez-vous REYCE du ${formatDate(booking.date)}`, html);
    if (booking.client?.phone) {
      await sendSMS(booking.client.phone, `REYCE — Rappel : rendez-vous ${formatDate(booking.date)} à ${booking.time}. 47 chemin du Pras, La Mulatière. À demain !`).catch(() => {});
    }
    console.log(`[Admin] ✓ Email "rappel" → ${booking.client.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] ✗ send-reminder :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Email véhicule prêt
app.post('/api/admin/send-ready', async (req, res) => {
  const { sessionId } = req.body;
  const booking = await findBookingBySessionId(sessionId);
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });

  const firstName = booking.client?.firstName || 'Client';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{background:#070707;margin:0;padding:48px 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}
  .wrap{max-width:520px;margin:0 auto;padding:0;}
  .logo{font-size:16px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;color:#fff;margin-bottom:48px;}
  .title{font-size:28px;font-weight:300;color:#fff;line-height:1.2;font-style:italic;margin-bottom:16px;}
  .body{font-size:14px;color:#888;line-height:1.8;margin-bottom:40px;}
  .divider{border:none;border-top:1px solid #1a1a1a;margin:32px 0;}
  .addr{font-size:12px;color:#555;line-height:1.9;}
  .foot{font-size:11px;color:#333;margin-top:40px;}
</style></head><body>
<div class="wrap">
  <div class="logo">REYCE</div>
  <p class="title">Votre véhicule<br>est prêt.</p>
  <p class="body">Bonjour ${firstName},<br><br>Chaque détail a été traité avec précision. Votre véhicule vous attend à l'atelier.</p>
  <hr class="divider">
  <p class="addr">47 chemin du Pras · La Mulatière, Lyon<br>07 63 00 43 85</p>
  <p class="foot">REYCE · Atelier automobile premium · Lyon</p>
</div></body></html>`;

  try {
    await sendEmail(booking.client.email, 'Votre véhicule est prêt — REYCE', html);
    if (booking.client?.phone) {
      await sendSMS(booking.client.phone, `REYCE — Votre véhicule est prêt. Chaque détail a été traité avec précision. À tout de suite ! 47 chemin du Pras, La Mulatière.`).catch(() => {});
    }
    console.log(`[Admin] ✓ Email "prêt" → ${booking.client.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] ✗ send-ready :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Email demande d'avis
app.post('/api/admin/send-review', async (req, res) => {
  const { sessionId } = req.body;
  const booking = await findBookingBySessionId(sessionId);
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });

  const firstName = booking.client?.firstName || 'Client';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{background:#070707;margin:0;padding:48px 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}
  .wrap{max-width:520px;margin:0 auto;}
  .logo{font-size:16px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;color:#fff;margin-bottom:48px;}
  .title{font-size:28px;font-weight:300;color:#fff;line-height:1.2;font-style:italic;margin-bottom:16px;}
  .body{font-size:14px;color:#888;line-height:1.8;margin-bottom:32px;}
  .cta{display:inline-block;padding:13px 28px;background:#fff;color:#080808;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;margin-bottom:40px;}
  .divider{border:none;border-top:1px solid #1a1a1a;margin:32px 0;}
  .foot{font-size:11px;color:#333;margin-top:32px;}
</style></head><body>
<div class="wrap">
  <div class="logo">REYCE</div>
  <p class="title">Merci pour<br>votre confiance.</p>
  <p class="body">Bonjour ${firstName},<br><br>Nous espérons que votre expérience REYCE a été à la hauteur de vos attentes. Votre avis compte énormément pour nous et aide d'autres passionnés à nous découvrir.</p>
  <a href="https://www.google.com/search?q=REYCE+Lyon+avis" class="cta">Laisser un avis Google</a>
  <hr class="divider">
  <p class="foot">REYCE · Atelier automobile premium · Lyon</p>
</div></body></html>`;

  try {
    await sendEmail(booking.client.email, 'Merci pour votre confiance — REYCE', html);
    console.log(`[Admin] ✓ Email "avis" → ${booking.client.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] ✗ send-review :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 404 — page introuvable
// ============================================================
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ============================================================
// Erreurs Multer (photos trop lourdes / trop nombreuses)
// ============================================================
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Photo trop lourde (6 Mo max par photo).'
      : err.code === 'LIMIT_FILE_COUNT'
      ? '3 photos maximum.'
      : 'Erreur lors de l\'envoi des photos.';
    return res.status(400).json({ error: msg });
  }
  next(err);
});

// ============================================================
// Filet de sécurité final — toute erreur non gérée plus haut (ex. base de
// données injoignable) répond 500 au lieu de laisser la requête sans
// réponse ou de faire planter le serveur.
// ============================================================
app.use((err, req, res, next) => {
  console.error('[Erreur non gérée]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur serveur, veuillez réessayer.' });
});

// ============================================================
app.listen(PORT, () => {
  console.log(`\n  REYCE — Serveur démarré`);
  console.log(`  → http://localhost:${PORT}\n`);
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('  ⚠  Gmail OAuth2 non configuré — emails désactivés\n');
  } else {
    console.log(`  ✓  Gmail OAuth2 configuré → ${process.env.GMAIL_USER}\n`);
  }
});

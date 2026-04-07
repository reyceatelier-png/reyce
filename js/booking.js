/* =============================================================
   REYCE — Système de réservation avec acompte Stripe
   ============================================================= */
'use strict';

// ─── Acompte unique pour toutes les prestations ───────────────
const DEPOSIT_AMOUNT = 40; // €

// ─── Configuration des prestations ───────────────────────────
const SERVICES = {
  'lavage-confort': {
    id:       'lavage-confort',
    name:     'Lavage Confort',
    desc:     'Lavage extérieur soigné — carrosserie, jantes et vitres.',
    duration: '~1h',
    price:    99,
    deposit:  DEPOSIT_AMOUNT
  },
  'lavage-premium': {
    id:       'lavage-premium',
    name:     'Lavage Premium',
    desc:     'Lavage complet intérieur + extérieur, finitions et traitement des plastiques.',
    duration: '~2h',
    price:    169,
    deposit:  DEPOSIT_AMOUNT
  },
  'lavage-experience': {
    id:       'lavage-experience',
    name:     'Lavage Expérience',
    desc:     'Préparation haut de gamme complète — une journée entière de travail minutieux.',
    duration: 'Journée complète',
    price:    299,
    deposit:  DEPOSIT_AMOUNT
  },
  'vitres-teintees': {
    id:       'vitres-teintees',
    name:     'Vitres Teintées',
    desc:     'Pose de film teintant professionnel sur l\'ensemble des vitres.',
    duration: '3–4h',
    price:    199,
    deposit:  DEPOSIT_AMOUNT
  }
};

const VEHICLE_TYPES = [
  { id: 'citadine',  label: 'Citadine' },
  { id: 'berline',   label: 'Berline' },
  { id: 'suv',       label: 'SUV / 4×4' },
  { id: 'cabriolet', label: 'Cabriolet' },
  { id: 'sportive',  label: 'Sportive / GT' },
  { id: 'break',     label: 'Break / Familiale' }
];

const TINT_OPTIONS = [
  { id: 'legal',  label: 'Homologuée',  sub: 'Film légal ≥ 70% de luminosité' },
  { id: 'sombre', label: 'Très sombre', sub: 'Film premium haute densité' }
];

// ─── Créneaux par défaut (fallback si serveur indisponible) ───
// Ces créneaux sont affichés quand l'API ne répond pas.
// En production, c'est le serveur qui filtre les créneaux réservés.
const SLOTS_DEFAULT = {
  'lavage-confort':    ['09:00', '11:00', '14:00', '16:00'],
  'lavage-premium':    ['09:00', '11:30', '14:00'],
  'lavage-experience': ['09:00'],
  'vitres-teintees':   ['09:00', '13:30']
};

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];
const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

// ─── État de la réservation ───────────────────────────────────
const state = {
  step:         1,
  service:      null,
  vehicleType:  null,
  vehicleModel: '',
  tintOption:   null,
  date:         null,
  time:         null,
  calYear:      null,
  calMonth:     null,
  paymentType:  'deposit', // 'deposit' | 'full'
  client: {
    firstName: '',
    lastName:  '',
    phone:     '',
    email:     '',
    notes:     ''
  }
};

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('[data-panel="nettoyage"]')) return;

  const now = new Date();
  state.calYear  = now.getFullYear();
  state.calMonth = now.getMonth();

  renderServiceCards();
  renderVehicleTypes();
  renderTintOptions();
  renderCalendar();
  setupCalendarNav();   // ← séparé de renderCalendar pour éviter l'empilement
  setupStepNav();
  setupClientForm();
  setupPaymentBtn();
});

// ─── Navigation entre étapes ──────────────────────────────────
function goToStep(n) {
  n = Math.max(1, Math.min(5, n));
  state.step = n;

  // Afficher le bon panel
  document.querySelectorAll('.bp-step').forEach(el => {
    el.classList.toggle('is-active', parseInt(el.dataset.bpStep) === n);
  });

  // Mettre à jour les indicateurs
  document.querySelectorAll('.bsi__step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('is-active', 'is-done');
    if (s === n) el.classList.add('is-active');
    if (s < n)  el.classList.add('is-done');
  });

  // Actions spécifiques à certaines étapes
  if (n === 2) syncTintVisibility();
  if (n === 5) renderSummary();

  // Scroll vers le début du formulaire, en compensant la nav fixe
  const anchor = document.getElementById('bookingAnchor');
  if (anchor) {
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 88;
    const top  = anchor.getBoundingClientRect().top + window.scrollY - navH - 24;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// Utilise la délégation d'événement sur le document (1 seul listener)
function setupStepNav() {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-bp-next]')) {
      if (validateStep(state.step)) goToStep(state.step + 1);
    }
    if (e.target.closest('[data-bp-prev]')) {
      goToStep(state.step - 1);
    }
  });
}

// ─── Validation par étape ─────────────────────────────────────
function validateStep(step) {
  switch (step) {
    case 1:
      if (!state.service) {
        showToast('Veuillez sélectionner une prestation.'); return false;
      }
      return true;

    case 2:
      if (!state.vehicleType) {
        showToast('Veuillez sélectionner le type de véhicule.'); return false;
      }
      if (state.service === 'vitres-teintees' && !state.tintOption) {
        showToast('Veuillez choisir un type de film teinté.'); return false;
      }
      return true;

    case 3:
      if (!state.date) {
        showToast('Veuillez sélectionner une date.'); return false;
      }
      if (!state.time) {
        showToast('Veuillez sélectionner un créneau horaire.'); return false;
      }
      return true;

    case 4: {
      const { firstName, lastName, phone, email } = state.client;
      if (!firstName.trim() || !lastName.trim()) {
        showToast('Veuillez indiquer votre prénom et nom.'); return false;
      }
      if (!phone.trim()) {
        showToast('Veuillez indiquer votre numéro de téléphone.'); return false;
      }
      if (!email.trim() || !email.includes('@')) {
        showToast('Veuillez indiquer une adresse email valide.'); return false;
      }
      return true;
    }

    default:
      return true;
  }
}

// ─── Toast d'erreur ───────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('bookingToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bookingToast';
    toast.className = 'booking-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('is-visible'), 3500);
}

// ─── Étape 1 : Sélection de la prestation ────────────────────
function renderServiceCards() {
  const grid = document.getElementById('serviceGrid');
  if (!grid) return;

  grid.innerHTML = Object.values(SERVICES).map(s => `
    <div class="svc-card${state.service === s.id ? ' is-selected' : ''}" data-service="${s.id}">
      <div class="svc-card__body">
        <p class="svc-card__name">${s.name}</p>
        <p class="svc-card__desc">${s.desc}</p>
      </div>
      <div class="svc-card__meta">
        <span class="svc-card__duration">${s.duration}</span>
        <span class="svc-card__price">À partir de ${s.price}\u202f€</span>
      </div>
    </div>
  `).join('');

  grid.addEventListener('click', e => {
    const card = e.target.closest('.svc-card');
    if (!card) return;
    state.service = card.dataset.service;
    grid.querySelectorAll('.svc-card').forEach(c => c.classList.remove('is-selected'));
    card.classList.add('is-selected');
  });
}

// ─── Étape 2 : Véhicule ───────────────────────────────────────
function renderVehicleTypes() {
  const wrap = document.getElementById('vehicleTypesGrid');
  if (!wrap) return;

  wrap.innerHTML = VEHICLE_TYPES.map(v => `
    <button type="button" class="vtype-btn${state.vehicleType === v.id ? ' is-selected' : ''}" data-vtype="${v.id}">
      ${v.label}
    </button>
  `).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.vtype-btn');
    if (!btn) return;
    state.vehicleType = btn.dataset.vtype;
    wrap.querySelectorAll('.vtype-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
  });
}

function renderTintOptions() {
  const wrap = document.getElementById('tintOptionsGrid');
  if (!wrap) return;

  wrap.innerHTML = TINT_OPTIONS.map(t => `
    <div class="tint-card${state.tintOption === t.id ? ' is-selected' : ''}" data-tint="${t.id}">
      <p class="tint-card__label">${t.label}</p>
      <p class="tint-card__sub">${t.sub}</p>
    </div>
  `).join('');

  wrap.addEventListener('click', e => {
    const card = e.target.closest('.tint-card');
    if (!card) return;
    state.tintOption = card.dataset.tint;
    wrap.querySelectorAll('.tint-card').forEach(c => c.classList.remove('is-selected'));
    card.classList.add('is-selected');
  });
}

// Appelé à chaque fois que l'étape 2 est affichée
function syncTintVisibility() {
  const section = document.getElementById('tintSection');
  if (section) {
    section.style.display = state.service === 'vitres-teintees' ? 'block' : 'none';
  }
}

function getVehicleLabel(id) {
  const v = VEHICLE_TYPES.find(v => v.id === id);
  return v ? v.label : (id || '');
}

// ─── Étape 3 : Calendrier ─────────────────────────────────────
// CORRECTIF : renderCalendar() ne fait QUE rendre le HTML du calendrier.
// La navigation prev/next est configurée UNE SEULE FOIS via setupCalendarNav().
function renderCalendar() {
  const monthEl = document.getElementById('bCalMonth');
  const daysEl  = document.getElementById('bCalDays');
  if (!monthEl || !daysEl) return;

  const year  = state.calYear;
  const month = state.calMonth;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  monthEl.textContent = `${MONTHS_FR[month]} ${year}`;

  // Premier jour de la semaine (lundi = colonne 0)
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const lastDay = new Date(year, month + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day cal-day--empty"></div>';
  }

  for (let d = 1; d <= lastDay; d++) {
    const date    = new Date(year, month, d);
    const dow     = date.getDay();
    const isPast  = date < today;
    const isSun   = dow === 0;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    let cls = 'cal-day';
    if (isPast)                   cls += ' cal-day--past';
    else if (isSun)               cls += ' cal-day--closed';
    if (state.date === dateStr)   cls += ' is-selected';

    const attr = (!isPast && !isSun) ? ` data-cal-date="${dateStr}"` : '';
    html += `<div class="${cls}"${attr}>${d}</div>`;
  }

  daysEl.innerHTML = html;

  // Listener sur les jours — délégation sur le conteneur
  daysEl.onclick = e => {
    const day = e.target.closest('[data-cal-date]');
    if (!day) return;

    const dateStr = day.dataset.calDate;
    if (state.date === dateStr) return; // déjà sélectionné

    state.date = dateStr;
    state.time = null; // reset créneau quand la date change

    daysEl.querySelectorAll('.cal-day').forEach(d => d.classList.remove('is-selected'));
    day.classList.add('is-selected');

    loadSlots(dateStr);
  };
}

// CORRECTIF : listeners de navigation configurés UNE SEULE FOIS (pas dans renderCalendar)
function setupCalendarNav() {
  const prev = document.getElementById('bCalPrev');
  const next = document.getElementById('bCalNext');

  if (prev) {
    prev.onclick = () => {
      state.calMonth--;
      if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      renderCalendar();
    };
  }

  if (next) {
    next.onclick = () => {
      state.calMonth++;
      if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      renderCalendar();
    };
  }
}

// ─── Étape 3 : Créneaux ───────────────────────────────────────
async function loadSlots(date) {
  const slotsEl = document.getElementById('bookingSlots');
  if (!slotsEl) return;

  // Vider le créneau sélectionné précédent
  state.time = null;

  slotsEl.innerHTML = '<p class="t-body--sm" style="color:var(--grey-3);padding:8px 0;">Chargement des créneaux…</p>';

  let slots = null;

  // Tenter l'appel API (disponibilité en temps réel via le serveur)
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `/api/slots?service=${encodeURIComponent(state.service)}&date=${encodeURIComponent(date)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.slots)) slots = data.slots;
    }
  } catch {
    // Serveur indisponible — utilisation du fallback client
  }

  // Fallback : créneaux définis localement (mode preview / développement)
  if (slots === null) {
    slots = SLOTS_DEFAULT[state.service] || [];
  }

  renderSlots(slotsEl, slots);
}

function renderSlots(slotsEl, slots) {
  if (!slots.length) {
    slotsEl.innerHTML = `
      <p class="t-body--sm" style="color:var(--grey-3);padding:8px 0;">
        Aucun créneau disponible ce jour.<br>Choisissez une autre date.
      </p>`;
    return;
  }

  slotsEl.innerHTML = `<div class="slots-grid">
    ${slots.map(s => `
      <button type="button" class="slot-btn${state.time === s ? ' is-selected' : ''}" data-time="${s}">
        ${s}
      </button>
    `).join('')}
  </div>`;

  // Délégation sur le conteneur
  slotsEl.querySelector('.slots-grid').onclick = e => {
    const btn = e.target.closest('.slot-btn');
    if (!btn) return;
    state.time = btn.dataset.time;
    slotsEl.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
  };
}

// ─── Étape 4 : Coordonnées ────────────────────────────────────
function setupClientForm() {
  const fields = {
    clientFirstName: 'firstName',
    clientLastName:  'lastName',
    clientPhone:     'phone',
    clientEmail:     'email',
    clientNotes:     'notes'
  };

  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Lire la valeur actuelle (utile si le formulaire est pré-rempli)
    state.client[key] = el.value;
    el.addEventListener('input', () => { state.client[key] = el.value; });
  });

  const modelEl = document.getElementById('vehicleModel');
  if (modelEl) {
    state.vehicleModel = modelEl.value;
    modelEl.addEventListener('input', () => { state.vehicleModel = modelEl.value; });
  }
}

// ─── Étape 5 : Récapitulatif ──────────────────────────────────
function renderSummary() {
  const svc = SERVICES[state.service];
  if (!svc) return;

  const tintLabel = state.tintOption
    ? (TINT_OPTIONS.find(t => t.id === state.tintOption)?.label || state.tintOption)
    : null;

  const vehicleStr = [getVehicleLabel(state.vehicleType), state.vehicleModel].filter(Boolean).join(' — ');

  const rows = [
    ['Prestation',  svc.name],
    ['Véhicule',    vehicleStr || '—'],
    tintLabel       ? ['Film teinté',  tintLabel]              : null,
    ['Date',        formatDate(state.date)],
    ['Heure',       state.time      || '—'],
    ['Client',      (`${state.client.firstName} ${state.client.lastName}`).trim() || '—'],
    ['Email',       state.client.email    || '—'],
    ['Téléphone',   state.client.phone    || '—'],
    state.client.notes?.trim() ? ['Notes', state.client.notes] : null
  ].filter(Boolean);

  const summaryEl = document.getElementById('bookingSummary');
  if (summaryEl) {
    summaryEl.innerHTML = rows.map(([label, val]) => `
      <div class="sum-row">
        <span class="sum-row__label">${label}</span>
        <span class="sum-row__value">${val}</span>
      </div>
    `).join('');
  }

  // Choix du mode de paiement
  const paymentWrap = document.getElementById('paymentChoice');
  if (paymentWrap) {
    paymentWrap.innerHTML = `
      <p class="t-head" style="margin-bottom:16px;">Mode de paiement</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:var(--space-md);">
        <label class="payment-option${state.paymentType === 'deposit' ? ' is-selected' : ''}" data-payment="deposit">
          <div class="payment-option__check"></div>
          <div class="payment-option__body">
            <span class="payment-option__name">Acompte — ${DEPOSIT_AMOUNT}\u202f€</span>
            <span class="payment-option__sub">Le solde (${svc.price - DEPOSIT_AMOUNT}\u202f€) sera réglé le jour du rendez-vous</span>
          </div>
        </label>
        <label class="payment-option${state.paymentType === 'full' ? ' is-selected' : ''}" data-payment="full">
          <div class="payment-option__check"></div>
          <div class="payment-option__body">
            <span class="payment-option__name">Paiement complet — à partir de ${svc.price}\u202f€</span>
            <span class="payment-option__sub">Règlement intégral maintenant — aucun paiement en atelier</span>
          </div>
        </label>
      </div>
    `;

    paymentWrap.querySelectorAll('.payment-option').forEach(opt => {
      opt.addEventListener('click', () => {
        state.paymentType = opt.dataset.payment;
        paymentWrap.querySelectorAll('.payment-option').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
      });
    });
  }

  const depositEl = document.getElementById('summaryDeposit');
  if (depositEl) depositEl.textContent = `${DEPOSIT_AMOUNT}\u202f€`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

// ─── Paiement Stripe ──────────────────────────────────────────
function setupPaymentBtn() {
  const btn = document.getElementById('payBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled    = true;
    btn.textContent = 'Redirection vers le paiement…';

    try {
      const res = await fetch('/api/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service:      state.service,
          vehicleType:  state.vehicleType,
          vehicleModel: state.vehicleModel,
          tintOption:   state.tintOption,
          date:         state.date,
          time:         state.time,
          client:       state.client,
          paymentType:  state.paymentType
        })
      });

      const data = await res.json();

      if (data.error) {
        showToast(data.error);
        btn.disabled    = false;
        btn.textContent = 'Payer l\'acompte et confirmer';
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      showToast('Erreur de connexion. Vérifiez votre réseau et réessayez.');
      btn.disabled    = false;
      btn.textContent = 'Payer l\'acompte et confirmer';
    }
  });
}

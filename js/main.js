/* ============================================================
   REYCE — Main JavaScript
   ============================================================ */

(function () {
  'use strict';

  /* ---- Custom Cursor --------------------------------------- */
  const cursor = document.querySelector('.cursor');
  const ring   = document.querySelector('.cursor-ring');

  if (cursor && ring && window.matchMedia('(hover: hover)').matches) {
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      cursor.style.left = mx + 'px';
      cursor.style.top  = my + 'px';
    });

    // Ring follows with smooth lag
    function animateRing() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // Hover states
    document.querySelectorAll('a, button, [data-hover]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('is-hover');
        ring.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('is-hover');
        ring.classList.remove('is-hover');
      });
    });
  }

  /* ---- Intro Cinématique (GSAP) --------------------------- */
  const intro    = document.getElementById('intro');
  const symbol   = intro ? intro.querySelector('.intro__symbol')    : null;
  const halo     = intro ? intro.querySelector('.intro__halo')      : null;
  const logoWrap = intro ? intro.querySelector('.intro__logo-wrap') : null;
  const bar      = intro ? intro.querySelector('.intro__bar')       : null;
  const navEl    = document.querySelector('.nav');

  function revealSite() {
    document.body.classList.remove('intro-active');
    if (intro) intro.classList.add('is-done');
    if (navEl)  navEl.style.opacity = '1';
  }

  if (intro && symbol && typeof gsap !== 'undefined') {
    document.body.classList.add('intro-active');

    // ── État initial ──────────────────────────────────────────
    gsap.set(symbol, { opacity: 0 });
    gsap.set(halo,   { opacity: 0 });
    gsap.set(navEl,  { opacity: 0 });
    if (bar) gsap.set(bar, { width: '0%', opacity: 1 });

    const tl = gsap.timeline();

    // Phase 1 — Logo apparaît doucement
    tl.to(symbol, { opacity: 1, duration: 2.0, ease: 'power1.inOut' }, 0.4)

    // Barre se remplit pendant que le logo est visible
      .to(bar || {}, { width: '100%', duration: 3.2, ease: 'power2.inOut' }, 0.5)

    // Halo monte progressivement
      .to(halo, { opacity: 1, duration: 1.8, ease: 'power1.inOut' }, 1.4)

    // Phase 2 — Barre + logo + halo s'effacent ensemble
      .to(bar || {}, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 3.8)
      .to(symbol,    { opacity: 0, duration: 0.8, ease: 'power1.inOut' }, 4.0)
      .to(halo,      { opacity: 0, duration: 0.6, ease: 'power1.in'    }, 4.1)

    // Phase 3 — Suppression de intro-active : les animations CSS du hero démarrent
    //           L'overlay fond simultanément pour une transition sans cassure
      .call(() => { document.body.classList.remove('intro-active'); }, [], 4.8)
      .to(intro, { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 4.8)
      .to(navEl, { opacity: 1, duration: 1.0, ease: 'power1.out'   }, 5.0)

    // Phase 4 — Nettoyage
      .call(() => { intro.classList.add('is-done'); }, [], 6.3);

  } else if (intro) {
    // Fallback si GSAP absent
    document.body.classList.add('intro-active');
    intro.style.transition = 'opacity 1.1s ease';
    setTimeout(() => {
      document.body.classList.remove('intro-active');
      intro.style.opacity = '0';
      setTimeout(() => revealSite(), 1100);
    }, 4200);
  }

  /* ---- Hero Parallax -------------------------------------- */
  const heroPhoto = document.querySelector('.hero__photo');
  if (heroPhoto) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroPhoto.style.transform = `scale(1.08) translateY(${y * 0.18}px)`;
      }
    }, { passive: true });
  }

  /* ---- Navigation ----------------------------------------- */
  const nav = document.querySelector('.nav');

  if (nav) {
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      lastScroll = y;
    }, { passive: true });
  }

  /* ---- Mobile Menu ---------------------------------------- */
  const burger = document.querySelector('.nav__burger');
  const mobileMenu = document.querySelector('.nav__mobile');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('is-open');
      mobileMenu.classList.toggle('is-open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('is-open');
        mobileMenu.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- Scroll Reveal --------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');

  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(el => observer.observe(el));
  }

  /* ---- Animated Counters ---------------------------------- */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 1800;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = eased * target;
      el.textContent = prefix + (Number.isInteger(target) ? Math.floor(value) : value.toFixed(1)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counterEls = document.querySelectorAll('[data-counter]');

  if (counterEls.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counterEls.forEach(el => counterObserver.observe(el));
  }

  /* ---- Active Nav Link ------------------------------------ */
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link[href]').forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('is-active');
    }
  });

  /* ---- Modal System --------------------------------------- */
  const modalOverlay = document.querySelector('.modal-overlay');
  const modalClose   = document.querySelector('.modal__close');

  function openModal(data) {
    if (!modalOverlay) return;
    const titleEl = modalOverlay.querySelector('.modal__title');
    const featuresEl = modalOverlay.querySelector('.modal__features');
    const descEl = modalOverlay.querySelector('.modal__desc');
    if (titleEl && data.title) titleEl.textContent = data.title;
    if (descEl && data.desc) descEl.textContent = data.desc;
    if (featuresEl && data.features) {
      featuresEl.innerHTML = data.features.map(f =>
        `<li class="modal__feature">${f}</li>`
      ).join('');
    }
    modalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', e => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Bind offer cards that have data-modal
  document.querySelectorAll('[data-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const data = JSON.parse(el.dataset.modal);
      openModal(data);
    });
  });

  /* ---- Booking Tabs --------------------------------------- */
  const bookingTabs   = document.querySelectorAll('.booking-tab');
  const bookingPanels = document.querySelectorAll('.booking-panel');

  bookingTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      bookingTabs.forEach(t => t.classList.remove('is-active'));
      bookingPanels.forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      const panel = document.querySelector(`.booking-panel[data-panel="${target}"]`);
      if (panel) panel.classList.add('is-active');
    });
  });

  /* ---- Calendar (ancien panel nettoyage — désactivé si nouveau système présent) */
  const calendarEl = document.querySelector('.calendar');

  // Ne pas initialiser l'ancien calendrier si le nouveau système booking.js est actif
  if (calendarEl && !document.getElementById('serviceGrid')) {
    let currentDate = new Date();
    let selectedDate = null;

    const monthEl = calendarEl.querySelector('.calendar__month');
    const daysEl  = calendarEl.querySelector('.calendar__days');
    const prevBtn = calendarEl.querySelector('.calendar__nav--prev');
    const nextBtn = calendarEl.querySelector('.calendar__nav--next');

    const monthNames = [
      'Janvier','Février','Mars','Avril','Mai','Juin',
      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
    ];
    const today = new Date();

    // Unavailable days (demo): weekends
    function isUnavailable(date) {
      const d = date.getDay();
      return d === 0 || d === 6;
    }
    function isPast(date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const t = new Date(today);
      t.setHours(0,0,0,0);
      return d < t;
    }

    function renderCalendar() {
      const year  = currentDate.getFullYear();
      const month = currentDate.getMonth();
      monthEl.textContent = monthNames[month] + ' ' + year;

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const offset = (firstDay + 6) % 7; // Mon first

      daysEl.innerHTML = '';
      for (let i = 0; i < offset; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar__day is-empty';
        daysEl.appendChild(empty);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, month, d);
        const el = document.createElement('div');
        el.className = 'calendar__day';
        el.textContent = d;
        if (isPast(dayDate)) el.classList.add('is-past');
        else if (isUnavailable(dayDate)) el.classList.add('is-past');
        if (dayDate.toDateString() === today.toDateString()) el.classList.add('is-today');
        if (selectedDate && dayDate.toDateString() === selectedDate.toDateString()) {
          el.classList.add('is-selected');
        }
        el.addEventListener('click', () => {
          selectedDate = dayDate;
          renderCalendar();
          renderTimeSlots();
        });
        daysEl.appendChild(el);
      }
    }

    function renderTimeSlots() {
      const slotsEl = document.querySelector('.time-slots');
      if (!slotsEl) return;
      const times = ['09:00','09:30','10:00','10:30','11:00','11:30',
                     '14:00','14:30','15:00','15:30','16:00','16:30'];
      // Demo: some slots unavailable
      const unavail = [1, 4, 7];
      slotsEl.innerHTML = times.map((t, i) =>
        `<div class="time-slot${unavail.includes(i) ? ' is-unavailable' : ''}" data-time="${t}">${t}</div>`
      ).join('');

      slotsEl.querySelectorAll('.time-slot:not(.is-unavailable)').forEach(slot => {
        slot.addEventListener('click', () => {
          slotsEl.querySelectorAll('.time-slot').forEach(s => s.classList.remove('is-selected'));
          slot.classList.add('is-selected');
        });
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
      renderCalendar();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
      renderCalendar();
    });

    renderCalendar();
    renderTimeSlots();
  }

  /* ---- Multi-Step Premium Form ---------------------------- */
  const formPanels   = document.querySelectorAll('.form-panel');
  const formSteps    = document.querySelectorAll('.form-step');
  const nextBtns     = document.querySelectorAll('[data-next-step]');
  const prevBtns     = document.querySelectorAll('[data-prev-step]');
  let currentStep    = 1;

  function goToStep(step) {
    const maxStep = formPanels.length;
    if (step < 1 || step > maxStep) return;

    formPanels.forEach((p, i) => p.classList.toggle('is-active', i + 1 === step));
    formSteps.forEach((s, i) => {
      s.classList.toggle('is-active', i + 1 === step);
      s.classList.toggle('is-done', i + 1 < step);
    });
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextBtns.forEach(btn => btn.addEventListener('click', () => goToStep(currentStep + 1)));
  prevBtns.forEach(btn => btn.addEventListener('click', () => goToStep(currentStep - 1)));

  // Service option selector
  document.querySelectorAll('.service-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const group = opt.closest('.service-selector');
      if (group) group.querySelectorAll('.service-option').forEach(o => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
    });
  });

  /* ---- Gallery Filter ------------------------------------- */
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item[data-type]');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      galleryItems.forEach(item => {
        const show = type === 'all' || item.dataset.type === type;
        item.style.opacity = '0';
        item.style.transform = 'scale(0.95)';
        setTimeout(() => {
          item.style.display = show ? '' : 'none';
          if (show) {
            requestAnimationFrame(() => {
              item.style.opacity = '1';
              item.style.transform = 'scale(1)';
            });
          }
        }, 150);
      });
    });
  });

  if (galleryItems.length) {
    galleryItems.forEach(item => {
      item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    });
  }

  /* ---- Contact / Devis Form Submission -------------------- */
  document.querySelectorAll('form[data-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = form.querySelector('[type="submit"]');
      const originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Envoi…'; btn.disabled = true; }

      // Collect named fields from this form
      const fd = new FormData(form);
      const data = { type: form.dataset.form || 'contact' };
      for (const [k, v] of fd.entries()) { if (v) data[k] = v; }

      // For devis: also collect vehicle info from step 1 of the same form-wrap
      if (data.type === 'devis') {
        const wrap = form.closest('[data-form-wrap]');
        if (wrap) {
          const selects = wrap.querySelectorAll('select');
          const inputs  = wrap.querySelectorAll('input[type="text"], input[type="number"]');
          const parts   = [];
          selects.forEach(s => { if (s.value && !s.name) parts.push(s.value); });
          inputs.forEach(i => { if (i.value && !i.name) parts.push(i.value); });
          if (parts.length) data.vehicleInfo = parts.join(' · ');
        }
      }

      try {
        await fetch('/api/contact', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(data)
        });
      } catch (_) {
        // Silently ignore network errors — show success anyway
      }

      // Show success UI
      const successEl = form.closest('[data-form-wrap]')?.querySelector('.success-message');
      if (successEl) {
        form.style.display = 'none';
        successEl.classList.add('is-visible');
      } else {
        if (btn) btn.textContent = 'Envoyé — Merci !';
      }
    });
  });

  /* ---- Booking - Nettoyage step logic --------------------- */
  const bookingConfirmBtn = document.querySelector('[data-confirm-booking]');
  if (bookingConfirmBtn) {
    bookingConfirmBtn.addEventListener('click', () => {
      const selectedDate = document.querySelector('.calendar__day.is-selected');
      const selectedTime = document.querySelector('.time-slot.is-selected');
      const wrap = bookingConfirmBtn.closest('[data-form-wrap]');
      const successEl = wrap?.querySelector('.success-message');

      if (!selectedDate || !selectedTime) {
        alert('Veuillez sélectionner une date et un créneau.');
        return;
      }
      if (successEl && wrap) {
        wrap.querySelector('.booking-form-content').style.display = 'none';
        successEl.classList.add('is-visible');
      }
    });
  }

  /* ---- Page Transition In --------------------------------- */
  const isIndex = window.location.pathname.split('/').pop().replace('.html','') === 'index' || window.location.pathname.endsWith('/');
  if (!isIndex) {
    document.documentElement.style.opacity = '0';
    document.documentElement.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.style.opacity = '1';
      });
    });
  }

  // Handle link transitions
  document.querySelectorAll('a[href]:not([href^="#"]):not([href^="mailto"]):not([href^="tel"]):not([target])').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.startsWith('http') || href.startsWith('//')) return;
      e.preventDefault();
      document.documentElement.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 400);
    });
  });

})();

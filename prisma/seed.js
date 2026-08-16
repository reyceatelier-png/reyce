'use strict';
// Seed initial : catalogue de prestations + horaires standards.
// Idempotent (upsert) — peut être relancé sans dupliquer les données.
// Lancé automatiquement au déploiement, après les migrations (voir package.json).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SERVICES = [
  { id: 'nettoyage-int-confort',    name: 'Nettoyage Intérieur — Confort',                 category: 'nettoyage', durationMin: 60,  priceCents:  6900, depositCents: 4000 },
  { id: 'nettoyage-int-premium',    name: 'Nettoyage Intérieur — Premium',                 category: 'nettoyage', durationMin: 90,  priceCents: 12900, depositCents: 4000 },
  { id: 'nettoyage-int-experience', name: 'Nettoyage Intérieur — Expérience',              category: 'nettoyage', durationMin: 240, priceCents: 22900, depositCents: 4000 },
  { id: 'nettoyage-ext-confort',    name: 'Nettoyage Extérieur — Confort',                 category: 'nettoyage', durationMin: 45,  priceCents:  4900, depositCents: 4000 },
  { id: 'nettoyage-ext-premium',    name: 'Nettoyage Extérieur — Premium',                 category: 'nettoyage', durationMin: 75,  priceCents:  8900, depositCents: 4000 },
  { id: 'nettoyage-ext-experience', name: 'Nettoyage Extérieur — Expérience',              category: 'nettoyage', durationMin: 180, priceCents: 14900, depositCents: 4000 },
  { id: 'nettoyage-duo-confort',    name: 'Nettoyage Intérieur + Extérieur — Confort',     category: 'nettoyage', durationMin: 90,  priceCents:  9900, depositCents: 4000 },
  { id: 'nettoyage-duo-premium',    name: 'Nettoyage Intérieur + Extérieur — Premium',     category: 'nettoyage', durationMin: 150, priceCents: 19900, depositCents: 4000 },
  { id: 'nettoyage-duo-experience', name: 'Nettoyage Intérieur + Extérieur — Expérience',  category: 'nettoyage', durationMin: 480, priceCents: 34900, depositCents: 4000 },
];

// 7j/7 — horaires standards (alignés sur les créneaux déjà utilisés côté site)
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

async function main() {
  for (const s of SERVICES) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        depositCents: s.depositCents,
      },
      create: s,
    });
  }

  for (const weekday of WEEKDAYS) {
    const existing = await prisma.availabilityRule.findFirst({ where: { weekday } });
    if (!existing) {
      await prisma.availabilityRule.create({
        data: { weekday, openTime: '09:00', closeTime: '18:00', active: true },
      });
    }
  }

  console.log(`Seed OK — ${SERVICES.length} prestations, ${WEEKDAYS.length} règles de disponibilité.`);
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

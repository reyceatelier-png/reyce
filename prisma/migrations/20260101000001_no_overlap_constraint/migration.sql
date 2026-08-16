-- Protection anti-double-réservation au niveau base de données.
-- Un même service ne peut pas avoir deux rendez-vous actifs (hors annulé / absent)
-- dont les plages horaires se chevauchent, même en cas d'écritures concurrentes.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Colonne calculée : plage horaire réelle du rendez-vous (date + heure début/fin)
ALTER TABLE "Appointment"
  ADD COLUMN "timeRange" tsrange GENERATED ALWAYS AS (
    tsrange(
      ("date"::date + "startTime"::time),
      ("date"::date + "endTime"::time),
      '[)'
    )
  ) STORED;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist (
    "serviceId" WITH =,
    "timeRange" WITH &&
  )
  WHERE ("status" NOT IN ('cancelled', 'no_show'));

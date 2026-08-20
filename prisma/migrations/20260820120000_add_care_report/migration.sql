-- CareReport : nouvelle table, aucun impact sur les tables existantes.
CREATE TABLE "CareReport" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "photosBefore" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "photosAfter" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "intervention" TEXT,
    "protections" TEXT,
    "observations" TEXT,
    "careAdvice" TEXT,
    "nextService" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareReport_token_key" ON "CareReport"("token");
CREATE UNIQUE INDEX "CareReport_appointmentId_key" ON "CareReport"("appointmentId");

ALTER TABLE "CareReport" ADD CONSTRAINT "CareReport_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

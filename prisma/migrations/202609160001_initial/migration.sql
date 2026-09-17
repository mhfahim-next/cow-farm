-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'WORKER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('DAIRY', 'BEEF', 'HEIFER', 'CALF');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('PURCHASED', 'FARM_BORN');

-- CreateEnum
CREATE TYPE "CowStatus" AS ENUM ('ACTIVE', 'SOLD', 'DECEASED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'PREGNANT', 'CLOSED_UNSUCCESSFUL', 'CLOSED_CALVED', 'CLOSED_LOSS');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('ARTIFICIAL_INSEMINATION', 'NATURAL_SERVICE');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PREGNANT', 'NOT_PREGNANT', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('ONGOING', 'CALVED', 'LOST');

-- CreateEnum
CREATE TYPE "HealthType" AS ENUM ('ILLNESS', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'INJURY', 'OTHER');

-- CreateEnum
CREATE TYPE "TreatmentType" AS ENUM ('MEDICATION', 'VACCINATION', 'DEWORMING', 'OTHER');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('HEAT_FOLLOWUP', 'INSEMINATION', 'PREGNANCY_CHECK', 'DRY_OFF', 'CALVING_PREPARATION', 'POSTPARTUM_CHECK', 'VACCINATION', 'DEWORMING', 'TREATMENT', 'VET_FOLLOWUP', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FarmUser" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FarmUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cow" (
    "id" UUID NOT NULL,
    "tagNumber" VARCHAR(50) NOT NULL,
    "name" TEXT,
    "photoUrl" TEXT,
    "sex" "Sex" NOT NULL,
    "category" "Category" NOT NULL,
    "breed" TEXT,
    "birthDate" DATE,
    "birthDateEstimated" BOOLEAN NOT NULL DEFAULT false,
    "origin" "Origin" NOT NULL,
    "purchaseDate" DATE,
    "purchasePrice" DECIMAL(12,2),
    "sellerName" TEXT,
    "motherId" UUID,
    "birthCalvingId" UUID,
    "sireDetails" TEXT,
    "status" "CowStatus" NOT NULL DEFAULT 'ACTIVE',
    "exitDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingCycle" (
    "id" UUID NOT NULL,
    "cowId" UUID NOT NULL,
    "startedOn" DATE NOT NULL,
    "closedOn" DATE,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BreedingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatObservation" (
    "id" UUID NOT NULL,
    "breedingCycleId" UUID NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "signs" TEXT NOT NULL,
    "observedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HeatObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingService" (
    "id" UUID NOT NULL,
    "breedingCycleId" UUID NOT NULL,
    "performedAt" TIMESTAMPTZ(3) NOT NULL,
    "method" "BreedingMethod" NOT NULL,
    "semenCode" TEXT,
    "semenBatch" TEXT,
    "bullDetails" TEXT,
    "technicianName" TEXT,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BreedingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyCheck" (
    "id" UUID NOT NULL,
    "breedingCycleId" UUID NOT NULL,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL,
    "method" TEXT NOT NULL,
    "result" "CheckResult" NOT NULL,
    "veterinarianName" TEXT,
    "nextCheckDate" DATE,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregnancy" (
    "id" UUID NOT NULL,
    "breedingCycleId" UUID NOT NULL,
    "breedingServiceId" UUID,
    "confirmedOn" DATE NOT NULL,
    "estimatedCalvingDate" DATE,
    "plannedDryOffDate" DATE,
    "actualDryOffDate" DATE,
    "status" "PregnancyStatus" NOT NULL DEFAULT 'ONGOING',
    "endedOn" DATE,
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calving" (
    "id" UUID NOT NULL,
    "pregnancyId" UUID NOT NULL,
    "calvedAt" TIMESTAMPTZ(3) NOT NULL,
    "assistanceLevel" TEXT,
    "totalBorn" INTEGER NOT NULL,
    "bornAlive" INTEGER NOT NULL,
    "stillborn" INTEGER NOT NULL,
    "attendedBy" TEXT,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Calving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" UUID NOT NULL,
    "cowId" UUID NOT NULL,
    "eventType" "HealthType" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "veterinarianName" TEXT,
    "consultationCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" UUID NOT NULL,
    "healthEventId" UUID NOT NULL,
    "treatmentType" "TreatmentType" NOT NULL,
    "productName" TEXT NOT NULL,
    "targetDisease" TEXT,
    "prescribedInstructions" TEXT NOT NULL,
    "prescribedBy" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'PLANNED',
    "milkWithdrawalRequired" BOOLEAN NOT NULL DEFAULT false,
    "meatWithdrawalRequired" BOOLEAN NOT NULL DEFAULT false,
    "milkRestrictedUntil" TIMESTAMPTZ(3),
    "meatRestrictedUntil" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentAdministration" (
    "id" UUID NOT NULL,
    "treatmentId" UUID NOT NULL,
    "administeredAt" TIMESTAMPTZ(3) NOT NULL,
    "doseAmount" DECIMAL(12,3) NOT NULL,
    "doseUnit" TEXT NOT NULL,
    "route" TEXT,
    "productBatch" TEXT,
    "productExpiry" DATE,
    "administeredBy" TEXT,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TreatmentAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledTask" (
    "completionEvidence" JSONB,
    "id" UUID NOT NULL,
    "cowId" UUID NOT NULL,
    "breedingCycleId" UUID,
    "pregnancyId" UUID,
    "healthEventId" UUID,
    "treatmentId" UUID,
    "assignedTo" UUID,
    "taskType" "TaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMPTZ(3),
    "completionNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScheduledTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmUser_email_key" ON "FarmUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cow_tagNumber_key" ON "Cow"("tagNumber");

-- CreateIndex
CREATE INDEX "Cow_status_category_idx" ON "Cow"("status", "category");

-- CreateIndex
CREATE INDEX "Cow_motherId_idx" ON "Cow"("motherId");

-- CreateIndex
CREATE INDEX "BreedingCycle_cowId_startedOn_idx" ON "BreedingCycle"("cowId", "startedOn");

-- CreateIndex
CREATE INDEX "HeatObservation_breedingCycleId_observedAt_idx" ON "HeatObservation"("breedingCycleId", "observedAt");

-- CreateIndex
CREATE INDEX "BreedingService_breedingCycleId_performedAt_idx" ON "BreedingService"("breedingCycleId", "performedAt");

-- CreateIndex
CREATE INDEX "PregnancyCheck_breedingCycleId_checkedAt_idx" ON "PregnancyCheck"("breedingCycleId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pregnancy_breedingCycleId_key" ON "Pregnancy"("breedingCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Pregnancy_breedingServiceId_key" ON "Pregnancy"("breedingServiceId");

-- CreateIndex
CREATE INDEX "Pregnancy_status_estimatedCalvingDate_idx" ON "Pregnancy"("status", "estimatedCalvingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Calving_pregnancyId_key" ON "Calving"("pregnancyId");

-- CreateIndex
CREATE INDEX "HealthEvent_cowId_occurredAt_idx" ON "HealthEvent"("cowId", "occurredAt");

-- CreateIndex
CREATE INDEX "Treatment_healthEventId_idx" ON "Treatment"("healthEventId");

-- CreateIndex
CREATE INDEX "TreatmentAdministration_treatmentId_administeredAt_idx" ON "TreatmentAdministration"("treatmentId", "administeredAt");

-- CreateIndex
CREATE INDEX "ScheduledTask_status_dueAt_idx" ON "ScheduledTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ScheduledTask_cowId_dueAt_idx" ON "ScheduledTask"("cowId", "dueAt");

-- CreateIndex
CREATE INDEX "ScheduledTask_assignedTo_status_idx" ON "ScheduledTask"("assignedTo", "status");

-- AddForeignKey
ALTER TABLE "Cow" ADD CONSTRAINT "Cow_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cow" ADD CONSTRAINT "Cow_birthCalvingId_fkey" FOREIGN KEY ("birthCalvingId") REFERENCES "Calving"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingCycle" ADD CONSTRAINT "BreedingCycle_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeatObservation" ADD CONSTRAINT "HeatObservation_breedingCycleId_fkey" FOREIGN KEY ("breedingCycleId") REFERENCES "BreedingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingService" ADD CONSTRAINT "BreedingService_breedingCycleId_fkey" FOREIGN KEY ("breedingCycleId") REFERENCES "BreedingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_breedingCycleId_fkey" FOREIGN KEY ("breedingCycleId") REFERENCES "BreedingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_breedingCycleId_fkey" FOREIGN KEY ("breedingCycleId") REFERENCES "BreedingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_breedingServiceId_fkey" FOREIGN KEY ("breedingServiceId") REFERENCES "BreedingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calving" ADD CONSTRAINT "Calving_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_healthEventId_fkey" FOREIGN KEY ("healthEventId") REFERENCES "HealthEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdministration" ADD CONSTRAINT "TreatmentAdministration_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_breedingCycleId_fkey" FOREIGN KEY ("breedingCycleId") REFERENCES "BreedingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_healthEventId_fkey" FOREIGN KEY ("healthEventId") REFERENCES "HealthEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "FarmUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Prisma cannot express partial unique indexes and CHECK constraints in its schema.
CREATE UNIQUE INDEX "one_active_cycle_per_cow" ON "BreedingCycle" ("cowId") WHERE status IN ('OPEN','PREGNANT');
ALTER TABLE "Cow" ADD CONSTRAINT "cow_purchase_nonnegative" CHECK ("purchasePrice" IS NULL OR "purchasePrice">=0), ADD CONSTRAINT "cow_not_own_mother" CHECK ("motherId" IS NULL OR "motherId"<>id), ADD CONSTRAINT "cow_sex_category" CHECK (sex<>'MALE' OR category NOT IN ('DAIRY','HEIFER')), ADD CONSTRAINT "cow_exit_state" CHECK ((status='ACTIVE' AND "exitDate" IS NULL) OR (status<>'ACTIVE' AND "exitDate" IS NOT NULL));
ALTER TABLE "BreedingCycle" ADD CONSTRAINT "cycle_dates" CHECK ("closedOn" IS NULL OR "closedOn">="startedOn");
ALTER TABLE "BreedingService" ADD CONSTRAINT "service_cost" CHECK (cost>=0);
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "check_cost" CHECK (cost>=0);
ALTER TABLE "HealthEvent" ADD CONSTRAINT "consultation_cost" CHECK ("consultationCost">=0), ADD CONSTRAINT "health_resolution" CHECK ("resolvedAt" IS NULL OR "resolvedAt">="occurredAt");
ALTER TABLE "Pregnancy" ADD CONSTRAINT "pregnancy_dates" CHECK ("endedOn" IS NULL OR "endedOn">="confirmedOn"), ADD CONSTRAINT "pregnancy_state" CHECK ((status='ONGOING' AND "endedOn" IS NULL) OR (status<>'ONGOING' AND "endedOn" IS NOT NULL));
ALTER TABLE "Calving" ADD CONSTRAINT "birth_counts" CHECK ("totalBorn">0 AND "bornAlive">=0 AND stillborn>=0 AND "totalBorn"="bornAlive"+stillborn);
ALTER TABLE "Treatment" ADD CONSTRAINT "treatment_dates" CHECK ("endsOn" IS NULL OR "endsOn">="startsOn");
ALTER TABLE "TreatmentAdministration" ADD CONSTRAINT "administration_values" CHECK ("doseAmount">0 AND cost>=0);
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "task_completion" CHECK ((status='COMPLETED' AND "completedAt" IS NOT NULL AND "completionNotes" IS NOT NULL) OR (status<>'COMPLETED' AND "completedAt" IS NULL));

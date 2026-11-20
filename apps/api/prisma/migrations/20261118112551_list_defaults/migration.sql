-- AlterTable
ALTER TABLE "AdCampaign" ALTER COLUMN "placements" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "areaIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "BonusCampaign" ALTER COLUMN "clinicIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Clinic" ALTER COLUMN "photos" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "languagesSpoken" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "FreeHours" ALTER COLUMN "weekdays" SET DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "OpenSlot" ALTER COLUMN "weekdays" SET DEFAULT ARRAY[]::INTEGER[],
ALTER COLUMN "specialtyIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PaymentConfig" ALTER COLUMN "allowedModes" SET DEFAULT ARRAY[]::"PaymentMode"[];

-- AlterTable
ALTER TABLE "Sitting" ALTER COLUMN "weekdays" SET DEFAULT ARRAY[]::INTEGER[],
ALTER COLUMN "specificDates" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Specialty" ALTER COLUMN "keywords" SET DEFAULT ARRAY[]::TEXT[];

-- Backfill NULL arrays so `isEmpty` / `has` filters behave consistently.
UPDATE "AdCampaign" SET "placements" = ARRAY[]::TEXT[] WHERE "placements" IS NULL;
UPDATE "AdCampaign" SET "areaIds" = ARRAY[]::TEXT[] WHERE "areaIds" IS NULL;
UPDATE "BonusCampaign" SET "clinicIds" = ARRAY[]::TEXT[] WHERE "clinicIds" IS NULL;
UPDATE "Clinic" SET "photos" = ARRAY[]::TEXT[] WHERE "photos" IS NULL;
UPDATE "Doctor" SET "languagesSpoken" = ARRAY[]::TEXT[] WHERE "languagesSpoken" IS NULL;
UPDATE "OpenSlot" SET "specialtyIds" = ARRAY[]::TEXT[] WHERE "specialtyIds" IS NULL;
UPDATE "PaymentConfig" SET "allowedModes" = ARRAY[]::"PaymentMode"[] WHERE "allowedModes" IS NULL;
UPDATE "Sitting" SET "specificDates" = ARRAY[]::TEXT[] WHERE "specificDates" IS NULL;
UPDATE "Specialty" SET "keywords" = ARRAY[]::TEXT[] WHERE "keywords" IS NULL;

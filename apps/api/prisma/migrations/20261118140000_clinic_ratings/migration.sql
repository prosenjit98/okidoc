-- PAT-16: patients rate the clinic as well as the doctor.

-- Clinic aggregate rating
ALTER TABLE "Clinic" ADD COLUMN "ratingAvg" DOUBLE PRECISION,
ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- Review: doctor rating becomes optional, clinic rating added, clinic linked
ALTER TABLE "Review" ALTER COLUMN "rating" DROP NOT NULL,
ADD COLUMN "clinicRating" INTEGER,
ADD COLUMN "clinicId" TEXT;

-- Backfill the clinic of existing reviews from booking → sitting instance → sitting → clinic-doctor link
UPDATE "Review" r
SET "clinicId" = l."clinicId"
FROM "Booking" b
JOIN "SittingInstance" i ON i."id" = b."instanceId"
JOIN "Sitting" s ON s."id" = i."sittingId"
JOIN "ClinicDoctorLink" l ON l."id" = s."linkId"
WHERE b."id" = r."bookingId";

ALTER TABLE "Review" ALTER COLUMN "clinicId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Review_doctorId_idx" ON "Review"("doctorId");
CREATE INDEX "Review_clinicId_idx" ON "Review"("clinicId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

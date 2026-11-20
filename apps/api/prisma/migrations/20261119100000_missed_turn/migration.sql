-- BR-06a missed turn: rejoin rule, patient check-in, move to next sitting
ALTER TABLE "Clinic" ADD COLUMN "lateRejoinAfter" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Booking" ADD COLUMN "rejoinAfter" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "checkInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "moveCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "movedFrom" TEXT;

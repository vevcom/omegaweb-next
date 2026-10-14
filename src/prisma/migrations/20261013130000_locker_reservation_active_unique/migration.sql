-- A locker held one reservation row for good: reservations are deactivated, never deleted, when they
-- end, so a unique lockerId kept an expired reservation from ever being followed by a new one. The
-- index now covers only active reservations - one active reservation per locker.

-- DropIndex
DROP INDEX "LockerReservation_lockerId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LockerReservation_lockerId_key" ON "LockerReservation"("lockerId") WHERE ("active" = true);

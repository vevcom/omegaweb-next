-- CreateTable
CREATE TABLE "EventSlotSchedule" (
    "variantId" INTEGER NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "longBreakEveryMinutes" INTEGER,
    "longBreakMinutes" INTEGER,

    CONSTRAINT "EventSlotSchedule_pkey" PRIMARY KEY ("variantId"),
    -- A check passes on null, so the long break's minutes are checked only when it has them.
    CONSTRAINT "EventSlotSchedule_minutes_check" CHECK (
        "slotMinutes" > 0 AND "breakMinutes" >= 0 AND "totalMinutes" > 0
        AND "longBreakEveryMinutes" > 0 AND "longBreakMinutes" > 0
    ),
    CONSTRAINT "EventSlotSchedule_long_break_check" CHECK (num_nonnulls("longBreakEveryMinutes", "longBreakMinutes") IN (0, 2))
);

-- CreateTable
CREATE TABLE "EventSlot" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventSlot_period_check" CHECK ("start" < "end")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSlot_variantId_start_key" ON "EventSlot"("variantId", "start");

-- AddForeignKey
ALTER TABLE "EventSlotSchedule" ADD CONSTRAINT "EventSlotSchedule_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "EventVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSlot" ADD CONSTRAINT "EventSlot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "EventVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


import { owIdToPnId } from './IdMapper'
import { createProgressBar } from './progressBar'
import { resyncIdSequence } from './resyncIdSequence'
import logger from '@/lib/logger'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Prisma as OwPrisma } from '@/prisma-generated-ow-basic/client'
import type { UserMigrator } from './migrateUsers'
import type { IdMapper } from './IdMapper'
import type { Limits } from './migrationLimits'

type OwLocker = OwPrisma.LockersGetPayload<{ include: { LockerReservations: true } }>
type OwLockerReservation = OwLocker['LockerReservations'][number]

/**
 * PN dropped Omegaweb-basic's Lockers.number and identifies a locker by its id instead,
 * while the number is what is physically painted on the locker. Migrating with the old
 * number as the new id is what keeps those two agreeing, so a member who reserved locker
 * 214 still finds it at /lockers/214.
 */
function pnLockerId(locker: OwLocker): number {
    return locker.number
}

/**
 * Omegaweb-basic stored the floor as free text, PN as an integer. Anything that is not a
 * plain number ("U", "kjeller", ...) has no representation on the new side, so the locker
 * is reported and skipped rather than silently parked on floor 0.
 */
function parseFloor(locker: OwLocker): number | null {
    const floor = Number(locker.floor.trim())
    if (!Number.isInteger(floor)) {
        logger.warn(
            `Locker ${locker.number} sits on floor "${locker.floor}" in ${locker.building}, which is `
            + 'not an integer. PN floors are integers, so the locker is skipped.'
        )
        return null
    }
    return floor
}

/**
 * PN allows a locker exactly one reservation row - LockerReservation.lockerId is unique -
 * whereas Omegaweb-basic kept every reservation a locker ever had. Only the most recent
 * one is still meaningful, so that is the one that comes across and the rest of the
 * history is dropped.
 */
function latestReservation(locker: OwLocker): OwLockerReservation | null {
    const reservations = locker.LockerReservations.filter(reservation => reservation.UserId !== null)
    if (!reservations.length) return null

    return reservations.reduce((latest, candidate) => {
        const latestDate = latest.reservedDate?.getTime() ?? 0
        const candidateDate = candidate.reservedDate?.getTime() ?? 0
        if (candidateDate !== latestDate) return candidateDate > latestDate ? candidate : latest
        return candidate.id > latest.id ? candidate : latest
    })
}

/**
 * Migrates Omegaweb-basic Lockers and their reservations into PN's
 * LockerLocation/Locker/LockerReservation trio. Locations do not exist on the old side at
 * all - they are derived from the distinct (building, floor) pairs the lockers sit on.
 *
 * Lockers and reservations are written with explicit ids (see pnLockerId), so the step is
 * re-runnable and the sequences are resynced at the end.
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param userMigrator - resolves (and migrates on demand) the user holding a reservation
 * @param committeeGroupIdMap - IdMapper - ow committee id -> pn group id, for lockers a
 * committee reserved rather than an individual
 * @param limits - Limits - used to limit the number of lockers to migrate
 */
export default async function migrateLockers(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    userMigrator: UserMigrator,
    committeeGroupIdMap: IdMapper,
    limits: Limits,
) {
    const allLockers = await owPrisma.lockers.findMany({
        take: limits.lockers ? limits.lockers : undefined,
        include: { LockerReservations: true },
    })

    const alreadyMigrated = new Set((await pnPrisma.locker.findMany({
        where: { id: { in: allLockers.map(pnLockerId) } },
        select: { id: true },
    })).map(locker => locker.id))

    const lockers = allLockers
        .filter(locker => !alreadyMigrated.has(pnLockerId(locker)))
        .flatMap(locker => {
            const floor = parseFloor(locker)
            return floor === null ? [] : [{ locker, floor }]
        })

    // Every distinct (building, floor) the lockers live on has to exist as a
    // LockerLocation before any locker can point at it.
    const locations = new Map(lockers.map(
        ({ locker, floor }) => [`${locker.building}-${floor}`, { building: locker.building, floor }]
    ))
    await Promise.all(Array.from(locations.values()).map(location => pnPrisma.lockerLocation.upsert({
        where: { building_floor: location },
        update: {},
        create: location,
    })))

    const bar = createProgressBar('Migrating lockers', lockers.length)
    for (const { locker, floor } of lockers) {
        const reservation = latestReservation(locker)

        // Resolved before the transaction opens, not inside it: getPnUserId migrates the
        // user on demand when it has not seen them yet, and those writes go through the
        // outer client - issuing them while an interactive transaction is open would put
        // them outside it and hold the transaction open for the round trip.
        const reservationData = reservation ? {
            id: reservation.id,
            lockerId: pnLockerId(locker),
            userId: await userMigrator.getPnUserId(reservation.UserId as number),
            groupId: owIdToPnId(committeeGroupIdMap, reservation.CommitteeId, 'committees'),
            // Omegaweb-basic recorded only when a locker was taken, never when it falls
            // free, so every migrated reservation comes across as open-ended and active -
            // the same thing the old site showed.
            createdAt: reservation.reservedDate ?? undefined,
            endDate: null,
            active: true,
        } : null

        // Both rows land together, so a failure never leaves a locker behind without the
        // reservation that belongs to it. That matters because alreadyMigrated above
        // filters on the locker alone: a half-written locker would be skipped on the next
        // run and its reservation lost for good.
        await pnPrisma.$transaction(async tx => {
            await tx.locker.create({
                data: {
                    id: pnLockerId(locker),
                    building: locker.building,
                    floor,
                    createdAt: locker.createdAt,
                    updatedAt: locker.updatedAt,
                }
            })

            if (reservationData) {
                await tx.lockerReservation.create({ data: reservationData })
            }
        })

        bar.increment()
    }
    bar.stop()

    await resyncIdSequence(pnPrisma, 'Locker')
    await resyncIdSequence(pnPrisma, 'LockerLocation')
    await resyncIdSequence(pnPrisma, 'LockerReservation')
}

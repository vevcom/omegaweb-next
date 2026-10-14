import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const buildings = ['G-Blokk', 'Test-Blokk']
const floors = [1, 2, 3]
const LOCKERS_PER_LOCATION = 10
const RESERVATION_COUNT = 10

export const seedDevLockers = defineSeedOperation(async (prisma: PrismaClient) => {
    const locations = buildings.flatMap(building => floors.map(floor => ({ building, floor })))

    await Promise.all(locations.map(location => prisma.lockerLocation.upsert({
        where: { building_floor: location },
        update: {},
        create: location,
    })))

    // Lockers have no key of their own, so each location is topped up to LOCKERS_PER_LOCATION
    // rather than handed another ten on every run.
    await Promise.all(locations.map(async location => {
        const existingCount = await prisma.locker.count({ where: location })
        await prisma.locker.createMany({
            data: Array.from({ length: Math.max(LOCKERS_PER_LOCATION - existingCount, 0) }).map(() => location),
        })
    }))

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [lockers, users] = await Promise.all([
        prisma.locker.findMany({
            orderBy: { id: 'asc' },
            take: RESERVATION_COUNT,
            select: { id: true, LockerReservation: { where: { active: true }, select: { id: true } } },
        }),
        prisma.user.findMany({ orderBy: { id: 'asc' }, take: RESERVATION_COUNT, select: { id: true } }),
    ])

    // The first lockers go to the first users, the last of them with no end date. A locker holds
    // at most one active reservation, so one that is already reserved is left as it is.
    await prisma.lockerReservation.createMany({
        data: lockers.flatMap((locker, index) => (locker.LockerReservation.length ? [] : [{
            lockerId: locker.id,
            userId: users[index].id,
            endDate: index === lockers.length - 1 ? null : tomorrow,
        }])),
    })
})

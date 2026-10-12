import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { describe, expect, test } from '@jest/globals'

const session = Session.fromJsObject({ memberships: [], permissions: ['CABIN_ADMIN'], user: null })

const day = 24 * 60 * 60 * 1000
/** Midnight UTC the given number of months ahead - far past everything the seed has released or priced. */
function monthsAhead(months: number) {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()))
}

describe('release periods', () => {
    test('a release that has not happened can be moved, but stays in order with the one before it', async () => {
        const release = await cabinReleasePeriodOperations.create({
            data: { releaseTime: monthsAhead(6), releaseUntil: monthsAhead(8) },
            session,
        })
        const previous = await prisma.releasePeriod.findFirstOrThrow({
            where: { id: { not: release.id }, releaseTime: { lte: release.releaseTime } },
            orderBy: { releaseTime: 'desc' },
        })

        await cabinReleasePeriodOperations.update({
            params: { id: release.id },
            data: { releaseTime: monthsAhead(7), releaseUntil: monthsAhead(9) },
            session,
        })
        expect(await prisma.releasePeriod.findUniqueOrThrow({ where: { id: release.id } })).toMatchObject({
            releaseTime: monthsAhead(7),
            releaseUntil: monthsAhead(9),
        })

        await expect(cabinReleasePeriodOperations.update({
            params: { id: release.id },
            data: { releaseTime: new Date(previous.releaseTime.getTime() - day), releaseUntil: monthsAhead(9) },
            session,
        })).rejects.toThrow(new Smorekopp('BAD DATA'))
    })

    test('a release that has happened cannot be changed', async () => {
        const published = await prisma.releasePeriod.findFirstOrThrow({ where: { releaseTime: { lte: new Date() } } })

        await expect(cabinReleasePeriodOperations.update({
            params: { id: published.id },
            data: { releaseTime: monthsAhead(10), releaseUntil: monthsAhead(11) },
            session,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
})

describe('price periods', () => {
    test('an unpublished period can be moved, but not into the released dates or past its neighbours', async () => {
        const first = await cabinPricePeriodOperations.create({
            data: { validFrom: monthsAhead(12), copyPreviousPrices: false },
            session,
        })
        const second = await cabinPricePeriodOperations.create({
            data: { validFrom: monthsAhead(14), copyPreviousPrices: false },
            session,
        })

        await cabinPricePeriodOperations.update({ params: { id: second.id }, data: { validFrom: monthsAhead(15) }, session })
        expect(await prisma.pricePeriod.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
            validFrom: monthsAhead(15),
        })

        await expect(cabinPricePeriodOperations.update({
            params: { id: second.id },
            data: { validFrom: monthsAhead(11) },
            session,
        })).rejects.toThrow(new Smorekopp('BAD DATA'))

        const release = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ session })
        await expect(cabinPricePeriodOperations.update({
            params: { id: first.id },
            data: { validFrom: new Date((release?.releaseUntil.getTime() ?? Date.now()) - day) },
            session,
        })).rejects.toThrow(new Smorekopp('BAD DATA'))
    })

    test('a published period cannot be changed', async () => {
        const published = await prisma.pricePeriod.findFirstOrThrow({ orderBy: { validFrom: 'asc' } })

        await expect(cabinPricePeriodOperations.update({
            params: { id: published.id },
            data: { validFrom: monthsAhead(20) },
            session,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
})

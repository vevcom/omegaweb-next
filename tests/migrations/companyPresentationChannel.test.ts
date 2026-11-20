import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { userOperations } from '@/services/users/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { beforeAll, describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'
import type { EventKind, Prisma, SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import type { NotificationMethodGeneral } from '@/services/notifications/types'

// The suite's database is pushed from the schema and seeded, so it never runs the migration and has
// what the migration makes already. Each test puts that back as it was before the migration.
const migration = readFileSync('src/prisma/migrations/20261120110000_company_presentation_channel/migration.sql', 'utf8')

const emailOnly = { ...allNotificationMethodsOff, email: true }
const pushOnly = { ...allNotificationMethodsOff, push: true }
const weeklyOnly = { ...allNotificationMethodsOff, emailWeekly: true }

/** A special channel, or the presentation's own channel or its info channel. */
type Place = SpecialNotificationChannel | 'OWN' | 'INFO'

/** Each user's rows, by the channel they are on. */
const choicesOfUsers: Record<string, Partial<Record<Place, NotificationMethodGeneral>>> = {
    onEventAlone: { EVENT: emailOnly },
    onEventAndContactor: { EVENT: emailOnly, CONTACTOR: allNotificationMethodsOff },
    onEventAsOnContactor: { EVENT: pushOnly, CONTACTOR: pushOnly },
    onContactor: { CONTACTOR: allNotificationMethodsOn },
    onRootAndContactor: { ROOT: emailOnly, CONTACTOR: pushOnly },
    onRoot: { ROOT: allNotificationMethodsOn },
    weeklyOnRootAlone: { ROOT: weeklyOnly, CONTACTOR: allNotificationMethodsOff },
    onOwnChannel: { OWN: emailOnly, CONTACTOR: pushOnly },
    onInfoChannel: { INFO: pushOnly, EVENT: emailOnly },
    none: {},
}

describe('the migration moving the company presentations under a channel of their own', () => {
    const userIds: Record<string, number> = {}
    let presentationId: number
    let ordinaryId: number

    beforeAll(async () => {
        const createEvent = async (kind: EventKind) => (await eventOperations.create({
            data: { kind, name: `Migrasjonstest ${kind}`, visibilityAdminRequirements: [{ conditions: [] }] },
            bypassAuth: true,
        })).id
        presentationId = await createEvent('COMPANY_PRESENTATION')
        ordinaryId = await createEvent('ORDINARY')

        for (const name of Object.keys(choicesOfUsers)) {
            userIds[name] = (await userOperations.create({
                data: {
                    email: `migration-${name}@omega.ntnu.no`,
                    firstname: 'Migrasjon',
                    lastname: name,
                    username: `migration${name.toLowerCase()}`,
                    emailVerified: new Date().toISOString(),
                },
                bypassAuth: true,
            })).id
        }
    })

    /** Runs the steps in a transaction that is undone afterwards, so each test starts from the seeded channels. */
    async function inUndoneTransaction(steps: (tx: Prisma.TransactionClient) => Promise<void>) {
        const undo = new Error('Undone')
        await expect(prisma.$transaction(async tx => {
            await steps(tx)
            throw undo
        })).rejects.toBe(undo)
    }

    const readSpecial = (tx: Prisma.TransactionClient, special: SpecialNotificationChannel) =>
        tx.notificationChannel.findUniqueOrThrow({ where: { special } })

    const readOwnChannel = async (tx: Prisma.TransactionClient, eventId: number) =>
        (await tx.event.findUniqueOrThrow({
            where: { id: eventId },
            select: { notificationChannel: true },
        })).notificationChannel

    /** The presentations under the channel of all events, and no channel of their own. */
    async function undoMigration(tx: Prisma.TransactionClient) {
        const [events, presentations] = await Promise.all([
            readSpecial(tx, 'EVENT'),
            readSpecial(tx, 'COMPANY_PRESENTATION'),
        ])
        await tx.notificationChannel.updateMany({ where: { parentId: presentations.id }, data: { parentId: events.id } })
        await tx.notificationChannel.delete({ where: { id: presentations.id } })
        await tx.notificationMethod.delete({ where: { id: presentations.availableMethodsId } })
    }

    test('the channel is made under Contactor\'s, and the presentations are moved under it', async () => {
        await inUndoneTransaction(async tx => {
            await undoMigration(tx)
            await tx.$executeRawUnsafe(migration)

            const [contactor, events, presentations] = await Promise.all([
                readSpecial(tx, 'CONTACTOR'),
                readSpecial(tx, 'EVENT'),
                readSpecial(tx, 'COMPANY_PRESENTATION'),
            ])
            expect(presentations)
                .toMatchObject({ name: 'Bedriftspresentasjoner', purpose: 'SPECIAL', parentId: contactor.id })
            expect((await readOwnChannel(tx, presentationId)).parentId).toBe(presentations.id)
            expect((await readOwnChannel(tx, ordinaryId)).parentId).toBe(events.id)
        })
    })

    test('every user hears of the presentations as before, by a row where it takes one', async () => {
        await inUndoneTransaction(async tx => {
            await undoMigration(tx)
            const { notificationChannelId, infoNotificationChannelId } = await tx.event.findUniqueOrThrow({
                where: { id: presentationId },
            })
            const ofPresentation = { OWN: notificationChannelId, INFO: infoNotificationChannelId }
            const channelIdOf = async (place: Place) => (
                place === 'OWN' || place === 'INFO' ? ofPresentation[place] : (await readSpecial(tx, place)).id
            )
            for (const [name, choices] of Object.entries(choicesOfUsers)) {
                for (const [place, methods] of Object.entries(choices)) {
                    await tx.notificationSubscription.create({
                        data: {
                            user: { connect: { id: userIds[name] } },
                            channel: { connect: { id: await channelIdOf(place as Place) } },
                            methods: { create: methods },
                        },
                    })
                }
            }
            const readRowsOfPresentation = () => tx.notificationSubscription.findMany({
                where: { channelId: { in: Object.values(ofPresentation) }, userId: { in: Object.values(userIds) } },
                select: { userId: true, channelId: true, methods: { select: allNotificationMethodsOn } },
                orderBy: { userId: 'asc' },
            })
            const channelIds = [(await readSpecial(tx, 'EVENT')).id, ...Object.values(ofPresentation)]
            const resolveAll = () => Promise.all(Object.values(userIds).map(userId =>
                notificationSubscriptionOperations.read({ params: { userId, channelIds }, bypassAuth: true, prisma: tx })
            ))

            const before = await resolveAll()
            const rowsOfPresentationBefore = await readRowsOfPresentation()
            expect(rowsOfPresentationBefore).toHaveLength(2)
            await tx.$executeRawUnsafe(migration)
            expect(await resolveAll()).toEqual(before)
            expect(await readRowsOfPresentation()).toEqual(rowsOfPresentationBefore)

            const presentations = await readSpecial(tx, 'COMPANY_PRESENTATION')
            const given = await tx.notificationSubscription.findMany({
                where: { channelId: presentations.id, userId: { in: Object.values(userIds) } },
                select: { userId: true, methods: { select: allNotificationMethodsOn } },
                orderBy: { userId: 'asc' },
            })
            expect(given).toEqual([
                { userId: userIds.onEventAlone, methods: emailOnly },
                { userId: userIds.onEventAndContactor, methods: emailOnly },
                { userId: userIds.onEventAsOnContactor, methods: pushOnly },
                { userId: userIds.onContactor, methods: allNotificationMethodsOff },
                { userId: userIds.onRootAndContactor, methods: emailOnly },
                { userId: userIds.weeklyOnRootAlone, methods: weeklyOnly },
                { userId: userIds.onOwnChannel, methods: allNotificationMethodsOff },
                { userId: userIds.onInfoChannel, methods: emailOnly },
            ])
        })
    })

    test.each(['CONTACTOR', 'EVENT'] as const)('it stops when %s is missing and there are presentations', async special => {
        await inUndoneTransaction(async tx => {
            await undoMigration(tx)
            await tx.notificationChannel.update({ where: { special }, data: { special: null } })
            await expect(tx.$executeRawUnsafe(migration))
                .rejects.toThrow('the special notification channel CONTACTOR or EVENT is missing')
        })
    })

    test('it does nothing when a channel is missing and there are no presentations', async () => {
        await inUndoneTransaction(async tx => {
            await undoMigration(tx)
            await tx.event.updateMany({ where: { kind: 'COMPANY_PRESENTATION' }, data: { kind: 'ORDINARY' } })
            await tx.notificationChannel.update({ where: { special: 'CONTACTOR' }, data: { special: null } })
            await tx.$executeRawUnsafe(migration)

            expect(await tx.notificationChannel.count({ where: { special: 'COMPANY_PRESENTATION' } })).toBe(0)
        })
    })
})

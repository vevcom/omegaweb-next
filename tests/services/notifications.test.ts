import { prisma } from '@/prisma-pn-client-instance'
import { notificationMethodOperations } from '@/services/notifications/methods/operations'
import {
    notificationDispatchIncluder,
    readChannelChainIds,
    recipientsWhere,
} from '@/services/notifications/methods/recipients'
import { buildWeeklyDigestText } from '@/services/notifications/methods/dispatchWeekly'
import { userPrivateSelection } from '@/services/users/constants'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { permissionOperations } from '@/services/permissions/operations'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { NotificationMethods } from '@/services/notifications/types'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

// NOTE: The actual mail sending (dispatchEmail / sendWeeklyMail) is not exercised here since it
// goes through the real mail handler. The recipient resolution and outbox materialization - the
// logic specific to the worker-based dispatch - are covered.

const testGroupIds: number[] = []
const testVisibilityIds: number[] = []
const testEventIds: number[] = []

afterEach(async () => {
    await prisma.weeklyMailOutboxEntry.deleteMany()
    await prisma.notification.deleteMany({ where: { title: { startsWith: 'test-' } } })
    await Promise.all(testEventIds.map(id => eventOperations.destroy({ params: { id }, bypassAuth: true })))
    testEventIds.length = 0
    await prisma.visibility.deleteMany({ where: { id: { in: testVisibilityIds } } })
    await prisma.membership.deleteMany({ where: { user: { username: { startsWith: 'test-' } } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.group.deleteMany({ where: { id: { in: testGroupIds } } })
    testGroupIds.length = 0
    testVisibilityIds.length = 0
})

async function createTestUser(username: string): Promise<UserFiltered> {
    const user = await prisma.user.create({
        data: {
            username,
            email: `${username}@test.test`,
            firstname: 'Test',
            lastname: 'Testesen',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
    return await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: userPrivateSelection,
    })
}

async function subscribe(userId: number, channelId: number, methods: Partial<Record<NotificationMethods, boolean>>) {
    await prisma.notificationSubscription.create({
        data: {
            user: { connect: { id: userId } },
            channel: { connect: { id: channelId } },
            methods: {
                create: methods,
            },
        },
    })
}

async function readRootChannelId(): Promise<number> {
    const channel = await prisma.notificationChannel.findUniqueOrThrow({
        where: { special: 'ROOT' },
        select: { id: true },
    })
    return channel.id
}

async function createTestNotification(data: {
    channelId: number,
    title: string,
    targetUserIds?: number[],
    visibilityId?: number,
    permission?: Permission,
    canRegisterForEventId?: number,
    createdAt?: Date,
}) {
    return await prisma.notification.create({
        data: {
            channelId: data.channelId,
            title: data.title,
            message: 'A message for the digest.',
            createdAt: data.createdAt,
            usersTargeted: data.targetUserIds
                ? { connect: data.targetUserIds.map(userId => ({ id: userId })) }
                : undefined,
            visibilityId: data.visibilityId,
            permission: data.permission,
            canRegisterForEventId: data.canRegisterForEventId,
        },
        include: notificationDispatchIncluder,
    })
}

async function resolveRecipientIds(notificationId: number, method: NotificationMethods): Promise<number[]> {
    const notification = await prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
        include: notificationDispatchIncluder,
    })
    const defaultPermissions = await permissionOperations.readDefaultPermissions({ bypassAuth: true })
    const recipients = await prisma.user.findMany({
        where: recipientsWhere(
            notification, method, defaultPermissions, await readChannelChainIds(prisma, notification.channelId)
        ),
        select: { id: true },
    })
    return recipients.map(user => user.id).sort()
}

describe('notification recipient resolution', () => {
    test('only subscribers with the method enabled receive', async () => {
        const channelId = await readRootChannelId()
        const bothMethods = await createTestUser('test-recipient-both')
        const emailOnly = await createTestUser('test-recipient-email-only')
        await createTestUser('test-recipient-unsubscribed')
        await subscribe(bothMethods.id, channelId, { email: true, emailWeekly: true })
        await subscribe(emailOnly.id, channelId, { email: true, emailWeekly: false })

        const notification = await createTestNotification({ channelId, title: 'test-methods' })

        expect(await resolveRecipientIds(notification.id, 'email'))
            .toEqual([bothMethods.id, emailOnly.id].sort())
        expect(await resolveRecipientIds(notification.id, 'emailWeekly'))
            .toEqual([bothMethods.id])
    })

    test('targeted users intersect with subscribers', async () => {
        const channelId = await readRootChannelId()
        const targeted = await createTestUser('test-target-subscribed')
        const notTargeted = await createTestUser('test-target-not-targeted')
        const targetedButUnsubscribed = await createTestUser('test-target-unsubscribed')
        await subscribe(targeted.id, channelId, { email: true, emailWeekly: true })
        await subscribe(notTargeted.id, channelId, { email: true, emailWeekly: true })

        const notification = await createTestNotification({
            channelId,
            title: 'test-targeted',
            targetUserIds: [targeted.id, targetedButUnsubscribed.id],
        })

        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([targeted.id])
    })

    test('visibility is evaluated against current memberships', async () => {
        const channelId = await readRootChannelId()
        const member = await createTestUser('test-visibility-member')
        const outsider = await createTestUser('test-visibility-outsider')
        await subscribe(member.id, channelId, { email: true, emailWeekly: true })
        await subscribe(outsider.id, channelId, { email: true, emailWeekly: true })

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({ data: { groupType: 'MANUAL_GROUP', order } })
        testGroupIds.push(group.id)
        await prisma.membership.create({
            data: { userId: member.id, groupId: group.id, admin: false, active: true, order },
        })

        const visibility = await prisma.visibility.create({
            data: {
                requirements: {
                    create: [{
                        conditions: {
                            create: [{ groupId: group.id, type: 'ACTIVE', order }],
                        },
                    }],
                },
            },
        })
        testVisibilityIds.push(visibility.id)

        const notification = await createTestNotification({
            channelId,
            title: 'test-visibility',
            visibilityId: visibility.id,
        })

        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([member.id])

        // The outsider joins the group after the notification was created - since recipients are
        // resolved at dispatch time, they are now included.
        await prisma.membership.create({
            data: { userId: outsider.id, groupId: group.id, admin: false, active: true, order },
        })
        expect(await resolveRecipientIds(notification.id, 'email'))
            .toEqual([member.id, outsider.id].sort())
    })

    test('who can register for an event is resolved against its quotas when dispatched', async () => {
        const channelId = await readRootChannelId()
        const member = await createTestUser('test-register-member')
        const outsider = await createTestUser('test-register-outsider')
        await subscribe(member.id, channelId, { email: true, emailWeekly: true })
        await subscribe(outsider.id, channelId, { email: true, emailWeekly: true })

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({ data: { groupType: 'MANUAL_GROUP', order } })
        testGroupIds.push(group.id)
        await prisma.membership.create({
            data: { userId: member.id, groupId: group.id, admin: false, active: true, order },
        })

        const event = await eventOperations.create({
            data: {
                name: 'test-event',
                location: 'Lophtet',
                eventStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
                eventEnd: new Date(Date.now() + 26 * 60 * 60 * 1000),
                canBeViewedBy: 'ALL',
                takesRegistration: false,
                waitingList: false,
                allowRegistrationInMultipleVariants: false,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
            },
            bypassAuth: true,
        })
        testEventIds.push(event.id)
        const notification = await createTestNotification({
            channelId,
            title: 'test-can-register',
            canRegisterForEventId: event.id,
        })

        // Open to all and without registration: everyone subscribed.
        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([member.id, outsider.id].sort())

        // A quota for the group alone, added after the notification was created, narrows it to the member.
        const variant = await eventVariantOperations.internal.create.internalCall({
            params: { eventId: event.id },
            data: {
                name: 'Påmelding',
                registrationStart: new Date(),
                registrationEnd: new Date(Date.now() + 60 * 60 * 1000),
            },
        })
        const quota = await eventQuotaOperations.internal.create.internalCall({
            params: { variantId: variant.id },
            data: {
                name: 'Gruppa',
                places: 5,
                visibilityRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
            },
        })
        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([member.id])

        // Opening the quota to everyone brings the outsider back.
        await eventQuotaOperations.visibility.update({
            implementationParams: { id: quota.id },
            params: { visibilityId: quota.visibilityId },
            data: { requirements: [] },
            bypassAuth: true,
        })
        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([member.id, outsider.id].sort())
    })

    test('a permission is held through an active membership of a group holding it, or as a default', async () => {
        const channelId = await readRootChannelId()
        const holder = await createTestUser('test-permission-holder')
        const formerHolder = await createTestUser('test-permission-former')
        const outsider = await createTestUser('test-permission-outsider')
        await Promise.all([holder, formerHolder, outsider].map(user =>
            subscribe(user.id, channelId, { email: true, emailWeekly: true })
        ))

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({
            data: { groupType: 'MANUAL_GROUP', order, permissions: { create: [{ permission: 'OMBUL_USE' }] } },
        })
        testGroupIds.push(group.id)
        await prisma.membership.create({
            data: { userId: holder.id, groupId: group.id, admin: false, active: true, order },
        })
        await prisma.membership.create({
            data: { userId: formerHolder.id, groupId: group.id, admin: false, active: false, order: order - 1 },
        })
        await prisma.defaultPermission.deleteMany({ where: { permission: 'OMBUL_USE' } })

        const notification = await createTestNotification({
            channelId,
            title: 'test-permission',
            permission: 'OMBUL_USE',
        })

        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([holder.id])

        await prisma.defaultPermission.create({ data: { permission: 'OMBUL_USE' } })
        expect(await resolveRecipientIds(notification.id, 'email'))
            .toEqual([holder.id, formerHolder.id, outsider.id].sort())
        await prisma.defaultPermission.delete({ where: { permission: 'OMBUL_USE' } })
    })
})

describe('subscriptions resolve through the channels above', () => {
    let childId: number
    let grandchildId: number

    beforeAll(async () => {
        const rootId = await readRootChannelId()
        const child = await manualNotificationChannelOperations.create({
            params: { availableMethods: { email: true, emailWeekly: false, push: true } },
            data: { name: 'test-inherit-child', description: '', parentId: rootId },
            bypassAuth: true,
        })
        const grandchild = await manualNotificationChannelOperations.create({
            params: { availableMethods: allNotificationMethodsOn },
            data: { name: 'test-inherit-grandchild', description: '', parentId: child.id },
            bypassAuth: true,
        })
        childId = child.id
        grandchildId = grandchild.id
    })

    afterAll(async () => {
        await manualNotificationChannelOperations.destroy({ params: { id: grandchildId }, bypassAuth: true })
        await manualNotificationChannelOperations.destroy({ params: { id: childId }, bypassAuth: true })
    })

    test('a subscriber of the root receives in a channel two levels down without a row for it', async () => {
        const rootId = await readRootChannelId()
        const subscriber = await createTestUser('test-inherit-root')
        await createTestUser('test-inherit-nobody')
        await subscribe(subscriber.id, rootId, { email: true })

        const notification = await createTestNotification({ channelId: grandchildId, title: 'test-inherited' })
        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([subscriber.id])
        expect(await prisma.notificationSubscription.count({ where: { channelId: grandchildId } })).toBe(0)
    })

    test('the nearest row decides: off below on, and on below off', async () => {
        const rootId = await readRootChannelId()
        const optedOut = await createTestUser('test-inherit-opted-out')
        const optedIn = await createTestUser('test-inherit-opted-in')
        await subscribe(optedOut.id, rootId, { email: true })
        await subscribe(optedOut.id, childId, { email: false })
        await subscribe(optedIn.id, rootId, { email: false })
        await subscribe(optedIn.id, childId, { email: true })

        const notification = await createTestNotification({ channelId: grandchildId, title: 'test-nearest' })
        expect(await resolveRecipientIds(notification.id, 'email')).toEqual([optedIn.id])
    })

    test('a method the channel does not offer is not inherited, in the resolved read either', async () => {
        const rootId = await readRootChannelId()
        const subscriber = await createTestUser('test-inherit-weekly')
        await subscribe(subscriber.id, rootId, { email: true, emailWeekly: true })

        const notification = await createTestNotification({ channelId: childId, title: 'test-not-offered' })
        expect(await resolveRecipientIds(notification.id, 'emailWeekly')).toEqual([])

        const resolved = await notificationSubscriptionOperations.read({
            params: { userId: subscriber.id },
            bypassAuth: true,
        })
        expect(resolved.find(subscription => subscription.channelId === childId)).toEqual({
            channelId: childId,
            explicit: false,
            methods: { email: true, emailWeekly: false, push: false },
        })
        expect(resolved.find(subscription => subscription.channelId === rootId)?.explicit).toBe(true)
    })
})

describe('weekly outbox materialization', () => {
    test('covers only notifications from before the cutoff and marks them dispatched', async () => {
        const channelId = await readRootChannelId()
        const user = await createTestUser('test-outbox-user')
        await subscribe(user.id, channelId, { email: false, emailWeekly: true })

        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const oldNotification = await createTestNotification({
            channelId,
            title: 'test-outbox-old',
            createdAt: lastWeek,
        })
        const newNotification = await createTestNotification({ channelId, title: 'test-outbox-new' })

        const cutoff = new Date(Date.now() - 60 * 1000)
        const result = await notificationMethodOperations.materializeWeeklyOutbox.internalCall({
            params: { before: cutoff },
        })

        expect(result).toEqual({ notifications: 1, entries: 1 })
        const entries = await prisma.weeklyMailOutboxEntry.findMany()
        expect(entries).toHaveLength(1)
        expect(entries[0].userId).toBe(user.id)
        expect(entries[0].notificationId).toBe(oldNotification.id)

        const marked = await prisma.notification.findUniqueOrThrow({ where: { id: oldNotification.id } })
        expect(marked.emailWeeklyDispatchedAt).not.toBeNull()
        const unmarked = await prisma.notification.findUniqueOrThrow({ where: { id: newNotification.id } })
        expect(unmarked.emailWeeklyDispatchedAt).toBeNull()

        // Materializing again finds nothing new - the marking is what makes it idempotent.
        const secondResult = await notificationMethodOperations.materializeWeeklyOutbox.internalCall({
            params: { before: cutoff },
        })
        expect(secondResult).toEqual({ notifications: 0, entries: 0 })
        expect(await prisma.weeklyMailOutboxEntry.count()).toBe(1)
    })
})

describe('weekly digest text', () => {
    test('contains every notification and replaces special symbols', async () => {
        const channelId = await readRootChannelId()
        const channel = await prisma.notificationChannel.findUniqueOrThrow({ where: { id: channelId } })
        const user = await createTestUser('test-weekly-digest')
        const first = await createTestNotification({ channelId, title: 'test-hello %n' })
        const second = await createTestNotification({ channelId, title: 'test-second' })

        const text = buildWeeklyDigestText(user, [
            { ...first, title: first.title, message: 'Hei %N, her er ukens oppsummering.', channel: { name: channel.name } },
            { ...second, message: 'Nok en varsling til %u.', channel: { name: channel.name } },
        ])

        expect(text).toContain('test-hello Test')
        expect(text).toContain('Hei Test Testesen, her er ukens oppsummering.')
        expect(text).toContain('Nok en varsling til test-weekly-digest.')
        expect(text).toContain(channel.name)
    })
})

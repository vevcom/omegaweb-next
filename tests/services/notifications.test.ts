import { prisma } from '@/prisma-pn-client-instance'
import { notificationMethodOperations } from '@/services/notifications/methods/operations'
import { notificationDispatchIncluder, recipientsWhere } from '@/services/notifications/methods/recipients'
import { buildWeeklyDigestText } from '@/services/notifications/methods/dispatchWeekly'
import { userPrivateSelection } from '@/services/users/constants'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { permissionOperations } from '@/services/permissions/operations'
import { afterEach, describe, expect, test } from '@jest/globals'
import type { NotificationMethods } from '@/services/notifications/types'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

// NOTE: The actual mail sending (dispatchEmail / sendWeeklyMail) is not exercised here since it
// goes through the real mail handler. The recipient resolution and outbox materialization - the
// logic specific to the worker-based dispatch - are covered.

const testGroupIds: number[] = []
const testVisibilityIds: number[] = []

afterEach(async () => {
    await prisma.weeklyMailOutboxEntry.deleteMany()
    await prisma.notification.deleteMany({ where: { title: { startsWith: 'test-' } } })
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

async function subscribe(userId: number, channelId: number, methods: Record<NotificationMethods, boolean>) {
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
        where: recipientsWhere(notification, method, defaultPermissions),
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

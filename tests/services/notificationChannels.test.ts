import { prisma } from '@/prisma-pn-client-instance'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { Smorekopp } from '@/services/error'
import { afterEach, describe, expect, test } from '@jest/globals'

const createdChannelIds: number[] = []

afterEach(async () => {
    await Promise.all(createdChannelIds.map(id => manualNotificationChannelOperations.destroy({
        params: { id },
        bypassAuth: true,
    })))
    createdChannelIds.length = 0
})

async function readRoot() {
    return specialNotificationChannelOperations.channels.ROOT.readChannel({ bypassAuth: true })
}

async function createManualChannel(name: string, parentId: number) {
    const channel = await manualNotificationChannelOperations.create({
        params: { availableMethods: allNotificationMethodsOn },
        data: { name, description: 'A channel made in a test', parentId },
        bypassAuth: true,
    })
    createdChannelIds.push(channel.id)
    return channel
}

describe('the special and the manual notification channels', () => {
    test('a channel carries the purpose of the system that made it, and each system reads its own', async () => {
        const root = await readRoot()
        const manual = await createManualChannel('test-own-channels', root.id)
        expect(root.purpose).toBe('SPECIAL')
        expect(manual.purpose).toBe('MANUAL')

        const specials = await specialNotificationChannelOperations.readMany({ bypassAuth: true })
        expect(specials.every(channel => channel.purpose === 'SPECIAL')).toBe(true)
        expect(specials.map(channel => channel.id)).toContain(root.id)

        const manuals = await manualNotificationChannelOperations.readMany({ bypassAuth: true })
        expect(manuals.every(channel => channel.purpose === 'MANUAL')).toBe(true)
        expect(manuals.map(channel => channel.id)).toContain(manual.id)
        expect(manuals.map(channel => channel.id)).not.toContain(root.id)
    })

    test('a special channel is neither changed, deleted nor sent in through the manual system', async () => {
        const root = await readRoot()
        const disallowed = new Smorekopp('DISSALLOWED')

        await expect(manualNotificationChannelOperations.update({
            params: { id: root.id, availableMethods: allNotificationMethodsOn },
            data: { name: 'Renamed root', description: '', parentId: root.id, mailAliasId: root.mailAliasId },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(manualNotificationChannelOperations.destroy({
            params: { id: root.id },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(manualNotificationChannelOperations.createNotification({
            params: { channelId: root.id },
            data: { title: 'Not sent', message: 'This should never be created.' },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        expect((await readRoot()).name).toBe(root.name)
    })

    test('a manual channel may sit under a special one and be sent in', async () => {
        const root = await readRoot()
        const channel = await createManualChannel('test-under-special', root.id)
        expect(channel.parentId).toBe(root.id)

        await expect(manualNotificationChannelOperations.createNotification({
            params: { channelId: channel.id },
            data: { title: 'Sent in a manual channel', message: 'Nothing is created under IGNORE_SERVER_ONLY.' },
            bypassAuth: true,
        })).resolves.toEqual({ notification: null })
    })

    test('a special channel is created from its config when it is missing', async () => {
        const before = await contactorNotificationChannel.readChannel({ bypassAuth: true })
        await prisma.notificationChannel.delete({ where: { id: before.id } })
        await prisma.notificationMethod.delete({ where: { id: before.availableMethodsId } })

        const recreated = await contactorNotificationChannel.readChannel({ bypassAuth: true })
        expect(recreated.id).not.toBe(before.id)
        expect(recreated).toMatchObject({
            special: 'CONTACTOR',
            purpose: 'SPECIAL',
            name: before.name,
            description: before.description,
            parentId: before.parentId,
            availableMethods: before.availableMethods,
        })
    })
})

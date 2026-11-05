import { prisma } from '@/prisma-pn-client-instance'
import { dynamicNotificationOperations } from '@/services/notifications/dynamic/operations'
import { specialNotificationOperations } from '@/services/notifications/special/operations'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { Smorekopp } from '@/services/error'
import { afterEach, describe, expect, test } from '@jest/globals'

const createdChannelIds: number[] = []

afterEach(async () => {
    await Promise.all(createdChannelIds.map(id => dynamicNotificationOperations.destroyChannel({
        params: { id },
        bypassAuth: true,
    })))
    createdChannelIds.length = 0
})

async function readRoot() {
    return specialNotificationOperations.channels.ROOT.readChannel({ bypassAuth: true })
}

async function createDynamicChannel(name: string, parentId: number) {
    const channel = await dynamicNotificationOperations.createChannel({
        params: { availableMethods: allNotificationMethodsOn },
        data: { name, description: 'A channel made in a test', parentId },
        bypassAuth: true,
    })
    createdChannelIds.push(channel.id)
    return channel
}

describe('the special and the dynamic notification channels', () => {
    test('each system reads its own channels only', async () => {
        const root = await readRoot()
        const dynamic = await createDynamicChannel('test-own-channels', root.id)

        const specials = await specialNotificationOperations.readManyChannels({ bypassAuth: true })
        expect(specials.every(channel => channel.special !== null)).toBe(true)
        expect(specials.map(channel => channel.id)).toContain(root.id)

        const dynamics = await dynamicNotificationOperations.readManyChannels({ bypassAuth: true })
        expect(dynamics.every(channel => channel.special === null)).toBe(true)
        expect(dynamics.map(channel => channel.id)).toContain(dynamic.id)
        expect(dynamics.map(channel => channel.id)).not.toContain(root.id)
    })

    test('a special channel is neither changed, deleted nor sent in through the dynamic system', async () => {
        const root = await readRoot()
        const disallowed = new Smorekopp('DISSALLOWED')

        await expect(dynamicNotificationOperations.updateChannel({
            params: { id: root.id, availableMethods: allNotificationMethodsOn },
            data: { name: 'Renamed root', description: '', parentId: root.id, mailAliasId: root.mailAliasId },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(dynamicNotificationOperations.destroyChannel({
            params: { id: root.id },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(dynamicNotificationOperations.createNotification({
            params: { channelId: root.id },
            data: { title: 'Not sent', message: 'This should never be created.' },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        expect((await readRoot()).name).toBe(root.name)
    })

    test('a dynamic channel may sit under a special one and be sent in', async () => {
        const root = await readRoot()
        const channel = await createDynamicChannel('test-under-special', root.id)
        expect(channel.parentId).toBe(root.id)

        await expect(dynamicNotificationOperations.createNotification({
            params: { channelId: channel.id },
            data: { title: 'Sent in a dynamic channel', message: 'Nothing is created under IGNORE_SERVER_ONLY.' },
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
            name: before.name,
            description: before.description,
            parentId: before.parentId,
            availableMethods: before.availableMethods,
        })
    })
})

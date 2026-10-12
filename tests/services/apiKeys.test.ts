import { Session } from '@/auth/session/Session'
import { ServerSession } from '@/auth/session/ServerSession'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { decodeApiKey, encodeApiKey } from '@/services/apiKeys/apiKeyEncoder'
import { afterEach, describe, expect, test } from '@jest/globals'

afterEach(async () => {
    await prisma.apiKey.deleteMany()
})

describe('api keys', () => {
    test('create, read and update api key with authorized user', async () => {
        const session = Session.fromJsObject({
            memberships: [],
            permissions: ['APIKEY_ADMIN'],
            user: null,
        })

        const createdApiKey = await apiKeyOperations.create({
            data: {
                name: 'Min api nøkkel',
            },
            session,
        })
        expect(createdApiKey).toMatchObject({
            name: 'Min api nøkkel',
            active: true,
            permissions: [],
        })

        const readApiKeyResult = await apiKeyOperations.read({
            params: createdApiKey,
            session,
        })
        expect(readApiKeyResult).toMatchObject({
            name: 'Min api nøkkel',
            active: true,
            permissions: [],
        })

        await apiKeyOperations.update({
            params: createdApiKey,
            data: {
                permissions: ['APIKEY_ADMIN'],
            },
            session,
        })
        const updatedApiKey = await prisma.apiKey.findUnique({
            where: { id: createdApiKey.id },
        })
        expect(updatedApiKey).toMatchObject({
            name: 'Min api nøkkel',
            active: true,
            permissions: ['APIKEY_ADMIN'],
        })
    })

    // TODO: Tests for authorized and unauthenticated users are quite similar,
    // so there should probably be a system in place to run the same test
    // with different session objects.
    test('create, read and update api key with unauthenticated user', async () => {
        const createdApiKeyPromise = apiKeyOperations.create({
            data: {
                name: 'Min api nøkkel',
            },
        })
        expect(createdApiKeyPromise).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect(await prisma.apiKey.count()).toEqual(0)

        const readApiKeyPromise = apiKeyOperations.read({
            params: {
                id: 1,
            },
        })
        expect(readApiKeyPromise).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        const updateApiKeyPromise = apiKeyOperations.update({
            params: {
                id: 1,
            },
            data: {
                permissions: ['APIKEY_ADMIN'],
            },
        })
        expect(updateApiKeyPromise).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})

describe('api key sessions', () => {
    const invalidKey = { errorCode: 'INVALID API KEY', errors: [{ message: 'Api nøkkelen er ikke valid' }] }
    const inactiveKey = { errorCode: 'INVALID API KEY', errors: [{ message: 'Api nøkkelen er utløpt eller deaktivert' }] }

    async function createApiKey() {
        const createdApiKey = await apiKeyOperations.create({
            data: { name: 'Sesjonsnøkkel' },
            bypassAuth: true,
        })
        return { encodedKey: createdApiKey.key, ...decodeApiKey(createdApiKey.key) }
    }

    test('a valid key gives a session with its permissions', async () => {
        const apiKey = await createApiKey()
        await prisma.apiKey.update({ where: { id: apiKey.id }, data: { permissions: ['USERS_USE'] } })

        const session = await ServerSession.fromApiKey(apiKey.encodedKey)

        expect(session.apiKeyId).toBe(apiKey.id)
        expect(session.permissions).toContain('USERS_USE')
    })

    test('an unknown key and a wrong secret give the same error', async () => {
        const apiKey = await createApiKey()

        await expect(ServerSession.fromApiKey(encodeApiKey({ id: apiKey.id + 1000, key: apiKey.key })))
            .rejects.toMatchObject(invalidKey)
        await expect(ServerSession.fromApiKey(encodeApiKey({ id: apiKey.id, key: 'wrong' })))
            .rejects.toMatchObject(invalidKey)
    })

    test('an inactive key only reveals its state to a caller holding the secret', async () => {
        const apiKey = await createApiKey()
        await prisma.apiKey.update({ where: { id: apiKey.id }, data: { active: false } })

        await expect(ServerSession.fromApiKey(encodeApiKey({ id: apiKey.id, key: 'wrong' })))
            .rejects.toMatchObject(invalidKey)
        await expect(ServerSession.fromApiKey(apiKey.encodedKey)).rejects.toMatchObject(inactiveKey)
    })

    test('an expired key only reveals its state to a caller holding the secret', async () => {
        const apiKey = await createApiKey()
        await prisma.apiKey.update({ where: { id: apiKey.id }, data: { expiresAt: new Date(Date.now() - 1000) } })

        await expect(ServerSession.fromApiKey(encodeApiKey({ id: apiKey.id, key: 'wrong' })))
            .rejects.toMatchObject(invalidKey)
        await expect(ServerSession.fromApiKey(apiKey.encodedKey)).rejects.toMatchObject(inactiveKey)
    })
})

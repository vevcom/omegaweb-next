import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { aliasMailAddressOperations, aliasOperations } from '@/services/mail/alias/operations'
import { userOperations } from '@/services/users/operations'
import { defaultVevenMailAddressLocalPart, vevenMailAddressOperations } from '@/services/users/vevenMailAddress'
import { giveMissingVevenMailAddresses } from '@/services/users/missingVevenMailAddresses'
import { userPrivateSelection } from '@/services/users/constants'
import { afterEach, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

const DOMAIN = 'omega.ntnu.no'

const sessionOf = (user: UserFiltered, permissions: Permission[] = []) =>
    Session.fromJsObject({ user, permissions, memberships: [] })

/** A user as one from before users had addresses: written straight to the database, with none. */
async function createUserWithoutAddress(name: string) {
    return prisma.user.create({
        data: {
            username: `test-${name}`,
            email: `test-${name}@private.test`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
}

async function createUser(name: string) {
    const user = await createUserWithoutAddress(name)
    await vevenMailAddressOperations.internal.createDefault.internalCall({ params: { id: user.id } })
    const mailAddress = await vevenMailAddressOperations.read({ params: { userId: user.id }, bypassAuth: true })
    if (!mailAddress) throw new Error('The user was given no address')
    return { user, mailAddress }
}

const createAlias = (localPart: string) => aliasOperations.create({
    data: { localPart, domain: DOMAIN, description: '' },
    bypassAuth: true,
})

const addressOf = async (userId: number) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).vevenMailAddress

afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailAddress.deleteMany({ where: { address: { startsWith: 'test-' } } })
})

describe('the address a user has by default', () => {
    test('is their username on the main domain of Omega\'s site, and a created user has it', async () => {
        const user = await userOperations.create({
            data: {
                email: 'test-invited@private.test',
                firstname: 'Test',
                lastname: 'Testesen',
                username: 'test-invited',
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        expect(await addressOf(user.id)).toBe(`test-invited@${DOMAIN}`)
        const mailAddress = await vevenMailAddressOperations.read({ params: { userId: user.id }, bypassAuth: true })
        expect(mailAddress).toMatchObject({ address: `test-invited@${DOMAIN}`, forwardsToPrivateEmail: true })
    })

    test('gets a number when the username is an alias\'s address or another user\'s', async () => {
        await createAlias('test-taken')
        const first = await createUser('taken')
        expect(first.mailAddress.address).toBe(`test-taken2@${DOMAIN}`)

        // Another user was moved to the address the next one would have had.
        const other = await createUser('other')
        await vevenMailAddressOperations.update({
            implementationParams: { userId: other.user.id },
            params: { mailAddressId: other.mailAddress.id },
            data: { localPart: 'test-wanted', domain: DOMAIN },
            bypassAuth: true,
        })
        const second = await createUser('wanted')
        expect(second.mailAddress.address).toBe(`test-wanted2@${DOMAIN}`)
    })

    test('is left as it is for a user who has one', async () => {
        const { user, mailAddress } = await createUser('settled')
        const again = await vevenMailAddressOperations.internal.createDefault.internalCall({ params: { id: user.id } })
        expect(again).toBe(mailAddress.address)
        expect(await prisma.mailAddress.count({ where: { address: { startsWith: 'test-settled' } } })).toBe(1)
    })

    test('spells a username as an address takes it', () => {
        const localPart = (username: string) => defaultVevenMailAddressLocalPart({ id: 7, username })
        expect(localPart('olanor')).toBe('olanor')
        expect(localPart('Ola.Nordmann')).toBe('ola.nordmann')
        expect(localPart('bjørn_ærlig')).toBe('bjoern_aerlig')
        expect(localPart('rené')).toBe('rene')
        expect(localPart('ola nordmann')).toBe('olanordmann')
        expect(localPart('.ola..nordmann-')).toBe('ola.nordmann')
        expect(localPart('!!!')).toBe('bruker7')
        expect(localPart('a'.repeat(80))).toHaveLength(60)
    })

    test('is given by the mail worker to the users who have none', async () => {
        const without = await createUserWithoutAddress('late')
        const { user: withOne, mailAddress } = await createUser('early')
        expect(await addressOf(without.id)).toBeNull()

        expect(await giveMissingVevenMailAddresses()).toBeGreaterThanOrEqual(1)
        expect(await addressOf(without.id)).toBe(`test-late@${DOMAIN}`)
        expect(await addressOf(withOne.id)).toBe(mailAddress.address)
        expect(await prisma.user.count({ where: { archived: false, vevenMailAddress: null } })).toBe(0)
    })
})

describe('an address is one owner\'s', () => {
    test('an alias cannot take the address of a user, nor a user that of an alias', async () => {
        const { user, mailAddress } = await createUser('mine')
        await expect(createAlias('test-mine')).rejects.toMatchObject({
            errorCode: 'DUPLICATE',
            errors: [expect.objectContaining({ message: expect.stringContaining('i bruk av en bruker') })],
        })

        await createAlias('test-alias')
        await expect(vevenMailAddressOperations.update({
            implementationParams: { userId: user.id },
            params: { mailAddressId: mailAddress.id },
            data: { localPart: 'test-alias', domain: DOMAIN },
            bypassAuth: true,
        })).rejects.toMatchObject({
            errorCode: 'DUPLICATE',
            errors: [expect.objectContaining({ message: expect.stringContaining('i bruk av et alias') })],
        })
        expect(await addressOf(user.id)).toBe(mailAddress.address)
    })

    test('the address of an alias moves with it, and goes when the alias does', async () => {
        const alias = await createAlias('test-before')
        const mailAddress = await aliasMailAddressOperations.read({ params: { id: alias.id }, bypassAuth: true })
        if (!mailAddress) throw new Error('The alias has no address')
        const moveTo = (localPart: string) => aliasMailAddressOperations.update({
            implementationParams: { id: alias.id },
            params: { mailAddressId: mailAddress.id },
            data: { localPart, domain: DOMAIN },
            bypassAuth: true,
        })

        await expect(moveTo('test-after')).resolves.toMatchObject({ id: mailAddress.id, address: `test-after@${DOMAIN}` })
        expect(await prisma.mailAlias.findUniqueOrThrow({ where: { id: alias.id } }))
            .toMatchObject({ address: `test-after@${DOMAIN}` })
        // A move to the address it has is no clash with itself.
        await moveTo('test-after')

        await aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true })
        expect(await prisma.mailAddress.findUnique({ where: { id: mailAddress.id } })).toBeNull()
        // The address is free again.
        await createAlias('test-after')
    })

    test('the address of a user goes when the user is deleted', async () => {
        const { user, mailAddress } = await createUser('leaving')
        await userOperations.destroy({ params: { id: user.id }, bypassAuth: true })
        expect(await prisma.mailAddress.findUnique({ where: { id: mailAddress.id } })).toBeNull()
    })

    test('an address is on one of our domains, and written as an address', async () => {
        const { user, mailAddress } = await createUser('strict')
        const moveTo = (localPart: string, domain: string) => vevenMailAddressOperations.update({
            implementationParams: { userId: user.id },
            params: { mailAddressId: mailAddress.id },
            data: { localPart, domain },
            bypassAuth: true,
        })
        await expect(moveTo('test-strict', 'gmail.com')).rejects.toMatchObject({ errorCode: 'BAD DATA' })
        await expect(moveTo('test strict', DOMAIN)).rejects.toMatchObject({ errorCode: 'BAD DATA' })
        await expect(moveTo('Test-Strict.Moved', DOMAIN)).resolves.toMatchObject({ address: `test-strict.moved@${DOMAIN}` })
        expect(await addressOf(user.id)).toBe(`test-strict.moved@${DOMAIN}`)
    })
})

describe('who changes the address of a user', () => {
    test('the address is changed by a user admin alone, and only as the address of that user', async () => {
        const { user, mailAddress } = await createUser('subject')
        const { user: other, mailAddress: otherAddress } = await createUser('bystander')
        const { update } = vevenMailAddressOperations
        const move = (session: SessionMaybeUser, userId: number, mailAddressId: number) => update({
            implementationParams: { userId },
            params: { mailAddressId },
            data: { localPart: 'test-changed', domain: DOMAIN },
            session,
        })

        await expect(move(sessionOf(user), user.id, mailAddress.id)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        // The address of another user is not this user's to move, whoever asks.
        await expect(move(sessionOf(other, ['USERS_ADMIN']), user.id, otherAddress.id)).rejects.toThrow()
        expect(await addressOf(other.id)).toBe(otherAddress.address)

        await move(sessionOf(other, ['USERS_ADMIN']), user.id, mailAddress.id)
        expect(await addressOf(user.id)).toBe(`test-changed@${DOMAIN}`)
    })

    test('the forwarding is the user\'s own to change, and a user admin\'s', async () => {
        const { user, mailAddress } = await createUser('forwarder')
        const { user: other } = await createUser('onlooker')
        const { updateForwarding } = vevenMailAddressOperations
        const forward = (session: SessionMaybeUser, forwardsToPrivateEmail: boolean) => updateForwarding({
            implementationParams: { userId: user.id },
            params: { mailAddressId: mailAddress.id },
            data: { forwardsToPrivateEmail },
            session,
        })

        await expect(forward(sessionOf(other), false)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(forward(sessionOf(user), false)).resolves.toMatchObject({ forwardsToPrivateEmail: false })
        await expect(forward(sessionOf(other, ['USERS_ADMIN']), true))
            .resolves.toMatchObject({ forwardsToPrivateEmail: true })

        // The address is read by the same two.
        const read = (session: SessionMaybeUser) => vevenMailAddressOperations.read({ params: { userId: user.id }, session })
        await expect(read(sessionOf(other))).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(read(sessionOf(user))).resolves.toMatchObject({ address: mailAddress.address })
    })
})

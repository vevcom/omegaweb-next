import { prisma } from '@/prisma-pn-client-instance'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailOperations } from '@/services/mail/operations'
import { MailServerClient } from '@/services/mail/server/client'
import { syncMailServer } from '@/services/mail/server/sync'
import { afterEach, describe, expect, test } from '@jest/globals'
import type {
    JmapMethodCall,
    JmapMethodResponse,
    MailServerFetch,
    MailServerObjectName,
} from '@/services/mail/server/client'

const TEST_DOMAIN = 'omega.ntnu.no'

type StoredObject = {
    id: string,
    name: string,
    domainId?: string,
    [field: string]: unknown,
}

type SetArgs = {
    create?: Record<string, Record<string, unknown>>,
    update?: Record<string, Record<string, unknown>>,
    destroy?: string[],
}

type SetCall = {
    object: MailServerObjectName,
    args: SetArgs,
}

/**
 * An in-memory stand-in for Stalwart's management API: the query, get and set methods of the
 * objects the sync uses, behind a fetch the client is given. Passwords are kept aside, since the
 * server never returns them.
 */
class FakeMailServer {
    readonly objects: Record<MailServerObjectName, Map<string, StoredObject>> = {
        Domain: new Map(),
        MailingList: new Map(),
        Account: new Map(),
    }
    readonly passwords = new Map<string, string>()
    readonly setCalls: SetCall[] = []
    readonly authorizations: string[] = []
    private nextId = 1

    readonly fetch: MailServerFetch = (url, init) => {
        this.authorizations.push(init.headers.authorization)
        const { methodCalls } = JSON.parse(init.body) as { methodCalls: JmapMethodCall[] }
        const responses: JmapMethodResponse[] = []
        for (const methodCall of methodCalls) {
            responses.push(this.handle(methodCall, responses))
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(JSON.stringify({ methodResponses: responses })),
        })
    }

    client(): MailServerClient {
        return new MailServerClient({ url: 'http://stalwart:8080/', user: 'admin', password: 'secret', fetch: this.fetch })
    }

    /** Stores an object as the server would: with an id, and the address its name and domain give. */
    add(object: MailServerObjectName, value: Record<string, unknown>): StoredObject {
        const id = String(this.nextId)
        this.nextId += 1
        return this.store(object, { ...value, id } as StoredObject)
    }

    domain(name: string): StoredObject | undefined {
        return Array.from(this.objects.Domain.values()).find(domain => domain.name === name)
    }

    mailingList(address: string): StoredObject | undefined {
        return Array.from(this.objects.MailingList.values()).find(list => list.emailAddress === address)
    }

    account(address: string): StoredObject | undefined {
        return Array.from(this.objects.Account.values()).find(account => account.emailAddress === address)
    }

    setCallsFor(object: MailServerObjectName): SetCall[] {
        return this.setCalls.filter(call => call.object === object)
    }

    private store(object: MailServerObjectName, value: StoredObject): StoredObject {
        const stored = { ...value }
        if (object !== 'Domain') {
            const domain = stored.domainId === undefined ? undefined : this.objects.Domain.get(stored.domainId)
            stored.emailAddress = `${stored.name}@${domain?.name}`
        }
        const credentials = stored.credentials as { 0?: { secret?: string } } | undefined
        if (credentials?.[0]?.secret !== undefined) {
            this.passwords.set(stored.id, credentials[0].secret)
            stored.credentials = { 0: { '@type': 'Password', secret: '****' } }
        }
        this.objects[object].set(stored.id, stored)
        return stored
    }

    private handle([method, args, callId]: JmapMethodCall, previous: JmapMethodResponse[]): JmapMethodResponse {
        const match = /^x:(Domain|MailingList|Account)\/(query|get|set)$/.exec(method)
        if (!match) return ['error', { type: 'unknownMethod' }, callId]
        const object = match[1] as MailServerObjectName
        const table = this.objects[object]

        if (match[2] === 'query') {
            return [method, { ids: Array.from(table.keys()) }, callId]
        }
        if (match[2] === 'get') {
            const ids = this.resolveIds(args, previous)
            return [method, {
                list: ids.filter(id => table.has(id)).map(id => table.get(id)),
                notFound: ids.filter(id => !table.has(id)),
            }, callId]
        }
        return [method, this.set(object, args), callId]
    }

    /** The ids a get asks for, given outright or as a back-reference to an earlier query's result. */
    private resolveIds(args: Record<string, unknown>, previous: JmapMethodResponse[]): string[] {
        const { ids } = args
        if (Array.isArray(ids)) return ids.map(String)
        const reference = args['#ids'] as { resultOf: string, name: string, path: string } | undefined
        if (!reference) throw new Error('A get needs ids or #ids')
        const referenced = previous.find(([method, , callId]) => method === reference.name && callId === reference.resultOf)
        if (!referenced || reference.path !== '/ids') {
            throw new Error(`Unresolvable back-reference ${JSON.stringify(reference)}`)
        }
        return referenced[1].ids as string[]
    }

    private set(object: MailServerObjectName, args: SetArgs): Record<string, unknown> {
        this.setCalls.push({ object, args })
        const table = this.objects[object]

        const created: Record<string, { id: string }> = {}
        const notCreated: Record<string, { type: string }> = {}
        for (const [creationId, value] of Object.entries(args.create ?? {})) {
            const refusal = this.refusalOf(object, value)
            if (refusal) {
                notCreated[creationId] = { type: refusal }
                continue
            }
            created[creationId] = { id: this.add(object, value).id }
        }

        const updated: Record<string, null> = {}
        const notUpdated: Record<string, { type: string }> = {}
        for (const [id, changes] of Object.entries(args.update ?? {})) {
            const existing = table.get(id)
            if (!existing) {
                notUpdated[id] = { type: 'notFound' }
                continue
            }
            if (changes.description === '') {
                notUpdated[id] = { type: 'invalidPatch' }
                continue
            }
            this.store(object, { ...existing, ...changes })
            updated[id] = null
        }

        const destroyed: string[] = []
        const notDestroyed: Record<string, { type: string }> = {}
        for (const id of args.destroy ?? []) {
            if (table.delete(id)) destroyed.push(id)
            else notDestroyed[id] = { type: 'notFound' }
        }

        return { created, notCreated, updated, notUpdated, destroyed, notDestroyed }
    }

    /**
     * Why a creation is refused: a name taken on the domain, a domain that does not exist, or an
     * empty description, which Stalwart refuses where null is fine.
     */
    private refusalOf(object: MailServerObjectName, value: Record<string, unknown>): string | null {
        if (value.description === '') return 'invalidPatch'
        if (object !== 'Domain' && !this.objects.Domain.has(String(value.domainId))) return 'invalidForeignKey'
        const taken = Array.from(this.objects[object].values()).some(existing =>
            existing.name === value.name && existing.domainId === value.domainId
        )
        return taken ? 'primaryKeyViolation' : null
    }
}

/** A server that already holds our domain, as the dev and prod servers do before the first sync. */
function serverWithOurDomain(): FakeMailServer {
    const server = new FakeMailServer()
    server.add('Domain', { name: TEST_DOMAIN })
    return server
}

function recipientsOf(list: StoredObject | undefined): string[] {
    return Object.keys(list?.recipients ?? {}).sort()
}

const testGroupIds: number[] = []

async function createTestUser(username: string, email: string) {
    return prisma.user.create({
        data: {
            username,
            email,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
}

async function createTestGroup(members: { userId: number, active: boolean }[]) {
    const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
    const group = await prisma.group.create({ data: { groupType: 'MANUAL_GROUP', order } })
    testGroupIds.push(group.id)
    for (const member of members) {
        await prisma.membership.create({
            data: { userId: member.userId, groupId: group.id, admin: false, active: member.active, order },
        })
    }
    return group
}

/** An alias with one mailing list, which the members are added to. */
async function createTestAlias(localPart: string, description = '') {
    const alias = await aliasOperations.create({
        data: { localPart, domain: TEST_DOMAIN, description },
        bypassAuth: true,
    })
    const list = await mailingListOperations.create({
        data: { name: `${localPart}-list`, description: '' },
        bypassAuth: true,
    })
    await mailOperations.createAliasMailingListRelation({
        data: { mailAliasId: alias.id, mailingListId: list.id },
        bypassAuth: true,
    })
    return { alias, list }
}

afterEach(async () => {
    await prisma.mailingListUser.deleteMany()
    await prisma.mailingListGroup.deleteMany()
    await prisma.mailAliasMailingList.deleteMany()
    await prisma.mailingListMailAddressExternal.deleteMany()
    await prisma.membership.deleteMany({ where: { user: { username: { startsWith: 'test-' } } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.group.deleteMany({ where: { id: { in: testGroupIds } } })
    testGroupIds.length = 0
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-' } } })
    await prisma.mailAddressExternal.deleteMany({ where: { address: { startsWith: 'test-' } } })
})

describe('the mail server client', () => {
    test('authenticates with basic auth and throws on a failed method', async () => {
        const server = serverWithOurDomain()
        const client = server.client()
        await client.listAll('Domain')
        expect(server.authorizations).toEqual([`Basic ${Buffer.from('admin:secret').toString('base64')}`])

        await expect(client.send([['x:Nothing/get', {}, 'c1']])).rejects.toThrow(/x:Nothing\/get.*unknownMethod/)
    })

    test('throws on a refused set and on a server that does not answer 2xx', async () => {
        const server = serverWithOurDomain()
        const client = server.client()
        await expect(client.set('MailingList', { create: { one: { name: 'nowhere', domainId: 'missing' } } }))
            .rejects.toThrow(/refused to create one \(invalidForeignKey\)/)

        const failing = new MailServerClient({
            url: 'http://stalwart:8080',
            user: 'admin',
            password: 'secret',
            fetch: () => Promise.resolve({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: () => Promise.resolve('nope'),
            }),
        })
        await expect(failing.listAll('Domain')).rejects.toThrow(/401 Unauthorized.*x:Domain\/query.*nope/)
    })
})

describe('syncing mailing lists', () => {
    test('a new alias becomes a list reaching its user, the active group members and the external address', async () => {
        const user = await createTestUser('test-sync-user', 'Test-Sync-User@test.test')
        const activeMember = await createTestUser('test-sync-active', 'test-sync-active@test.test')
        const inactiveMember = await createTestUser('test-sync-inactive', 'test-sync-inactive@test.test')
        const group = await createTestGroup([
            { userId: activeMember.id, active: true },
            { userId: inactiveMember.id, active: false },
        ])
        const external = await mailAddressExternalOperations.create({
            data: { address: 'test-sync-external@example.com', description: '' },
            bypassAuth: true,
        })
        const { alias, list } = await createTestAlias('test-sync', 'The sync test')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListGroupRelation({
            data: { groupId: group.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListExternalRelation({
            data: { mailAddressExternalId: external.id, mailingListId: list.id },
            bypassAuth: true,
        })

        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender: null })

        const synced = server.mailingList(alias.address)
        expect(synced).toBeDefined()
        expect(synced?.name).toBe('test-sync')
        expect(synced?.domainId).toBe(server.domain(TEST_DOMAIN)?.id)
        expect(synced?.description).toBe('The sync test')
        expect(recipientsOf(synced)).toEqual([
            'test-sync-active@test.test',
            'test-sync-external@example.com',
            'test-sync-user@test.test',
        ])
    })

    test('an alias with no recipients becomes a list with none', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-empty', domain: TEST_DOMAIN, description: '' },
            bypassAuth: true,
        })
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender: null })
        const synced = server.mailingList(alias.address)
        expect(synced).toBeDefined()
        expect(synced?.recipients).toEqual({})
        // An empty description is sent as null, since the server refuses the empty string.
        expect(synced?.description ?? null).toBeNull()
    })

    test('a second run makes no set calls', async () => {
        await createTestAlias('test-settled', 'Nothing to do')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender: null })
        expect(server.setCalls.length).toBeGreaterThan(0)

        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), sender: null })
        expect(server.setCalls).toEqual([])
    })

    test('a changed membership or description updates the list in place', async () => {
        const member = await createTestUser('test-sync-member', 'test-sync-member@test.test')
        const newcomer = await createTestUser('test-sync-newcomer', 'test-sync-newcomer@test.test')
        const group = await createTestGroup([{ userId: member.id, active: true }])
        const { alias, list } = await createTestAlias('test-changing', 'Before')
        await mailOperations.createMailingListGroupRelation({
            data: { groupId: group.id, mailingListId: list.id },
            bypassAuth: true,
        })

        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender: null })
        const before = server.mailingList(alias.address)
        expect(recipientsOf(before)).toEqual(['test-sync-member@test.test'])

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        await prisma.membership.create({
            data: { userId: newcomer.id, groupId: group.id, admin: false, active: true, order },
        })
        await prisma.membership.updateMany({ where: { userId: member.id, groupId: group.id }, data: { active: false } })
        await aliasOperations.update({
            params: { id: alias.id },
            data: { localPart: 'test-changing', domain: TEST_DOMAIN, description: 'After' },
            bypassAuth: true,
        })

        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), sender: null })
        const after = server.mailingList(alias.address)
        expect(after?.id).toBe(before?.id)
        expect(recipientsOf(after)).toEqual(['test-sync-newcomer@test.test'])
        expect(after?.description).toBe('After')
        expect(server.setCalls).toHaveLength(1)
        expect(Object.keys(server.setCalls[0].args.update ?? {})).toEqual([before?.id])

        // Clearing the description removes it on the server, as null, since it refuses an empty string.
        await aliasOperations.update({
            params: { id: alias.id },
            data: { localPart: 'test-changing', domain: TEST_DOMAIN, description: '' },
            bypassAuth: true,
        })
        await syncMailServer({ client: server.client(), sender: null })
        expect(server.mailingList(alias.address)?.description ?? null).toBeNull()
        expect(server.setCalls[0].args.create).toBeUndefined()
        expect(server.setCalls[0].args.destroy).toBeUndefined()
    })

    test('deleting the alias destroys the list', async () => {
        const { alias } = await createTestAlias('test-doomed')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender: null })
        const synced = server.mailingList(alias.address)
        expect(synced).toBeDefined()

        await aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true })
        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), sender: null })
        expect(server.mailingList(alias.address)).toBeUndefined()
        expect(server.setCalls).toHaveLength(1)
        expect(server.setCalls[0].args.destroy).toEqual([synced?.id])
    })

    test('a list on a domain that is not ours is left alone', async () => {
        const server = serverWithOurDomain()
        const foreignDomain = server.add('Domain', { name: 'other.example' })
        const foreignList = server.add('MailingList', {
            name: 'guests',
            domainId: foreignDomain.id,
            description: 'Not ours',
            recipients: { 'someone@example.com': true },
        })

        await syncMailServer({ client: server.client(), sender: null })
        expect(server.objects.MailingList.get(foreignList.id)).toEqual(foreignList)
        expect(server.objects.Domain.get(foreignDomain.id)).toEqual(foreignDomain)
        const touched = server.setCallsFor('MailingList').flatMap(call => [
            ...Object.keys(call.args.update ?? {}),
            ...(call.args.destroy ?? []),
        ])
        expect(touched).not.toContain(foreignList.id)
        expect(server.setCallsFor('Domain')).toEqual([])
    })
})

describe('syncing domains', () => {
    test('a missing domain is created, and an existing one is not created again', async () => {
        const server = new FakeMailServer()
        await syncMailServer({ client: server.client(), sender: null })
        const domain = server.domain(TEST_DOMAIN)
        expect(domain).toBeDefined()
        expect(server.setCallsFor('Domain')).toHaveLength(1)

        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), sender: null })
        expect(server.domain(TEST_DOMAIN)?.id).toBe(domain?.id)
        expect(server.setCallsFor('Domain')).toEqual([])
    })
})

describe('syncing the sender account', () => {
    const sender = { address: `test-sender@${TEST_DOMAIN}`, password: 'first-password' }

    test('the account is created with the password, and the password is written again on the next run', async () => {
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), sender })
        const created = server.account(sender.address)
        expect(created).toBeDefined()
        expect(created?.['@type']).toBe('User')
        expect(created?.roles).toEqual({ '@type': 'User' })
        expect(server.passwords.get(created?.id ?? '')).toBe('first-password')

        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), sender: { ...sender, password: 'second-password' } })
        expect(server.account(sender.address)?.id).toBe(created?.id)
        expect(server.objects.Account.size).toBe(1)
        expect(server.passwords.get(created?.id ?? '')).toBe('second-password')
        expect(server.setCalls).toHaveLength(1)
        expect(server.setCalls[0].object).toBe('Account')
        expect(Object.keys(server.setCalls[0].args.update ?? {})).toEqual([created?.id])
    })

    test('other accounts are not touched, and a sender on another domain is skipped', async () => {
        const server = serverWithOurDomain()
        const postmaster = server.add('Account', {
            '@type': 'User',
            name: 'postmaster',
            domainId: server.domain(TEST_DOMAIN)?.id,
            credentials: { 0: { '@type': 'Password', secret: 'postmaster-password' } },
        })
        await syncMailServer({ client: server.client(), sender })
        expect(server.passwords.get(postmaster.id)).toBe('postmaster-password')
        expect(server.objects.Account.size).toBe(2)

        server.setCalls.length = 0
        await syncMailServer({
            client: server.client(),
            sender: { address: 'dev@elsewhere.example', password: 'irrelevant' },
        })
        expect(server.setCallsFor('Account')).toEqual([])
        expect(server.objects.Account.size).toBe(2)
    })
})

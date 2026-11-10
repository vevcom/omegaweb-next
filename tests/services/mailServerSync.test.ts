import { prisma } from '@/prisma-pn-client-instance'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { aliasMailAddressOperations, aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailOperations } from '@/services/mail/operations'
import { userOperations } from '@/services/users/operations'
import { vevenMailAddressOperations } from '@/services/users/vevenMailAddress'
import { MailServerClient } from '@/lib/mailServerSync/client'
import { syncMailServer } from '@/lib/mailServerSync/sync'
import { mailboxAddressOf } from '@/lib/mailServerSync/mailboxes'
import { forwardingAddressOf, forwardingDomainOf } from '@/lib/mailServerSync/forwarding'
import { afterEach, describe, expect, test } from '@jest/globals'
import type {
    JmapMethodCall,
    JmapMethodResponse,
    MailServerFetch,
    MailServerObjectName,
} from '@/lib/mailServerSync/client'

const TEST_DOMAIN = 'omega.ntnu.no'
/** The webmail the mailbox tests run with; the other tests pass none, as the env of the tests gives none. */
const webmail = { origin: 'https://mail.omega.ntnu.no', domain: 'mail.omega.ntnu.no' }

/** Stalwart's limits, as its session states them: the calls in a request, and the objects in a get or a set. */
const MAX_CALLS_IN_REQUEST = 16
const MAX_OBJECTS_IN_CALL = 500

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

type StoredScript = {
    id: string,
    name: string,
    isActive: boolean,
    content: string,
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
    /** The Sieve scripts of each account, and the blobs uploaded for them. */
    readonly scripts = new Map<string, StoredScript[]>()
    readonly uploads: string[] = []
    private readonly blobs = new Map<string, string>()
    readonly setCalls: SetCall[] = []
    readonly authorizations: string[] = []
    /** What a test has the server refuse: domains by name, and a script for these accounts. */
    readonly refusedDomains = new Set<string>()
    readonly accountsRefusingScripts = new Set<string>()
    private nextId = 1

    readonly fetch: MailServerFetch = (url, init) => {
        this.authorizations.push(init.headers.authorization)
        if (url.includes('/jmap/upload/')) {
            const blobId = `blob-${this.blobs.size + 1}`
            this.blobs.set(blobId, init.body)
            this.uploads.push(init.body)
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(JSON.stringify({ blobId })),
            })
        }
        const { methodCalls } = JSON.parse(init.body) as { methodCalls: JmapMethodCall[] }
        // Stalwart refuses a request with more calls than its limit, whole.
        if (methodCalls.length > MAX_CALLS_IN_REQUEST) {
            return Promise.resolve({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: () => Promise.resolve(JSON.stringify({ limit: 'maxCallsInRequest' })),
            })
        }
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

    /** The script an account runs, if any. */
    activeScript(accountId: string | undefined): StoredScript | undefined {
        return (this.scripts.get(accountId ?? '') ?? []).find(script => script.isActive)
    }

    /** The Sieve methods of an account, as RFC 9661 has them: one active script, which cannot be destroyed. */
    private handleSieve(method: string, args: Record<string, unknown>, callId: string): JmapMethodResponse {
        const accountId = String(args.accountId)
        const scripts = this.scripts.get(accountId) ?? []
        this.scripts.set(accountId, scripts)
        if (method === 'SieveScript/get') {
            return [method, { list: scripts.map(({ id, name, isActive }) => ({ id, name, isActive })) }, callId]
        }

        const created: Record<string, { id: string }> = {}
        const notCreated: Record<string, { type: string }> = {}
        const creations = (args.create ?? {}) as Record<string, { name: string, blobId: string }>
        for (const [creationId, { name, blobId }] of Object.entries(creations)) {
            if (this.accountsRefusingScripts.has(accountId)) {
                notCreated[creationId] = { type: 'invalidScript' }
                continue
            }
            if (scripts.some(script => script.name === name)) {
                notCreated[creationId] = { type: 'alreadyExists' }
                continue
            }
            const id = `script-${this.nextId}`
            this.nextId += 1
            scripts.push({ id, name, isActive: false, content: this.blobs.get(blobId) ?? '' })
            created[creationId] = { id }
        }
        const activate = args.onSuccessActivateScript as string | undefined
        if (activate !== undefined && Object.keys(notCreated).length === 0) {
            const id = activate.startsWith('#') ? created[activate.slice(1)]?.id : activate
            scripts.forEach(script => { script.isActive = script.id === id })
        }
        if (args.onSuccessDeactivateScript === true) scripts.forEach(script => { script.isActive = false })

        const destroyed: string[] = []
        const notDestroyed: Record<string, { type: string }> = {}
        for (const id of (args.destroy ?? []) as string[]) {
            const index = scripts.findIndex(script => script.id === id)
            if (index === -1) notDestroyed[id] = { type: 'notFound' }
            else if (scripts[index].isActive) notDestroyed[id] = { type: 'scriptIsActive' }
            else destroyed.push(...scripts.splice(index, 1).map(script => script.id))
        }
        return [method, { created, notCreated, destroyed, notDestroyed }, callId]
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
        if (method === 'SieveScript/get' || method === 'SieveScript/set') return this.handleSieve(method, args, callId)
        const match = /^x:(Domain|MailingList|Account)\/(query|get|set)$/.exec(method)
        if (!match) return ['error', { type: 'unknownMethod' }, callId]
        const object = match[1] as MailServerObjectName
        const table = this.objects[object]

        if (match[2] === 'query') {
            return [method, { ids: Array.from(table.keys()) }, callId]
        }
        if (match[2] === 'get') {
            const ids = this.resolveIds(args, previous)
            if (ids.length > MAX_OBJECTS_IN_CALL) return ['error', { type: 'requestTooLarge' }, callId]
            return [method, {
                list: ids.filter(id => table.has(id)).map(id => table.get(id)),
                notFound: ids.filter(id => !table.has(id)),
            }, callId]
        }
        const changed = Object.keys(args.create ?? {}).length + Object.keys(args.update ?? {}).length
            + ((args.destroy as string[] | undefined) ?? []).length
        if (changed > MAX_OBJECTS_IN_CALL) return ['error', { type: 'requestTooLarge' }, callId]
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
            const addresses = object === 'Domain' ? [] : this.addressesOf({ ...existing, ...changes })
            if (addresses.some(address => this.holds(address, id))) {
                notUpdated[id] = { type: 'primaryKeyViolation' }
                continue
            }
            this.store(object, { ...existing, ...changes })
            updated[id] = null
        }

        const destroyed: string[] = []
        const notDestroyed: Record<string, { type: string }> = {}
        for (const id of args.destroy ?? []) {
            // The server keeps a group that an account is a member of.
            const linked = object === 'Account' && Array.from(table.values()).some(account =>
                Object.hasOwn(account.memberGroupIds ?? {}, id)
            )
            if (linked) notDestroyed[id] = { type: 'objectIsLinked' }
            else if (table.delete(id)) destroyed.push(id)
            else notDestroyed[id] = { type: 'notFound' }
        }

        return { created, notCreated, updated, notUpdated, destroyed, notDestroyed }
    }

    /** The addresses an object has: its own, and for an account those of its aliases, as `name@domainId`. */
    private addressesOf(value: Record<string, unknown>): string[] {
        const aliases = Object.values((value.aliases ?? {}) as Record<string, { name: string, domainId: string }>)
        return [value, ...aliases].map(({ name, domainId }) => `${String(name).toLowerCase()}@${String(domainId)}`)
    }

    /** Whether an address is a list's or an account's other than the object `exceptId`: an address is one object's. */
    private holds(address: string, exceptId?: string): boolean {
        return [...Array.from(this.objects.MailingList.values()), ...Array.from(this.objects.Account.values())]
            .some(existing => existing.id !== exceptId && this.addressesOf(existing).includes(address))
    }

    /**
     * Why a creation is refused: an address taken, a domain that does not exist, or an empty
     * description, which Stalwart refuses where null is fine.
     */
    private refusalOf(object: MailServerObjectName, value: Record<string, unknown>): string | null {
        if (value.description === '') return 'invalidPatch'
        if (object === 'Domain') {
            if (this.refusedDomains.has(String(value.name))) return 'invalidProperties'
            const taken = Array.from(this.objects.Domain.values()).some(existing => existing.name === value.name)
            return taken ? 'primaryKeyViolation' : null
        }
        if (!this.objects.Domain.has(String(value.domainId))) return 'invalidForeignKey'
        return this.addressesOf(value).some(address => this.holds(address)) ? 'primaryKeyViolation' : null
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

/** Moves an alias to another address on the test domain. */
async function moveTestAlias(aliasId: number, localPart: string) {
    const mailAddress = await aliasMailAddressOperations.read({ params: { id: aliasId }, bypassAuth: true })
    if (!mailAddress) throw new Error('The alias has no address')
    return aliasMailAddressOperations.update({
        implementationParams: { id: aliasId },
        params: { mailAddressId: mailAddress.id },
        data: { localPart, domain: TEST_DOMAIN },
        bypassAuth: true,
    })
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
    await prisma.mailAddress.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-' } } })
    await prisma.mailAddressExternal.deleteMany({ where: { address: { startsWith: 'test-' } } })
})

describe('the mail server client', () => {
    test('authenticates with basic auth and throws on a failed method', async () => {
        const server = serverWithOurDomain()
        const client = server.client()
        await client.listAll('Domain')
        // Once for the query and once for the get.
        const authorization = `Basic ${Buffer.from('admin:secret').toString('base64')}`
        expect(server.authorizations).toEqual([authorization, authorization])

        await expect(client.send([['x:Nothing/get', {}, 'c1']])).rejects.toThrow(/x:Nothing\/get.*unknownMethod/)
    })

    test('a set returns what the server refused beside what it applied, and nothing is sent for no changes', async () => {
        const server = serverWithOurDomain()
        const client = server.client()
        const outcome = await client.set('MailingList', {
            create: {
                one: { name: 'nowhere', domainId: 'missing' },
                two: { name: 'somewhere', domainId: server.domain(TEST_DOMAIN)?.id ?? '' },
            },
            destroy: ['gone'],
        })
        expect(outcome.refused).toEqual([
            'create MailingList one (invalidForeignKey)',
            'destroy MailingList gone (notFound)',
        ])
        expect(Object.keys(outcome.created)).toEqual(['two'])
        expect(outcome.destroyed).toBe(0)
        expect(server.mailingList(`somewhere@${TEST_DOMAIN}`)).toBeDefined()

        server.setCalls.length = 0
        expect(await client.set('MailingList', { create: {}, destroy: [] }))
            .toEqual({ created: {}, updated: 0, destroyed: 0, refused: [] })
        expect(server.setCalls).toEqual([])
    })

    test('more than the server takes at once is split over several calls and requests', async () => {
        const server = serverWithOurDomain()
        const client = server.client()
        const domainId = server.domain(TEST_DOMAIN)?.id ?? ''
        const names = Array.from({ length: MAX_OBJECTS_IN_CALL + 20 }, (_, index) => `list-${index}`)

        const created = await client.set('MailingList', {
            create: Object.fromEntries(names.map(name => [name, { name, domainId }])),
        })
        expect(created.refused).toEqual([])
        expect(Object.keys(created.created)).toHaveLength(names.length)
        expect(server.setCallsFor('MailingList')).toHaveLength(2)

        const lists = await client.listAll('MailingList')
        expect(lists).toHaveLength(names.length)

        const destroyed = await client.set('MailingList', { destroy: lists.map(list => list.id) })
        expect(destroyed.destroyed).toBe(names.length)
        expect(await client.listAll('MailingList')).toEqual([])

        const accountIds = Array.from({ length: MAX_CALLS_IN_REQUEST + 5 }, (_, index) => `account-${index}`)
        const scripts = await client.sieveScripts(accountIds)
        expect(Array.from(scripts.keys())).toEqual(accountIds)
    })

    test('gives up on a server that takes the request and never answers', async () => {
        const silent = new MailServerClient({
            url: 'http://stalwart:8080',
            user: 'admin',
            password: 'secret',
            timeoutMs: 20,
            // Answers only by failing when the request is given up on, as fetch does.
            fetch: (_, init) => new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error))
            }),
        })
        await expect(silent.listAll('Domain')).rejects.toThrow('Mail server did not answer x:Domain/query within 20 ms')
    })

    test('throws on a server that does not answer 2xx', async () => {
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
        await syncMailServer({ client: server.client() })

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
        await syncMailServer({ client: server.client() })
        const synced = server.mailingList(alias.address)
        expect(synced).toBeDefined()
        expect(synced?.recipients).toEqual({})
        // An empty description is sent as null, since the server refuses the empty string.
        expect(synced?.description ?? null).toBeNull()
    })

    test('a second run makes no set calls', async () => {
        await createTestAlias('test-settled', 'Nothing to do')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client() })
        expect(server.setCalls.length).toBeGreaterThan(0)

        server.setCalls.length = 0
        await syncMailServer({ client: server.client() })
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
        await syncMailServer({ client: server.client() })
        const before = server.mailingList(alias.address)
        expect(recipientsOf(before)).toEqual(['test-sync-member@test.test'])

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        await prisma.membership.create({
            data: { userId: newcomer.id, groupId: group.id, admin: false, active: true, order },
        })
        await prisma.membership.updateMany({ where: { userId: member.id, groupId: group.id }, data: { active: false } })
        await aliasOperations.updateDescription({
            params: { id: alias.id }, data: { description: 'After' }, bypassAuth: true,
        })

        server.setCalls.length = 0
        await syncMailServer({ client: server.client() })
        const after = server.mailingList(alias.address)
        expect(after?.id).toBe(before?.id)
        expect(recipientsOf(after)).toEqual(['test-sync-newcomer@test.test'])
        expect(after?.description).toBe('After')
        expect(server.setCalls).toHaveLength(1)
        expect(Object.keys(server.setCalls[0].args.update ?? {})).toEqual([before?.id])

        // Clearing the description removes it on the server, as null, since it refuses an empty string.
        await aliasOperations.updateDescription({ params: { id: alias.id }, data: { description: '' }, bypassAuth: true })
        server.setCalls.length = 0
        await syncMailServer({ client: server.client() })
        expect(server.mailingList(alias.address)?.description ?? null).toBeNull()
        expect(server.setCalls).toHaveLength(1)
        expect(server.setCalls[0].args.create).toBeUndefined()
        expect(server.setCalls[0].args.destroy).toBeUndefined()
    })

    test('deleting the alias destroys the list', async () => {
        const { alias } = await createTestAlias('test-doomed')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client() })
        const synced = server.mailingList(alias.address)
        expect(synced).toBeDefined()

        await aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true })
        server.setCalls.length = 0
        await syncMailServer({ client: server.client() })
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

        await syncMailServer({ client: server.client() })
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

describe('syncing mailboxes', () => {
    const forwardingOf = (address: string) => forwardingAddressOf(address, webmail.domain)
    const storedMailboxId = async (aliasId: number) =>
        (await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasId } })).mailboxAccountId

    test('the mailbox of an alias is at the alias\'s own address, and its forwarding list carries the domain', () => {
        expect(mailboxAddressOf('styret@omega.ntnu.no')).toBe('styret@omega.ntnu.no')
        expect(mailboxAddressOf('Styret@Contactor.no')).toBe('styret@contactor.no')
        expect(forwardingDomainOf(webmail.domain)).toBe('forward.mail.omega.ntnu.no')
        expect(forwardingOf('Styret@Omega.NTNU.no')).toBe('styret--omega.ntnu.no@forward.mail.omega.ntnu.no')
        expect(forwardingOf('styret@contactor.no')).toBe('styret--contactor.no@forward.mail.omega.ntnu.no')
    })

    test('an alias is a group at its own address, which keeps the mail and forwards a copy to its members', async () => {
        const user = await createTestUser('test-box-user', 'test-box-user@test.test')
        const { alias, list } = await createTestAlias('test-boxed', 'Boxed')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })

        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })

        // The webmail's host is the domain of those who sign in, and the lists are on one under it.
        expect(server.domain(webmail.domain)).toBeDefined()
        expect(server.domain(forwardingDomainOf(webmail.domain))).toBeDefined()

        const group = server.account(alias.address)
        expect(group).toBeDefined()
        expect(group?.['@type']).toBe('Group')
        expect(group?.description).toBe(alias.address)
        expect(group?.credentials).toBeUndefined()
        expect(await storedMailboxId(alias.id)).toBe(group?.id)

        // The address is the mailbox's, so no list holds it: the list is on the forwarding domain.
        expect(server.mailingList(alias.address)).toBeUndefined()
        expect(recipientsOf(server.mailingList(forwardingOf(alias.address)))).toEqual(['test-box-user@test.test'])

        const script = server.activeScript(group?.id)
        expect(script?.name).toMatch(/^omegaweb-forward-[0-9a-f]{16}$/)
        expect(script?.content).toMatch(/^require [^;]*;\nfileinto "INBOX";\n/)
        expect(script?.content).toContain(`redirect "${forwardingOf(alias.address)}";`)
        expect(script?.content).toContain(`Svar som ${alias.address} fra postkassen: ${webmail.origin}`)
        expect(script?.content).toContain(`<a href=\\"${webmail.origin}\\">`)
        expect(script?.content).toContain(`addheader "From" "\\"\${display} via ${alias.address}\\" <${alias.address}>";`)
        expect(script?.content).toContain('set "who" "${name} (${sender})";')
        // The name the copy is from has its Norwegian letters spelled out, matched byte for byte.
        const spelledOut = (letter: string, spelling: string) =>
            `if string :comparator "i;octet" :matches "\${plain}" "*${letter}*" { set "plain" "\${1}${spelling}\${2}"; }`
        expect(script?.content).toContain(spelledOut('ø', 'oe'))
        expect(script?.content).toContain(spelledOut('Å', 'Aa'))
        expect(script?.content).toContain('{ set "display" "${plain}"; }')

        server.setCalls.length = 0
        server.uploads.length = 0
        await syncMailServer({ client: server.client(), webmail })
        expect(server.setCalls).toEqual([])
        expect(server.uploads).toEqual([])
    })

    test('more mailboxes than the server takes calls for in one request all get their script', async () => {
        const count = MAX_CALLS_IN_REQUEST + 4
        const aliases = []
        for (let index = 0; index < count; index++) aliases.push((await createTestAlias(`test-many-${index}`)).alias)

        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        for (const alias of aliases) {
            expect(server.activeScript(server.account(alias.address)?.id)?.content).toBe('keep;\n')
        }
    })

    test('an alias that reaches no one only keeps its mail, and gets a list once it reaches someone', async () => {
        const { alias, list } = await createTestAlias('test-lonely')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })

        const group = server.account(alias.address)
        expect(server.mailingList(forwardingOf(alias.address))).toBeUndefined()
        expect(server.activeScript(group?.id)?.content).toBe('keep;\n')

        const user = await createTestUser('test-joins', 'test-joins@test.test')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await syncMailServer({ client: server.client(), webmail })
        expect(recipientsOf(server.mailingList(forwardingOf(alias.address)))).toEqual(['test-joins@test.test'])
        expect(server.activeScript(group?.id)?.content).toContain(`redirect "${forwardingOf(alias.address)}";`)
        // The script it replaced is gone, so a mailbox holds one script of ours.
        expect(server.scripts.get(group?.id ?? '')).toHaveLength(1)
    })

    test('a script a member made the active one is replaced by ours on the next run, and theirs is kept', async () => {
        const { alias } = await createTestAlias('test-scripted')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const group = server.account(alias.address)
        const scripts = server.scripts.get(group?.id ?? '') ?? []
        scripts.forEach(script => { script.isActive = false })
        scripts.push({ id: 'theirs', name: 'vacation', isActive: true, content: 'discard;' })

        await syncMailServer({ client: server.client(), webmail })
        expect(server.activeScript(group?.id)?.name).toMatch(/^omegaweb-forward-/)
        expect(scripts.map(script => script.name).sort()).toEqual([server.activeScript(group?.id)?.name, 'vacation'].sort())
    })

    test('without a webmail, the alias is a list at its own address, and no mailbox or other domain is made', async () => {
        const { alias } = await createTestAlias('test-unboxed')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client() })
        expect(server.objects.Account.size).toBe(0)
        expect(server.objects.Domain.size).toBe(1)
        expect(server.mailingList(alias.address)).toBeDefined()
    })

    test('renaming the alias moves its group in place, so the mail stays, and its list follows', async () => {
        const user = await createTestUser('test-moves', 'test-moves@test.test')
        const { alias, list } = await createTestAlias('test-before')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const group = server.account(alias.address)

        await moveTestAlias(alias.id, 'test-after')
        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), webmail })
        const renamedAddress = `test-after@${TEST_DOMAIN}`
        expect(server.account(alias.address)).toBeUndefined()
        const renamed = server.account(renamedAddress)
        expect(renamed?.id).toBe(group?.id)
        expect(renamed?.description).toBe(renamedAddress)
        expect(server.setCallsFor('Account')).toHaveLength(1)
        expect(Object.keys(server.setCallsFor('Account')[0].args.update ?? {})).toEqual([group?.id])
        expect(server.mailingList(forwardingOf(alias.address))).toBeUndefined()
        expect(recipientsOf(server.mailingList(forwardingOf(renamedAddress)))).toEqual(['test-moves@test.test'])
        expect(server.activeScript(group?.id)?.content).toContain(`redirect "${forwardingOf(renamedAddress)}";`)
    })

    test('a server from when the mailboxes were on the webmail\'s domain is moved over, keeping each group', async () => {
        const user = await createTestUser('test-migrates', 'test-migrates@test.test')
        const { alias, list } = await createTestAlias('test-migrated')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const server = serverWithOurDomain()
        const accountDomain = server.add('Domain', { name: webmail.domain })
        const formerGroup = server.add('Account', {
            '@type': 'Group', name: 'test-migrated', domainId: accountDomain.id, description: alias.address,
        })
        const formerList = server.add('MailingList', {
            name: 'test-migrated',
            domainId: server.domain(TEST_DOMAIN)?.id,
            recipients: { 'test-migrates@test.test': true, [`test-migrated@${webmail.domain}`]: true },
        })
        await prisma.mailAlias.update({ where: { id: alias.id }, data: { mailboxAccountId: formerGroup.id } })
        const member = server.add('Account', { '@type': 'User', name: 'test-migrates', domainId: accountDomain.id })

        await syncMailServer({ client: server.client(), webmail })

        expect(server.objects.MailingList.get(formerList.id)).toBeUndefined()
        expect(server.account(alias.address)?.id).toBe(formerGroup.id)
        expect(server.account(`test-migrated@${webmail.domain}`)).toBeUndefined()
        expect(recipientsOf(server.mailingList(forwardingOf(alias.address)))).toEqual(['test-migrates@test.test'])
        // The account of someone who signed in is on the webmail's domain too. It is no mailbox, so
        // it stays, as a member of the mailbox its user receives.
        expect(server.objects.Account.get(member.id)).toEqual({ ...member, memberGroupIds: { [formerGroup.id]: true } })
    })

    test('a deleted alias loses its group and its list, and a stray group goes to the alias at its address', async () => {
        const user = await createTestUser('test-doomed-user', 'test-doomed-user@test.test')
        const { alias: doomed, list } = await createTestAlias('test-doomed-box')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const { alias: orphaned } = await createTestAlias('test-orphaned')
        const server = serverWithOurDomain()
        const orphan = server.add('Account', {
            '@type': 'Group',
            name: 'test-orphaned',
            domainId: server.domain(TEST_DOMAIN)?.id,
            description: 'Made by a run that failed',
        })

        await syncMailServer({ client: server.client(), webmail })
        expect(await storedMailboxId(orphaned.id)).toBe(orphan.id)
        expect(server.objects.Account.get(orphan.id)?.description).toBe(orphaned.address)
        expect(server.account(doomed.address)).toBeDefined()
        expect(server.mailingList(forwardingOf(doomed.address))).toBeDefined()

        await aliasOperations.destroy({ params: { id: doomed.id }, bypassAuth: true })
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(doomed.address)).toBeUndefined()
        expect(server.mailingList(forwardingOf(doomed.address))).toBeUndefined()
        expect(server.objects.Account.get(orphan.id)).toBeDefined()
    })
})

describe('syncing memberships', () => {
    /** The account the server makes for someone the first time they sign in to the webmail. */
    const signIn = (server: FakeMailServer, username: string, memberGroupIds: Record<string, true> = {}) =>
        server.add('Account', {
            '@type': 'User', name: username, domainId: server.domain(webmail.domain)?.id, memberGroupIds,
        })
    const mailboxesOf = (server: FakeMailServer, account: StoredObject) =>
        Object.keys(server.objects.Account.get(account.id)?.memberGroupIds ?? {}).sort()

    function serverWithAccounts() {
        const server = serverWithOurDomain()
        server.add('Domain', { name: webmail.domain })
        return server
    }

    test('an account is a member of exactly the mailboxes of the aliases its user receives', async () => {
        const user = await createTestUser('test-member', 'test-member@test.test')
        const { alias: received, list } = await createTestAlias('test-received')
        const { alias: notReceived } = await createTestAlias('test-not-received')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })

        const server = serverWithAccounts()
        // A group that is no mailbox of ours, which a membership of is none of the sync's business.
        const elsewhere = server.add('Domain', { name: 'elsewhere.example' })
        const foreign = server.add('Account', { '@type': 'Group', name: 'team', domainId: elsewhere.id })
        const member = signIn(server, 'test-member', { [foreign.id]: true })
        const stranger = signIn(server, 'test-not-a-user-here')

        await syncMailServer({ client: server.client(), webmail })
        const receivedMailbox = server.account(received.address)
        const otherMailbox = server.account(notReceived.address)
        expect(mailboxesOf(server, member)).toEqual([foreign.id, receivedMailbox?.id].sort())
        // An account signed in to by a name that is no user's is that of a user who is gone.
        expect(server.objects.Account.has(stranger.id)).toBe(false)

        server.setCalls.length = 0
        await syncMailServer({ client: server.client(), webmail })
        expect(server.setCalls).toEqual([])

        // A membership the server holds that the database does not, as a token leaves behind
        // when its user was taken off the alias after it was issued.
        server.objects.Account.get(member.id)!.memberGroupIds = {
            [foreign.id]: true, [receivedMailbox?.id ?? '']: true, [otherMailbox?.id ?? '']: true,
        }
        await mailOperations.destroyMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await syncMailServer({ client: server.client(), webmail })
        expect(mailboxesOf(server, member)).toEqual([foreign.id])
    })

    test('the active members of a group on the alias get its mailbox, and lose it when they leave', async () => {
        const active = await createTestUser('test-active-member', 'test-active-member@test.test')
        const passive = await createTestUser('test-passive-member', 'test-passive-member@test.test')
        const group = await createTestGroup([
            { userId: active.id, active: true },
            { userId: passive.id, active: false },
        ])
        const { alias, list } = await createTestAlias('test-group-box')
        await mailOperations.createMailingListGroupRelation({
            data: { groupId: group.id, mailingListId: list.id },
            bypassAuth: true,
        })

        const server = serverWithAccounts()
        const activeAccount = signIn(server, 'test-active-member')
        const passiveAccount = signIn(server, 'test-passive-member')
        await syncMailServer({ client: server.client(), webmail })
        expect(mailboxesOf(server, activeAccount)).toEqual([server.account(alias.address)?.id])
        expect(mailboxesOf(server, passiveAccount)).toEqual([])

        await prisma.membership.updateMany({ where: { groupId: group.id, userId: active.id }, data: { active: false } })
        await syncMailServer({ client: server.client(), webmail })
        expect(mailboxesOf(server, activeAccount)).toEqual([])
    })

    test('a deleted alias loses its mailbox although a member was signed in to it', async () => {
        const user = await createTestUser('test-linked', 'test-linked@test.test')
        const { alias, list } = await createTestAlias('test-linked-box')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const server = serverWithAccounts()
        const member = signIn(server, 'test-linked')
        await syncMailServer({ client: server.client(), webmail })
        expect(mailboxesOf(server, member)).toEqual([server.account(alias.address)?.id])

        await aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true })
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(alias.address)).toBeUndefined()
        expect(mailboxesOf(server, member)).toEqual([])
    })
})

describe('syncing the mailboxes of users', () => {
    /** A user with the address users are given by default, `<username>@omega.ntnu.no`. */
    async function createAddressedUser(name: string) {
        const user = await createTestUser(`test-${name}`, `test-${name}@private.test`)
        const address = await vevenMailAddressOperations.internal.createDefault.internalCall({ params: { id: user.id } })
        const mailAddress = await prisma.mailAddress.findUniqueOrThrow({ where: { address } })
        return { ...user, address, mailAddressId: mailAddress.id }
    }
    /** The account the server makes for someone the first time they sign in to the webmail. */
    const signIn = (server: FakeMailServer, username: string) => server.add('Account', {
        '@type': 'User', name: username, domainId: server.domain(webmail.domain)?.id,
    })
    const signInNamesOf = (server: FakeMailServer, account: StoredObject | undefined) =>
        Object.values((account?.aliases ?? {}) as Record<string, { name: string, domainId: string }>)
            .filter(alias => alias.domainId === server.domain(webmail.domain)?.id)
            .map(alias => alias.name)
    const scriptsOf = (server: FakeMailServer, account: StoredObject | undefined) =>
        server.scripts.get(account?.id ?? '') ?? []
    const userAccountsOf = (server: FakeMailServer) =>
        Array.from(server.objects.Account.values()).filter(account => account['@type'] === 'User')
    const setForwarding = (user: { id: number, mailAddressId: number }, forwardsToPrivateEmail: boolean) =>
        vevenMailAddressOperations.updateForwarding({
            implementationParams: { userId: user.id },
            params: { mailAddressId: user.mailAddressId },
            data: { forwardsToPrivateEmail },
            bypassAuth: true,
        })

    function serverWithAccounts() {
        const server = serverWithOurDomain()
        server.add('Domain', { name: webmail.domain })
        return server
    }

    test('a user is given their account ahead, at their address, and it sends on to their private email', async () => {
        const user = await createAddressedUser('ahead')
        expect(user.address).toBe(`test-ahead@${TEST_DOMAIN}`)
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })

        const account = server.account(user.address)
        expect(account?.['@type']).toBe('User')
        expect(account?.credentials).toBeUndefined()
        // The name the server signs the user in by, which it builds from their username.
        expect(signInNamesOf(server, account)).toEqual(['test-ahead'])
        // Their private email is where the copy goes, with no list in between.
        expect(server.objects.MailingList.size).toBe(0)
        const script = server.activeScript(account?.id)
        expect(script?.name).toMatch(/^omegaweb-forward-[0-9a-f]{16}$/)
        expect(script?.content).toMatch(/^require [^;]*;\nfileinto "INBOX";\n/)
        expect(script?.content).toContain('redirect "test-ahead@private.test";')
        expect(script?.content).toContain(`Svar som ${user.address} fra postkassen: ${webmail.origin}`)

        server.setCalls.length = 0
        server.uploads.length = 0
        await syncMailServer({ client: server.client(), webmail })
        expect(server.setCalls).toEqual([])
        expect(server.uploads).toEqual([])
    })

    test('the account the server made at a first sign in is moved to the address, and is still signed in to', async () => {
        const user = await createAddressedUser('signed-in')
        const { alias, list } = await createTestAlias('test-of-signed-in')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const server = serverWithAccounts()
        const made = signIn(server, 'test-signed-in')
        await syncMailServer({ client: server.client(), webmail })

        const account = server.account(user.address)
        expect(account?.id).toBe(made.id)
        expect(server.account(`test-signed-in@${webmail.domain}`)).toBeUndefined()
        expect(signInNamesOf(server, account)).toEqual(['test-signed-in'])
        expect(Object.keys(account?.memberGroupIds ?? {})).toEqual([server.account(alias.address)?.id])
        expect(userAccountsOf(server)).toHaveLength(1)
    })

    test('a changed address moves the account in place, so the mail stays', async () => {
        const user = await createAddressedUser('moves')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const before = server.account(user.address)

        await vevenMailAddressOperations.update({
            implementationParams: { userId: user.id },
            params: { mailAddressId: user.mailAddressId },
            data: { localPart: 'test-moved.here', domain: TEST_DOMAIN },
            bypassAuth: true,
        })
        await syncMailServer({ client: server.client(), webmail })
        const after = server.account(`test-moved.here@${TEST_DOMAIN}`)
        expect(after?.id).toBe(before?.id)
        expect(server.account(user.address)).toBeUndefined()
        expect(signInNamesOf(server, after)).toEqual(['test-moves'])
        expect(server.activeScript(after?.id)?.content).toContain(`Svar som test-moved.here@${TEST_DOMAIN} fra postkassen`)
        expect(scriptsOf(server, after)).toHaveLength(1)
    })

    test('a user who turns forwarding off runs no script of ours, and may run their own', async () => {
        const user = await createAddressedUser('quiet')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const account = server.account(user.address)
        expect(server.activeScript(account?.id)?.name).toMatch(/^omegaweb-forward-/)

        await setForwarding(user, false)
        await syncMailServer({ client: server.client(), webmail })
        expect(scriptsOf(server, account)).toEqual([])

        scriptsOf(server, account).push({ id: 'theirs', name: 'vacation', isActive: true, content: 'discard;' })
        server.setCalls.length = 0
        server.uploads.length = 0
        await syncMailServer({ client: server.client(), webmail })
        expect(server.activeScript(account?.id)?.name).toBe('vacation')
        expect(server.uploads).toEqual([])

        await setForwarding(user, true)
        await syncMailServer({ client: server.client(), webmail })
        expect(server.activeScript(account?.id)?.name).toMatch(/^omegaweb-forward-/)
        expect(scriptsOf(server, account).map(script => script.name)).toContain('vacation')
    })

    test('an archived user keeps their account, and nothing is sent on from it', async () => {
        const user = await createAddressedUser('archived')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const account = server.account(user.address)

        await userOperations.archive({ params: { id: user.id }, bypassAuth: true })
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(user.address)?.id).toBe(account?.id)
        expect(scriptsOf(server, account)).toEqual([])
    })

    test('a deleted user loses their account', async () => {
        const user = await createAddressedUser('deleted')
        const kept = await createAddressedUser('kept')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(user.address)).toBeDefined()

        await userOperations.destroy({ params: { id: user.id }, bypassAuth: true })
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(user.address)).toBeUndefined()
        expect(server.account(kept.address)).toBeDefined()
    })

    test('a user whose username changed keeps their account, and signs in to it by the new one', async () => {
        const user = await createAddressedUser('renamed')
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const account = server.account(user.address)

        await prisma.user.update({ where: { id: user.id }, data: { username: 'test-new-name' } })
        await syncMailServer({ client: server.client(), webmail })
        expect(server.account(user.address)?.id).toBe(account?.id)
        expect(signInNamesOf(server, server.account(user.address))).toEqual(['test-new-name'])
        expect(userAccountsOf(server)).toHaveLength(1)
    })

    test('an account that is no user\'s at a user\'s address is left alone, and the other users get theirs', async () => {
        const blocked = await createAddressedUser('squatted')
        const free = await createAddressedUser('unsquatted')
        const server = serverWithOurDomain()
        const squatter = server.add('Account', {
            '@type': 'User', name: 'test-squatted', domainId: server.domain(TEST_DOMAIN)?.id,
        })

        await expect(syncMailServer({ client: server.client(), webmail }))
            .rejects.toThrow(/refused to create Account test-squatted_omega_ntnu_no-\d+ \(primaryKeyViolation\)$/)
        expect(server.account(blocked.address)?.id).toBe(squatter.id)
        expect(signInNamesOf(server, squatter)).toEqual([])
        expect(server.activeScript(squatter.id)).toBeUndefined()
        expect(server.activeScript(server.account(free.address)?.id)?.content)
            .toContain('redirect "test-unsquatted@private.test";')
    })

    test('without a webmail, the address of a user is a list to their private email, whatever its forwarding', async () => {
        const user = await createAddressedUser('listed')
        await setForwarding(user, false)
        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client() })
        expect(server.objects.Account.size).toBe(0)
        expect(recipientsOf(server.mailingList(user.address))).toEqual(['test-listed@private.test'])

        await userOperations.archive({ params: { id: user.id }, bypassAuth: true })
        await syncMailServer({ client: server.client() })
        expect(server.mailingList(user.address)).toBeUndefined()
    })

    test('an alias that does not forward only keeps its mail, although it reaches someone', async () => {
        const user = await createTestUser('test-reached', 'test-reached@test.test')
        const { alias, list } = await createTestAlias('test-not-forwarding')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const mailAddress = await aliasMailAddressOperations.read({ params: { id: alias.id }, bypassAuth: true })
        await aliasMailAddressOperations.updateForwarding({
            implementationParams: { id: alias.id },
            params: { mailAddressId: mailAddress?.id ?? 0 },
            data: { forwardsToPrivateEmail: false },
            bypassAuth: true,
        })

        const server = serverWithOurDomain()
        await syncMailServer({ client: server.client(), webmail })
        const forwardingList = forwardingAddressOf(alias.address, webmail.domain)
        expect(server.mailingList(forwardingList)).toBeUndefined()
        expect(server.activeScript(server.account(alias.address)?.id)?.content).toBe('keep;\n')

        // Without a webmail nothing else would keep the mail, so it is forwarded all the same.
        const unboxed = serverWithOurDomain()
        await syncMailServer({ client: unboxed.client() })
        expect(recipientsOf(unboxed.mailingList(alias.address))).toEqual(['test-reached@test.test'])
    })
})

describe('a change the server refuses', () => {
    const run = (server: FakeMailServer) => syncMailServer({ client: server.client(), webmail })
    const storedMailboxId = async (aliasId: number) =>
        (await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasId } })).mailboxAccountId

    function serverWithAccounts() {
        const server = serverWithOurDomain()
        server.add('Domain', { name: webmail.domain })
        return server
    }

    test('a refused list does not keep the other aliases from theirs, and the run fails naming it', async () => {
        const { alias: blocked } = await createTestAlias('test-blocked')
        const { alias: free } = await createTestAlias('test-free')
        const server = serverWithOurDomain()
        // An account that is not ours at the alias's address, which the server lets no list share.
        server.add('Account', { '@type': 'User', name: 'test-blocked', domainId: server.domain(TEST_DOMAIN)?.id })

        await expect(syncMailServer({ client: server.client() }))
            .rejects.toThrow(/refused to create MailingList test-blocked_omega_ntnu_no-\d+ \(primaryKeyViolation\)$/)
        expect(server.mailingList(blocked.address)).toBeUndefined()
        expect(server.mailingList(free.address)).toBeDefined()
    })

    test('a refused mailbox does not keep the others from their members and their forwarding', async () => {
        const user = await createTestUser('test-kept-going', 'test-kept-going@test.test')
        const { alias: blocked } = await createTestAlias('test-blocked-box')
        const { alias: free, list } = await createTestAlias('test-free-box')
        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })
        const server = serverWithAccounts()
        const squatter = server.add('Account', {
            '@type': 'User', name: 'test-blocked-box', domainId: server.domain(TEST_DOMAIN)?.id,
        })
        const member = server.add('Account', {
            '@type': 'User', name: 'test-kept-going', domainId: server.domain(webmail.domain)?.id,
        })

        await expect(run(server))
            .rejects.toThrow(/refused to create Account test-blocked-box_omega_ntnu_no-\d+ \(primaryKeyViolation\)$/)
        expect(server.account(blocked.address)?.id).toBe(squatter.id)
        expect(await storedMailboxId(blocked.id)).toBeNull()

        const mailbox = server.account(free.address)
        expect(mailbox?.['@type']).toBe('Group')
        expect(await storedMailboxId(free.id)).toBe(mailbox?.id)
        expect(Object.keys(server.objects.Account.get(member.id)?.memberGroupIds ?? {})).toEqual([mailbox?.id])
        expect(server.activeScript(mailbox?.id)?.content)
            .toContain(`redirect "${forwardingAddressOf(free.address, webmail.domain)}";`)
    })

    test('a stale mailbox the server keeps and a script it refuses do not stop the run', async () => {
        const { alias: scriptless } = await createTestAlias('test-no-script')
        const { alias: other } = await createTestAlias('test-other-box')
        const server = serverWithAccounts()
        const domainId = server.domain(TEST_DOMAIN)?.id
        // A group no alias has, with a member whose memberships are not the sync's, so the server keeps it.
        const elsewhere = server.add('Domain', { name: 'elsewhere.example' })
        const stale = server.add('Account', { '@type': 'Group', name: 'test-gone', domainId })
        server.add('Account', {
            '@type': 'User', name: 'outsider', domainId: elsewhere.id, memberGroupIds: { [stale.id]: true },
        })
        const refusing = server.add('Account', { '@type': 'Group', name: 'test-no-script', domainId })
        server.accountsRefusingScripts.add(refusing.id)

        await expect(run(server)).rejects.toThrow([
            `refused to destroy Account ${stale.id} (objectIsLinked); `,
            `create script (invalidScript) as the Sieve script of account ${refusing.id}, `,
            `the mailbox of ${scriptless.address}`,
        ].join(''))
        expect(server.objects.Account.get(stale.id)).toBeDefined()
        expect(server.activeScript(refusing.id)).toBeUndefined()
        expect(server.activeScript(server.account(other.address)?.id)?.content).toBe('keep;\n')
    })

    test('without the domains of the mailboxes the aliases are left as they are', async () => {
        await createTestAlias('test-waits')
        const server = serverWithOurDomain()
        server.refusedDomains.add(forwardingDomainOf(webmail.domain))

        await expect(run(server)).rejects.toThrow(
            /left the aliases as they were.*refused to create Domain forward_mail_omega_ntnu_no-\d+ \(invalidProperties\)$/
        )
        expect(server.domain(webmail.domain)).toBeDefined()
        expect(server.setCallsFor('MailingList')).toEqual([])
        expect(server.setCallsFor('Account')).toEqual([])
    })
})

describe('syncing domains', () => {
    test('a missing domain is created, and an existing one is not created again', async () => {
        const server = new FakeMailServer()
        await syncMailServer({ client: server.client() })
        const domain = server.domain(TEST_DOMAIN)
        expect(domain).toBeDefined()
        expect(server.setCallsFor('Domain')).toHaveLength(1)

        server.setCalls.length = 0
        await syncMailServer({ client: server.client() })
        expect(server.domain(TEST_DOMAIN)?.id).toBe(domain?.id)
        expect(server.setCallsFor('Domain')).toEqual([])
    })
})

describe('accounts that are not mailboxes', () => {
    test('are not touched: the app keeps no account of its own, since it sends without a login', async () => {
        const server = serverWithOurDomain()
        const postmaster = server.add('Account', {
            '@type': 'User',
            name: 'postmaster',
            domainId: server.domain(TEST_DOMAIN)?.id,
            credentials: { 0: { '@type': 'Password', secret: 'postmaster-password' } },
        })
        await syncMailServer({ client: server.client() })
        expect(server.passwords.get(postmaster.id)).toBe('postmaster-password')
        expect(server.objects.Account.size).toBe(1)
        expect(server.setCallsFor('Account')).toEqual([])
    })
})

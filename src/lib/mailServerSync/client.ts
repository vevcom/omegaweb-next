import '@pn-server-only'
import { mailServerAdmin } from './constants'

/** The objects of the management API the sync works with, named as its methods name them. */
export type MailServerObjectName = 'Domain' | 'MailingList' | 'Account'

/** A domain the server receives mail for. */
export type MailServerDomain = {
    id: string,
    name: string,
    description?: string,
}

/**
 * A list the server forwards mail for, named by the local part of its address. Its sets, such as
 * `recipients`, are objects with the member as key and true as value, not arrays.
 */
export type MailServerMailingList = {
    id: string,
    name: string,
    domainId: string,
    /** Null on the wire removes it; the server refuses an empty string. */
    description?: string | null,
    recipients?: Record<string, true>,
    emailAddress?: string,
}

/** A password credential as the server takes it. It is never read back: `get` masks the secret. */
export type MailServerPasswordCredentials = {
    0: { '@type': 'Password', secret: string },
}

export type MailServerAccount = {
    id: string,
    '@type': string,
    name: string,
    domainId: string,
    description?: string,
    emailAddress?: string,
    credentials?: MailServerPasswordCredentials,
    roles?: { '@type': string },
    /** The groups an account is a member of, as a set: the group's id as key and true as value. */
    memberGroupIds?: Record<string, true>,
}

/** A Sieve script of an account. An account runs at most one of its scripts, the active one. */
export type MailServerSieveScript = {
    id: string,
    name: string,
    isActive: boolean,
}

export type MailServerObjects = {
    Domain: MailServerDomain,
    MailingList: MailServerMailingList,
    Account: MailServerAccount,
}

type Creation<ServerObject extends { id: string }> = Omit<ServerObject, 'id'>
type Update<ServerObject extends { id: string }> = Partial<Omit<ServerObject, 'id'>>

/** Creations by an id of the caller's choosing, updates and destructions by the server's ids. */
export type MailServerSetArgs<Name extends MailServerObjectName> = {
    create?: Record<string, Creation<MailServerObjects[Name]>>,
    update?: Record<string, Update<MailServerObjects[Name]>>,
    destroy?: string[],
}

type MailServerSetError = {
    type: string,
    description?: string,
}

/** A set as the server answers it. */
type MailServerSetResponse = {
    created?: Record<string, { id: string }>,
    notCreated?: Record<string, MailServerSetError>,
    notUpdated?: Record<string, MailServerSetError>,
    notDestroyed?: Record<string, MailServerSetError>,
}

/** What a set did. The server applies what it can of a call and refuses the rest one by one. */
export type MailServerSetOutcome = {
    /** The server's ids of what was created, by the ids the creations were sent under. */
    created: Record<string, { id: string }>,
    /** How many of the updates were applied. */
    updated: number,
    /** How many of the destructions were applied. */
    destroyed: number,
    /** What the server refused, one line each, such as `create MailingList styret-0 (primaryKeyViolation)`. */
    refused: string[],
}

/**
 * The server answered and refused what was asked of it, where any other error is a server that
 * does not answer as it should. Thrown where one thing is asked for; a set of many returns its
 * refusals, see {@link MailServerSetOutcome}.
 */
export class MailServerRefusal extends Error {}

/** A JMAP method call: the method, its arguments and the id its response is matched to it by. */
export type JmapMethodCall = [method: string, args: Record<string, unknown>, callId: string]
export type JmapMethodResponse = [method: string, result: Record<string, unknown>, callId: string]

/** What the client needs of fetch, so a test can hand it a fake server instead. */
export type MailServerFetch = (url: string, init: {
    method: 'POST',
    headers: Record<string, string>,
    body: string,
}) => Promise<{
    ok: boolean,
    status: number,
    statusText: string,
    text: () => Promise<string>,
}>

export type MailServerClientOptions = {
    /** The base url of the management API, which /jmap is appended to. */
    url: string,
    user: string,
    password: string,
    fetch?: MailServerFetch,
}

const JMAP_CAPABILITIES = ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap', 'urn:ietf:params:jmap:sieve']

/**
 * A minimal client for Stalwart's management API, which is JMAP (RFC 8620) over HTTP basic auth:
 * a request carries a batch of method calls and the response one result per call. The methods
 * are the standard query, get and set of each object, prefixed `x:`. Querying cannot filter on a
 * name, so finding an object means listing them all and matching here. The Sieve scripts of an
 * account are standard JMAP (RFC 9661), reached as the admin by naming the account.
 */
export class MailServerClient {
    private readonly endpoint: string
    private readonly uploadEndpoint: string
    private readonly authorization: string
    private readonly fetch: MailServerFetch

    constructor({ url, user, password, fetch: fetchImplementation = globalThis.fetch }: MailServerClientOptions) {
        this.endpoint = `${url.replace(/\/+$/, '')}/jmap`
        this.uploadEndpoint = `${this.endpoint}/upload`
        this.authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
        this.fetch = fetchImplementation
    }

    /**
     * Sends a batch of method calls in one request and returns their responses, in the order the
     * server gives them. Throws when the server does not answer 2xx, or answers a call with an error.
     */
    async send(methodCalls: JmapMethodCall[]): Promise<JmapMethodResponse[]> {
        const methods = methodCalls.map(([method]) => method).join(', ')
        const response = await this.fetch(this.endpoint, {
            method: 'POST',
            headers: {
                authorization: this.authorization,
                'content-type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify({ using: JMAP_CAPABILITIES, methodCalls }),
        })
        const text = await response.text()
        if (!response.ok) {
            throw new Error(
                `Mail server answered ${response.status} ${response.statusText} to ${methods}: ${text.slice(0, 500)}`
            )
        }

        const { methodResponses } = JSON.parse(text) as { methodResponses?: JmapMethodResponse[] }
        if (!Array.isArray(methodResponses)) {
            throw new Error(`Mail server gave no method responses to ${methods}`)
        }
        for (const [method, result, callId] of methodResponses) {
            if (method !== 'error') continue
            const failed = methodCalls.find(([, , id]) => id === callId)?.[0] ?? callId
            throw new Error(`Mail server failed ${failed}: ${describeError(result as MailServerSetError)}`)
        }
        return methodResponses
    }

    /** Every object of a kind on the server: a query for all ids, and a get of them by back-reference. */
    async listAll<Name extends MailServerObjectName>(object: Name): Promise<MailServerObjects[Name][]> {
        const queryMethod = `x:${object}/query`
        const getMethod = `x:${object}/get`
        const responses = await this.send([
            [queryMethod, {}, 'query'],
            [getMethod, { '#ids': { resultOf: 'query', name: queryMethod, path: '/ids' } }, 'get'],
        ])
        const getResponse = responses.find(([method, , callId]) => method === getMethod && callId === 'get')
        if (!getResponse) {
            throw new Error(`Mail server gave no ${getMethod} response`)
        }
        const { list } = getResponse[1] as { list?: MailServerObjects[Name][] }
        return list ?? []
    }

    /**
     * Creates, updates and destroys objects of a kind in one call. A refused change does not throw:
     * the server applies the rest, so the outcome names what was refused and the caller goes on.
     * Nothing is sent when there is nothing to change.
     */
    async set<Name extends MailServerObjectName>(
        object: Name,
        { create = {}, update = {}, destroy = [] }: MailServerSetArgs<Name>,
    ): Promise<MailServerSetOutcome> {
        const method = `x:${object}/set`
        const args: Record<string, unknown> = {}
        if (Object.keys(create).length > 0) args.create = create
        if (Object.keys(update).length > 0) args.update = update
        if (destroy.length > 0) args.destroy = destroy
        if (Object.keys(args).length === 0) return { created: {}, updated: 0, destroyed: 0, refused: [] }

        const responses = await this.send([[method, args, 'set']])
        const setResponse = responses.find(([responseMethod, , callId]) => responseMethod === method && callId === 'set')
        if (!setResponse) {
            throw new Error(`Mail server gave no ${method} response`)
        }
        const result = setResponse[1] as MailServerSetResponse
        return {
            created: result.created ?? {},
            updated: Object.keys(update).length - Object.keys(result.notUpdated ?? {}).length,
            destroyed: destroy.length - Object.keys(result.notDestroyed ?? {}).length,
            refused: [
                ...describeRefusals(`create ${object}`, result.notCreated),
                ...describeRefusals(`update ${object}`, result.notUpdated),
                ...describeRefusals(`destroy ${object}`, result.notDestroyed),
            ],
        }
    }

    /** The Sieve scripts of each of the accounts, read in one request. */
    async sieveScripts(accountIds: string[]): Promise<Map<string, MailServerSieveScript[]>> {
        const scripts = new Map<string, MailServerSieveScript[]>()
        if (accountIds.length === 0) return scripts
        const callIdOf = (index: number) => `scripts-${index}`
        const responses = await this.send(
            accountIds.map((accountId, index) => ['SieveScript/get', { accountId }, callIdOf(index)]),
        )
        accountIds.forEach((accountId, index) => {
            const response = responses.find(([, , callId]) => callId === callIdOf(index))
            scripts.set(accountId, (response?.[1].list as MailServerSieveScript[] | undefined) ?? [])
        })
        return scripts
    }

    /**
     * Gives an account a Sieve script with this content and makes it the active one. A script the
     * account already has by that name has to be destroyed first.
     *
     * @throws MailServerRefusal when the server refuses the script.
     */
    async setActiveSieveScript(accountId: string, name: string, content: string): Promise<void> {
        const blobId = await this.upload(accountId, content, 'application/sieve')
        const [[, result]] = await this.send([[
            'SieveScript/set',
            { accountId, create: { script: { name, blobId } }, onSuccessActivateScript: '#script' },
            'activate',
        ]])
        const refused = describeRefusals('create', (result as MailServerSetResponse).notCreated)
        if (refused.length > 0) {
            throw new MailServerRefusal(`${refused.join('; ')} as the Sieve script of account ${accountId}`)
        }
    }

    /**
     * Destroys Sieve scripts of an account.
     *
     * @throws MailServerRefusal when the server refuses one, which it does the active one.
     */
    async destroySieveScripts(accountId: string, ids: string[]): Promise<void> {
        if (ids.length === 0) return
        const [[, result]] = await this.send([['SieveScript/set', { accountId, destroy: ids }, 'destroy']])
        const refused = describeRefusals('destroy', (result as MailServerSetResponse).notDestroyed)
        if (refused.length > 0) {
            throw new MailServerRefusal(`${refused.join('; ')} of the Sieve scripts of account ${accountId}`)
        }
    }

    /** Uploads a blob to an account and returns its id, for a method that takes its content by reference. */
    private async upload(accountId: string, content: string, contentType: string): Promise<string> {
        const response = await this.fetch(`${this.uploadEndpoint}/${encodeURIComponent(accountId)}/`, {
            method: 'POST',
            headers: {
                authorization: this.authorization,
                'content-type': contentType,
                accept: 'application/json',
            },
            body: content,
        })
        const text = await response.text()
        if (!response.ok) {
            throw new Error(
                `Mail server answered ${response.status} ${response.statusText} to an upload: ${text.slice(0, 500)}`
            )
        }
        const { blobId } = JSON.parse(text) as { blobId?: string }
        if (!blobId) throw new Error('Mail server gave no blob id for an upload')
        return blobId
    }
}

function describeError(error: MailServerSetError): string {
    return error.description ? `${error.type}: ${error.description}` : `${error.type}`
}

function describeRefusals(verb: string, refusals: Record<string, MailServerSetError> | undefined): string[] {
    return Object.entries(refusals ?? {}).map(([id, error]) => `${verb} ${id} (${describeError(error)})`)
}

/** The client for the server EMAIL_ADMIN_URL names, as the admin EMAIL_ADMIN_USER. */
export function mailServerClientFromEnv(): MailServerClient {
    const { url, user, password } = mailServerAdmin
    if (!url || !user || !password) {
        throw new Error(
            'The mail server is not managed: EMAIL_ADMIN_URL, EMAIL_ADMIN_USER and EMAIL_ADMIN_PASSWORD must all be set'
        )
    }
    return new MailServerClient({ url, user, password })
}

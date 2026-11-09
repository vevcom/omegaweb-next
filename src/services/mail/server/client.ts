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

export type MailServerSetResult = {
    created?: Record<string, { id: string }>,
    updated?: Record<string, unknown>,
    destroyed?: string[],
    notCreated?: Record<string, MailServerSetError>,
    notUpdated?: Record<string, MailServerSetError>,
    notDestroyed?: Record<string, MailServerSetError>,
}

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

const JMAP_CAPABILITIES = ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap']

/**
 * A minimal client for Stalwart's management API, which is JMAP (RFC 8620) over HTTP basic auth:
 * a request carries a batch of method calls and the response one result per call. The methods
 * are the standard query, get and set of each object, prefixed `x:`. Querying cannot filter on a
 * name, so finding an object means listing them all and matching here.
 */
export class MailServerClient {
    private readonly endpoint: string
    private readonly authorization: string
    private readonly fetch: MailServerFetch

    constructor({ url, user, password, fetch: fetchImplementation = globalThis.fetch }: MailServerClientOptions) {
        this.endpoint = `${url.replace(/\/+$/, '')}/jmap`
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
     * Creates, updates and destroys objects of a kind in one call. Throws when the server refused
     * any of them, which it does after applying the rest.
     */
    async set<Name extends MailServerObjectName>(
        object: Name,
        { create, update, destroy }: MailServerSetArgs<Name>,
    ): Promise<MailServerSetResult> {
        const method = `x:${object}/set`
        const args: Record<string, unknown> = {}
        if (create && Object.keys(create).length > 0) args.create = create
        if (update && Object.keys(update).length > 0) args.update = update
        if (destroy && destroy.length > 0) args.destroy = destroy

        const responses = await this.send([[method, args, 'set']])
        const setResponse = responses.find(([responseMethod, , callId]) => responseMethod === method && callId === 'set')
        if (!setResponse) {
            throw new Error(`Mail server gave no ${method} response`)
        }
        const result = setResponse[1] as MailServerSetResult

        const refused = [
            ...describeRefusals('create', result.notCreated),
            ...describeRefusals('update', result.notUpdated),
            ...describeRefusals('destroy', result.notDestroyed),
        ]
        if (refused.length > 0) {
            throw new Error(`Mail server refused to ${refused.join('; ')}`)
        }
        return result
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

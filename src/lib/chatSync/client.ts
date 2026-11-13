import '@pn-server-only'
import { CHAT_ADMIN_LOCALPART, CHAT_BOT_LOCALPART, CHAT_MAS_CLIENT_ID, ROOM_MODERATOR_LEVEL } from './constants'

export type ChatFetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'json'>>

export type ChatClientConfig = {
    homeserverUrl: string,
    serverName: string,
    asToken: string,
    masUrl: string,
    masClientSecret: string,
    fetch?: ChatFetch,
}

type StateEvent = {
    type: string,
    state_key: string,
    sender: string,
    content: Record<string, unknown>,
}

const eventOf = (state: StateEvent[], type: string) => state.find(event => event.type === type && event.state_key === '')

export type ChatPowerLevels = Record<string, unknown> & { users?: Record<string, number> }

export type ChatRoom = {
    name: string | undefined,
    levels: ChatPowerLevels,
    joinedUserIds: string[],
    listedRoomIds: string[],
}

/** From this version of a room on, its creator outranks every level, so nobody takes the bot's power away. */
const ROOM_VERSION_WITH_CREATOR_POWER = '12'

const membersOfSpaceLetThemselvesIn = (spaceRoomId: string) => ({
    join_rule: 'restricted',
    allow: [{ type: 'm.room_membership', room_id: spaceRoomId }],
})

const LEVEL_NOBODY_IS_GIVEN = 100
const onlyTheBotChangesAnything = {
    invite: LEVEL_NOBODY_IS_GIVEN,
    kick: LEVEL_NOBODY_IS_GIVEN,
    ban: LEVEL_NOBODY_IS_GIVEN,
    state_default: LEVEL_NOBODY_IS_GIVEN,
}

export class ChatServerError extends Error {
    constructor(readonly status: number, readonly errcode: string | undefined, message: string) {
        super(message)
    }
}

const TOKEN_REUSE_MS = 4 * 60 * 1000
const ADMIN_SESSION_LIFETIME_S = 60 * 60

type Token = { value: string, renewAt: number }

export type Homeserver = Pick<ChatClient,
    | 'botUserId' | 'userIdOf' | 'registerBot'
    | 'hasAccount' | 'writeDisplayName' | 'deactivate'
    | 'createSpace' | 'createRoom' | 'readRoom' | 'writeState' | 'listRoom' | 'unlistRoom'
    | 'addMember' | 'removeMember' | 'leave'
>

/** Acts as the application service, as a client of MAS's admin api, and through MAS as an admin of Synapse. */
export class ChatClient {
    private readonly fetch: ChatFetch
    private masToken: Token | null = null
    private synapseAdminToken: Token | null = null

    constructor(private readonly config: ChatClientConfig) {
        this.fetch = config.fetch ?? ((url, init) => fetch(url, init))
    }

    get botUserId(): string {
        return this.userIdOf(CHAT_BOT_LOCALPART)
    }

    userIdOf(localpart: string): string {
        return `@${localpart}:${this.config.serverName}`
    }

    private async request(url: string, token: string, method: string, body?: unknown): Promise<unknown> {
        const response = await this.fetch(url, {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const answer = await response.json().catch(() => ({})) as { errcode?: string, error?: string }
        if (response.status >= 400) {
            const reason = answer.error ?? String(response.status)
            throw new ChatServerError(response.status, answer.errcode, `${method} ${url}: ${reason}`)
        }
        return answer
    }

    private matrix(method: string, path: string, body?: unknown, asUserId?: string): Promise<unknown> {
        const url = new URL(`/_matrix/client/v3${path}`, this.config.homeserverUrl)
        if (asUserId) url.searchParams.set('user_id', asUserId)
        return this.request(url.toString(), this.config.asToken, method, body)
    }

    private async mas(method: string, path: string, body?: unknown): Promise<unknown> {
        const url = new URL(`/api/admin/v1${path}`, this.config.masUrl)
        return this.request(url.toString(), await this.readMasToken(), method, body)
    }

    private async synapseAdmin(method: string, path: string, body?: unknown): Promise<unknown> {
        const url = new URL(`/_synapse/admin${path}`, this.config.homeserverUrl)
        return this.request(url.toString(), await this.readSynapseAdminToken(), method, body)
    }

    private async readMasToken(): Promise<string> {
        if (this.masToken && this.masToken.renewAt > Date.now()) return this.masToken.value
        const response = await this.fetch(new URL('/oauth2/token', this.config.masUrl).toString(), {
            method: 'POST',
            headers: {
                Authorization: `Basic ${btoa(`${CHAT_MAS_CLIENT_ID}:${this.config.masClientSecret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials&scope=urn:mas:admin',
        })
        const answer = await response.json() as { access_token?: string, error?: string }
        if (!answer.access_token) {
            throw new ChatServerError(response.status, undefined, `MAS gave no token: ${answer.error ?? response.status}`)
        }
        this.masToken = { value: answer.access_token, renewAt: Date.now() + TOKEN_REUSE_MS }
        return answer.access_token
    }

    /**
     * Synapse's admin api takes a user's token alone, and not the application service's. So the app
     * keeps a user of its own in MAS and has MAS give that user a token with Synapse's admin scope.
     */
    private async readSynapseAdminToken(): Promise<string> {
        if (this.synapseAdminToken && this.synapseAdminToken.renewAt > Date.now()) return this.synapseAdminToken.value
        const admin = await this.readMasUser(CHAT_ADMIN_LOCALPART) ?? await this.createMasUser(CHAT_ADMIN_LOCALPART)
        const session = await this.mas('POST', '/personal-sessions', {
            actor_user_id: admin.id,
            human_name: 'omegaweb-next',
            scope: 'urn:matrix:client:api:* urn:synapse:admin:*',
            expires_in: ADMIN_SESSION_LIFETIME_S,
        }) as { data: { attributes: { access_token: string } } }
        const value = session.data.attributes.access_token
        this.synapseAdminToken = { value, renewAt: Date.now() + (ADMIN_SESSION_LIFETIME_S * 1000) / 2 }
        return value
    }

    /** Synapse makes the bot's account the first time the application service asks for it. */
    async registerBot(): Promise<void> {
        await this.matrix('POST', '/register', {
            type: 'm.login.application_service',
            username: CHAT_BOT_LOCALPART,
            inhibit_login: true,
        }).catch(ignoring('M_USER_IN_USE'))
    }

    async createSpace(name: string): Promise<string> {
        const created = await this.matrix('POST', '/createRoom', {
            name,
            preset: 'private_chat',
            room_version: ROOM_VERSION_WITH_CREATOR_POWER,
            creation_content: { type: 'm.space' },
            power_level_content_override: { ...onlyTheBotChangesAnything, events: {} },
        }) as { room_id: string }
        return created.room_id
    }

    async createRoom(spaceRoomId: string, name: string): Promise<string> {
        const created = await this.matrix('POST', '/createRoom', {
            name,
            preset: 'private_chat',
            room_version: ROOM_VERSION_WITH_CREATOR_POWER,
            initial_state: [
                { type: 'm.room.join_rules', state_key: '', content: membersOfSpaceLetThemselvesIn(spaceRoomId) },
            ],
            power_level_content_override: {
                ...onlyTheBotChangesAnything,
                redact: ROOM_MODERATOR_LEVEL,
                events: { 'm.room.pinned_events': ROOM_MODERATOR_LEVEL },
            },
        }) as { room_id: string }
        return created.room_id
    }

    /** Null for a room the bot is not in, or that the homeserver does not have. */
    async readRoom(roomId: string): Promise<ChatRoom | null> {
        const state = await this.matrix('GET', `/rooms/${encodeURIComponent(roomId)}/state`)
            .catch(ignoring('M_FORBIDDEN', 'M_NOT_FOUND')) as StateEvent[] | undefined
        const joinedUserIds = (state ?? [])
            .filter(event => event.type === 'm.room.member' && event.content.membership === 'join')
            .map(event => event.state_key)
        // Synapse still shows a room to one who has left it, as it was when they left.
        if (!state || !joinedUserIds.includes(this.botUserId)) return null

        return {
            name: eventOf(state, 'm.room.name')?.content.name as string | undefined,
            levels: eventOf(state, 'm.room.power_levels')?.content ?? {},
            joinedUserIds,
            // An unlisted room leaves its event behind, with nothing in it.
            listedRoomIds: state
                .filter(event => event.type === 'm.space.child' && Array.isArray(event.content.via))
                .map(event => event.state_key),
        }
    }

    async writeState(roomId: string, type: string, content: Record<string, unknown>, stateKey = ''): Promise<void> {
        const keyPath = stateKey === '' ? '' : `/${encodeURIComponent(stateKey)}`
        await this.matrix('PUT', `/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(type)}${keyPath}`, content)
    }

    async listRoom(spaceRoomId: string, roomId: string): Promise<void> {
        await this.writeState(spaceRoomId, 'm.space.child', { via: [this.config.serverName] }, roomId)
    }

    async unlistRoom(spaceRoomId: string, roomId: string): Promise<void> {
        await this.writeState(spaceRoomId, 'm.space.child', {}, roomId)
    }

    async addMember(roomId: string, userId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId })
            .catch(ignoring('M_FORBIDDEN'))
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/join`, {}, userId)
    }

    /** Leaves as the user, which works for every user since the homeserver talks to no other. */
    async removeMember(roomId: string, userId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/leave`, {}, userId)
            .catch(ignoring('M_FORBIDDEN', 'M_NOT_FOUND'))
    }

    async leave(roomId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/leave`, {})
    }

    async hasAccount(userId: string): Promise<boolean> {
        const account = await this.synapseAdmin('GET', `/v2/users/${encodeURIComponent(userId)}`).catch(ignoring(404))
        return account !== undefined
    }

    /** Only for an account that exists, since Synapse makes the account it is asked to change. */
    async writeDisplayName(userId: string, displayName: string): Promise<void> {
        await this.synapseAdmin('PUT', `/v2/users/${encodeURIComponent(userId)}`, { displayname: displayName })
    }

    private async readMasUser(localpart: string): Promise<{ id: string, deactivated: boolean } | null> {
        const found = await this.mas('GET', `/users/by-username/${encodeURIComponent(localpart)}`)
            .catch(ignoring(404)) as { data: { id: string, attributes: { deactivated_at: string | null } } } | undefined
        return found ? { id: found.data.id, deactivated: found.data.attributes.deactivated_at !== null } : null
    }

    private async createMasUser(localpart: string): Promise<{ id: string }> {
        const created = await this.mas('POST', '/users', { username: localpart }) as { data: { id: string } }
        return { id: created.data.id }
    }

    async deactivate(localpart: string): Promise<void> {
        const user = await this.readMasUser(localpart)
        if (!user || user.deactivated) return
        await this.mas('POST', `/users/${user.id}/deactivate`, {})
    }
}

function ignoring(...refusals: (string | number)[]) {
    return (error: unknown): undefined => {
        if (!(error instanceof ChatServerError)) throw error
        if (refusals.includes(error.status) || refusals.includes(error.errcode ?? '')) return undefined
        throw error
    }
}

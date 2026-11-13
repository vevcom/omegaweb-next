import '@pn-server-only'
import { CHAT_ADMIN_LOCALPART, CHAT_BOT_LOCALPART, CHAT_MAS_CLIENT_ID, SPACE_ADMIN_LEVEL } from './constants'

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

/** The content of a room's m.room.power_levels: who holds which level, and what each level may do. */
export type ChatPowerLevels = Record<string, unknown> & { users?: Record<string, number> }

/** A room a space lists, and who listed it there. */
export type ListedRoom = { id: string, listedBy: string }

/** A room as it is on the homeserver. */
export type ChatRoom = {
    levels: ChatPowerLevels,
    /** Those who made the room, where that outranks every level. They are never among the levels. */
    creators: string[],
    members: string[],
}

/** From this version of a room on, its creators outrank every level, and Matrix refuses them one. */
const FIRST_ROOM_VERSION_OF_CREATOR_POWER = 12

/** A request the homeserver or MAS refused. `errcode` is Matrix's own code, when there is one. */
export class ChatServerError extends Error {
    constructor(readonly status: number, readonly errcode: string | undefined, message: string) {
        super(message)
    }
}

/** How long a token for MAS's admin api or Synapse's is used before a new one is asked for. */
const TOKEN_REUSE_MS = 4 * 60 * 1000
const ADMIN_SESSION_LIFETIME_S = 60 * 60

type Token = { value: string, renewAt: number }

/** What the sync asks of the homeserver, which a test answers without one. */
export type Homeserver = Pick<ChatClient,
    | 'botUserId' | 'userIdOf' | 'registerBot'
    | 'hasAccount' | 'writeDisplayName' | 'deactivate'
    | 'createSpace' | 'readSpace' | 'readRoom' | 'readJoinedMembers' | 'writeState'
    | 'addMember' | 'removeMember' | 'takeRoomAdmin' | 'leave'
>

/**
 * The homeserver as the app acts on it, in the three ways chat-infrastructure sets up: as an
 * application service, which acts as its bot or as any user of the homeserver, as a client of MAS's
 * admin api, and through that as an admin of Synapse.
 */
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

    /** A call as the application service: as the bot, or as `asUserId` when it is given. */
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

    /** The app signs in to MAS's admin api as a client, with its secret and no user. */
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

    /**
     * A space only the bot lets anyone into, where SPACE_ADMIN_LEVEL adds and removes rooms and
     * every other change is the bot's.
     */
    async createSpace(name: string): Promise<string> {
        const created = await this.matrix('POST', '/createRoom', {
            name,
            preset: 'private_chat',
            creation_content: { type: 'm.space' },
            power_level_content_override: {
                events: { 'm.space.child': SPACE_ADMIN_LEVEL },
                invite: 100,
                kick: 100,
                ban: 100,
                state_default: 100,
            },
        }) as { room_id: string }
        return created.room_id
    }

    private async readState(roomId: string): Promise<StateEvent[]> {
        return await this.matrix('GET', `/rooms/${encodeURIComponent(roomId)}/state`) as StateEvent[]
    }

    /** A space's name, its levels, and the rooms it lists. */
    async readSpace(roomId: string): Promise<{ name: string | undefined, levels: ChatPowerLevels, rooms: ListedRoom[] }> {
        const state = await this.readState(roomId)
        return {
            name: eventOf(state, 'm.room.name')?.content.name as string | undefined,
            levels: eventOf(state, 'm.room.power_levels')?.content ?? {},
            // A room taken out of a space leaves its event behind, with nothing in it.
            rooms: state
                .filter(event => event.type === 'm.space.child' && Array.isArray(event.content.via))
                .map(event => ({ id: event.state_key, listedBy: event.sender })),
        }
    }

    /**
     * A room, read as an admin of the homeserver, so that it can be read before the bot is in it. A
     * room the homeserver does not have reads as one with nobody in it.
     */
    async readRoom(roomId: string): Promise<ChatRoom> {
        const answer = await this.synapseAdmin('GET', `/v1/rooms/${encodeURIComponent(roomId)}/state`)
            .catch(ignoring(404)) as { state: StateEvent[] } | undefined
        const state = answer?.state ?? []
        return {
            levels: eventOf(state, 'm.room.power_levels')?.content ?? {},
            creators: creatorsOf(state),
            members: state
                .filter(event => event.type === 'm.room.member' && event.content.membership === 'join')
                .map(event => event.state_key),
        }
    }

    async readJoinedMembers(roomId: string): Promise<string[]> {
        const answer = await this.matrix('GET', `/rooms/${encodeURIComponent(roomId)}/joined_members`) as {
            joined: Record<string, unknown>,
        }
        return Object.keys(answer.joined)
    }

    async writeState(roomId: string, type: string, content: Record<string, unknown>): Promise<void> {
        await this.matrix('PUT', `/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(type)}`, content)
    }

    /** Puts a user in a room the bot may invite to, with no invite for them to accept. */
    async addMember(roomId: string, userId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId })
            .catch(ignoring('M_FORBIDDEN'))
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/join`, {}, userId)
    }

    /** Takes a user out of a room by leaving as them. A room they are not in is left alone. */
    async removeMember(roomId: string, userId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/leave`, {}, userId)
            .catch(ignoring('M_FORBIDDEN', 'M_NOT_FOUND'))
    }

    async leave(roomId: string): Promise<void> {
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/leave`, {})
    }

    /** Gives the bot the highest level in a room someone else made, and puts it in the room. */
    async takeRoomAdmin(roomId: string): Promise<void> {
        const room = encodeURIComponent(roomId)
        await this.synapseAdmin('POST', `/v1/rooms/${room}/make_room_admin`, { user_id: this.botUserId })
        await this.matrix('POST', `/rooms/${encodeURIComponent(roomId)}/join`, {})
    }

    async hasAccount(userId: string): Promise<boolean> {
        const account = await this.synapseAdmin('GET', `/v2/users/${encodeURIComponent(userId)}`).catch(ignoring(404))
        return account !== undefined
    }

    /**
     * Sets what a user is called, which they cannot do themselves. Only for an account that exists:
     * Synapse makes the account it is asked to change when there is none.
     */
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

    /** Deactivates an account, which signs it out and takes it out of every room. One that is gone stays gone. */
    async deactivate(localpart: string): Promise<void> {
        const user = await this.readMasUser(localpart)
        if (!user || user.deactivated) return
        await this.mas('POST', `/users/${user.id}/deactivate`, {})
    }
}

function creatorsOf(state: StateEvent[]): string[] {
    const creation = eventOf(state, 'm.room.create')
    const creatorsOutrankLevels = Number(creation?.content.room_version) >= FIRST_ROOM_VERSION_OF_CREATOR_POWER
    if (!creation || !creatorsOutrankLevels) return []
    const additionalCreators = creation.content.additional_creators
    return [creation.sender, ...(Array.isArray(additionalCreators) ? additionalCreators as string[] : [])]
}

/** For `.catch`: lets the refusals named pass, by Matrix's code or by status, and throws any other. */
function ignoring(...refusals: (string | number)[]) {
    return (error: unknown): undefined => {
        if (!(error instanceof ChatServerError)) throw error
        if (refusals.includes(error.status) || refusals.includes(error.errcode ?? '')) return undefined
        throw error
    }
}

import { ChatServerError } from '@/lib/chatSync/client'
import type { ChatPowerLevels, Homeserver, ListedRoom } from '@/lib/chatSync/client'

type Room = {
    name: string | undefined,
    members: string[],
    levels: ChatPowerLevels & { users: Record<string, number> },
    creators: string[],
    listed: ListedRoom[],
}

const SERVER_NAME = 'chat.test'

/**
 * A homeserver that is only its rooms, their members and their levels, for the chat sync to act
 * on. It refuses what Synapse refuses where the sync depends on it: a level for a room's creator,
 * and a change to a room the bot is not in.
 */
export class FakeHomeserver implements Homeserver {
    readonly botUserId = `@omegaweb:${SERVER_NAME}`
    readonly rooms = new Map<string, Room>()
    readonly names = new Map<string, string>()
    readonly deactivated: string[] = []
    /** The calls that changed something, in order, as the sync made them. */
    readonly writes: string[] = []
    /** Rooms the homeserver refuses every change to, for a test of what a refusal does. */
    readonly broken: string[] = []
    /** Accounts the homeserver fails to look up. */
    readonly unanswered: string[] = []
    private accounts: string[] = []
    private created = 0

    userIdOf(localpart: string): string {
        return `@${localpart}:${SERVER_NAME}`
    }

    /** What the chat's sign in does: the account now exists. */
    signIn(localpart: string): string {
        this.accounts.push(this.userIdOf(localpart))
        return this.userIdOf(localpart)
    }

    /** What an admin does in the client: makes a room in a space, which is theirs. */
    makeRoom(spaceRoomId: string, creator: string): string {
        const roomId = this.makeRoomOutsideSpaces(creator)
        this.listRoom(spaceRoomId, roomId, creator)
        return roomId
    }

    /** What anyone does in the client: makes a room, which is theirs. */
    makeRoomOutsideSpaces(creator: string): string {
        const roomId = `!room${++this.created}:${SERVER_NAME}`
        this.rooms.set(roomId, { name: 'Room', members: [creator], levels: { users: {} }, creators: [creator], listed: [] })
        return roomId
    }

    /** What an admin does in the client: adds a room to a space, which Matrix lets them do with any room. */
    listRoom(spaceRoomId: string, roomId: string, listedBy: string): void {
        this.room(spaceRoomId).listed.push({ id: roomId, listedBy })
    }

    unlistRoom(spaceRoomId: string, roomId: string): void {
        const space = this.room(spaceRoomId)
        space.listed = space.listed.filter(room => room.id !== roomId)
    }

    room(roomId: string): Room {
        const room = this.rooms.get(roomId)
        if (!room) throw new ChatServerError(404, 'M_NOT_FOUND', `No room ${roomId}`)
        return room
    }

    private change(roomId: string, what: string): Room {
        if (this.broken.includes(roomId)) throw new ChatServerError(500, 'M_UNKNOWN', `${what} refused`)
        this.writes.push(what)
        return this.room(roomId)
    }

    registerBot = () => Promise.resolve()

    hasAccount(userId: string): Promise<boolean> {
        if (this.unanswered.includes(userId)) return Promise.reject(new ChatServerError(500, 'M_UNKNOWN', 'No answer'))
        return Promise.resolve(this.accounts.includes(userId))
    }

    writeDisplayName(userId: string, displayName: string): Promise<void> {
        // Synapse would make the account. The sync must ask first.
        if (!this.accounts.includes(userId)) throw new Error(`The sync named ${userId}, who has no account`)
        this.writes.push(`name ${userId}`)
        this.names.set(userId, displayName)
        return Promise.resolve()
    }

    deactivate(localpart: string): Promise<void> {
        const userId = this.userIdOf(localpart)
        this.writes.push(`deactivate ${userId}`)
        this.deactivated.push(userId)
        this.accounts = this.accounts.filter(account => account !== userId)
        this.rooms.forEach(room => {
            room.members = room.members.filter(member => member !== userId)
        })
        return Promise.resolve()
    }

    createSpace(name: string): Promise<string> {
        const roomId = `!space${++this.created}:${SERVER_NAME}`
        this.writes.push(`create ${name}`)
        this.rooms.set(roomId, {
            name,
            members: [this.botUserId],
            levels: { users: {} },
            creators: [this.botUserId],
            listed: [],
        })
        return Promise.resolve(roomId)
    }

    readSpace(roomId: string) {
        const { name, levels, listed } = this.room(roomId)
        return Promise.resolve({ name, levels, rooms: [...listed] })
    }

    readRoom(roomId: string) {
        const room = this.rooms.get(roomId)
        if (!room) return Promise.resolve({ levels: {}, creators: [], members: [] })
        return Promise.resolve({ levels: room.levels, creators: room.creators, members: [...room.members] })
    }

    readJoinedMembers = (roomId: string) => Promise.resolve([...this.room(roomId).members])

    writeState(roomId: string, type: string, content: Record<string, unknown>): Promise<void> {
        if (!this.room(roomId).members.includes(this.botUserId)) {
            throw new ChatServerError(403, 'M_FORBIDDEN', `The bot is not in ${roomId}`)
        }
        const room = this.change(roomId, `${type} in ${roomId}`)
        if (type === 'm.room.name') room.name = content.name as string
        if (type === 'm.room.power_levels') {
            const users = content.users as Record<string, number>
            const creator = room.creators.find(userId => userId in users)
            if (creator) {
                throw new ChatServerError(403, 'M_FORBIDDEN', `Creator user ${creator} must not appear in content.users`)
            }
            room.levels = { ...content, users }
        }
        return Promise.resolve()
    }

    addMember(roomId: string, userId: string): Promise<void> {
        if (!this.accounts.includes(userId)) throw new ChatServerError(403, 'M_FORBIDDEN', `No account ${userId}`)
        const room = this.change(roomId, `add ${userId} to ${roomId}`)
        room.members.push(userId)
        return Promise.resolve()
    }

    removeMember(roomId: string, userId: string): Promise<void> {
        const room = this.room(roomId)
        if (!room.members.includes(userId)) return Promise.resolve()
        this.change(roomId, `remove ${userId} from ${roomId}`)
        room.members = room.members.filter(member => member !== userId)
        return Promise.resolve()
    }

    takeRoomAdmin(roomId: string): Promise<void> {
        const room = this.change(roomId, `take admin of ${roomId}`)
        room.members.push(this.botUserId)
        room.levels.users[this.botUserId] = 100
        return Promise.resolve()
    }

    leave(roomId: string): Promise<void> {
        const room = this.change(roomId, `leave ${roomId}`)
        room.members = room.members.filter(member => member !== this.botUserId)
        return Promise.resolve()
    }
}

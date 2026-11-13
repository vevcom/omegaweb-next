import { ChatServerError } from '@/lib/chatSync/client'
import type { ChatPowerLevels, ChatRoom, Homeserver, NewRoom } from '@/lib/chatSync/client'

type Room = {
    name: string | undefined,
    members: string[],
    invited: string[],
    levels: ChatPowerLevels & { users: Record<string, number> },
    listedRoomIds: string[],
    /** Null for a space. */
    spaceRoomId: string | null,
    isPrivate: boolean,
}

const SERVER_NAME = 'chat.test'

/** Refuses what Synapse refuses where the sync depends on it. */
export class FakeHomeserver implements Homeserver {
    readonly botUserId = `@omegaweb:${SERVER_NAME}`
    readonly rooms = new Map<string, Room>()
    readonly names = new Map<string, string>()
    readonly deactivated: string[] = []
    readonly writes: string[] = []
    readonly roomsRefusingEveryChange: string[] = []
    /** Named as in `writes`. */
    readonly changesRefusedOnce: string[] = []
    readonly accountsFailingLookup: string[] = []
    private accounts: string[] = []
    private created = 0

    userIdOf(localpart: string): string {
        return `@${localpart}:${SERVER_NAME}`
    }

    signIn(localpart: string): string {
        this.accounts.push(this.userIdOf(localpart))
        return this.userIdOf(localpart)
    }

    /**
     * What a user does in the client. An invitation gets them in. Without one only a member of the
     * space gets in, and nobody into a private room.
     */
    join(roomId: string, userId: string): void {
        const room = this.room(roomId)
        const isInvited = room.invited.includes(userId)
        const isMemberOfSpace = room.spaceRoomId !== null && this.room(room.spaceRoomId).members.includes(userId)
        if (!isInvited && (room.isPrivate || !isMemberOfSpace)) {
            throw new ChatServerError(403, 'M_FORBIDDEN', `${userId} may not let themselves into ${roomId}`)
        }
        room.invited = room.invited.filter(invited => invited !== userId)
        room.members.push(userId)
    }

    room(roomId: string): Room {
        const room = this.rooms.get(roomId)
        if (!room) throw new ChatServerError(404, 'M_NOT_FOUND', `No room ${roomId}`)
        return room
    }

    private change(roomId: string, what: string): Room {
        const refusedOnce = this.changesRefusedOnce.indexOf(what)
        if (refusedOnce !== -1) this.changesRefusedOnce.splice(refusedOnce, 1)
        if (refusedOnce !== -1 || this.roomsRefusingEveryChange.includes(roomId)) {
            throw new ChatServerError(500, 'M_UNKNOWN', `${what} refused`)
        }
        this.writes.push(what)
        return this.room(roomId)
    }

    private changeAsBot(roomId: string, what: string): Room {
        if (!this.room(roomId).members.includes(this.botUserId)) {
            throw new ChatServerError(403, 'M_FORBIDDEN', `The bot is not in ${roomId}`)
        }
        return this.change(roomId, what)
    }

    registerBot = () => Promise.resolve()

    hasAccount(userId: string): Promise<boolean> {
        if (this.accountsFailingLookup.includes(userId)) {
            return Promise.reject(new ChatServerError(500, 'M_UNKNOWN', 'No answer'))
        }
        return Promise.resolve(this.accounts.includes(userId))
    }

    writeDisplayName(userId: string, displayName: string): Promise<void> {
        // Synapse would make the account, so the sync must ask first.
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
            room.invited = room.invited.filter(invited => invited !== userId)
        })
        return Promise.resolve()
    }

    createSpace(name: string): Promise<string> {
        return Promise.resolve(this.create(`!space${++this.created}:${SERVER_NAME}`, name, null, false))
    }

    createRoom({ name, spaceRoomId, isPrivate }: NewRoom): Promise<string> {
        if (this.roomsRefusingEveryChange.includes(spaceRoomId)) {
            throw new ChatServerError(500, 'M_UNKNOWN', `create ${name} refused`)
        }
        return Promise.resolve(this.create(`!room${++this.created}:${SERVER_NAME}`, name, spaceRoomId, isPrivate))
    }

    private create(roomId: string, name: string, spaceRoomId: string | null, isPrivate: boolean): string {
        this.writes.push(`create ${name}`)
        const levels = { users: {} }
        const members = [this.botUserId]
        this.rooms.set(roomId, { name, members, invited: [], levels, listedRoomIds: [], spaceRoomId, isPrivate })
        return roomId
    }

    readRoom(roomId: string): Promise<ChatRoom | null> {
        const room = this.rooms.get(roomId)
        if (!room?.members.includes(this.botUserId)) return Promise.resolve(null)
        return Promise.resolve({
            name: room.name,
            levels: room.levels,
            joinedUserIds: [...room.members],
            invitedUserIds: [...room.invited],
            listedRoomIds: [...room.listedRoomIds],
        })
    }

    writeState(roomId: string, type: string, content: Record<string, unknown>): Promise<void> {
        const room = this.changeAsBot(roomId, `${type} in ${roomId}`)
        if (type === 'm.room.name') room.name = content.name as string
        if (type === 'm.room.power_levels') {
            const users = content.users as Record<string, number>
            if (this.botUserId in users) {
                throw new ChatServerError(403, 'M_FORBIDDEN', 'The creator of a room must not appear in content.users')
            }
            room.levels = { ...content, users }
        }
        return Promise.resolve()
    }

    closeRoom(roomId: string): Promise<void> {
        this.changeAsBot(roomId, `close ${roomId}`).isPrivate = true
        return Promise.resolve()
    }

    listRoom(spaceRoomId: string, roomId: string): Promise<void> {
        this.changeAsBot(spaceRoomId, `list ${roomId}`).listedRoomIds.push(roomId)
        return Promise.resolve()
    }

    unlistRoom(spaceRoomId: string, roomId: string): Promise<void> {
        const space = this.changeAsBot(spaceRoomId, `unlist ${roomId}`)
        space.listedRoomIds = space.listedRoomIds.filter(listedRoomId => listedRoomId !== roomId)
        return Promise.resolve()
    }

    /** An add refused once is a join that failed after its invitation was sent, which leaves the invitation. */
    addMember(roomId: string, userId: string): Promise<void> {
        if (!this.accounts.includes(userId)) throw new ChatServerError(403, 'M_FORBIDDEN', `No account ${userId}`)
        const add = `add ${userId} to ${roomId}`
        const invitedBeforeTheJoinFails = this.room(roomId).invited
        if (this.changesRefusedOnce.includes(add) && !invitedBeforeTheJoinFails.includes(userId)) {
            invitedBeforeTheJoinFails.push(userId)
        }

        const room = this.changeAsBot(roomId, add)
        room.invited = room.invited.filter(invited => invited !== userId)
        room.members.push(userId)
        return Promise.resolve()
    }

    removeMember(roomId: string, userId: string): Promise<void> {
        const room = this.room(roomId)
        if (!room.members.includes(userId) && !room.invited.includes(userId)) return Promise.resolve()
        this.change(roomId, `remove ${userId} from ${roomId}`)
        room.members = room.members.filter(member => member !== userId)
        room.invited = room.invited.filter(invited => invited !== userId)
        return Promise.resolve()
    }

    leave(roomId: string): Promise<void> {
        const room = this.change(roomId, `leave ${roomId}`)
        room.members = room.members.filter(member => member !== this.botUserId)
        return Promise.resolve()
    }
}

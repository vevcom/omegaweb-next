import { directRoomWith, joinedRoom } from './rooms'
import { loadedChatSdk } from './sdk'
import type { MatrixClient, Room } from 'matrix-js-sdk'

// The direct messages that are being made, by whom they are with, and the last note of one in the user's account.
const making = new WeakMap<MatrixClient, Map<string, Promise<Room>>>()
const marking = new WeakMap<MatrixClient, Promise<void>>()

/** How many the homeserver lets a user ask into a room in one go, which is its limit when a room is made. */
export const MAX_INVITED_AT_ONCE = 10

/** How long the sync is waited for to bring what the homeserver was asked. */
export const SYNC_WAIT_MS = 30_000
const STOPPED_CHECK_MS = 1_000

/**
 * Why the homeserver did not do what it was asked: it was not reached, it takes no more of the
 * kind from the user for now, or it refused.
 */
export type ChatRefusal = 'UNREACHABLE' | 'LIMITED' | 'REFUSED'

export function refusalOf(error: unknown): ChatRefusal {
    const { MatrixError } = loadedChatSdk()
    if (!(error instanceof MatrixError)) return 'UNREACHABLE'
    return error.isRateLimitError() ? 'LIMITED' : 'REFUSED'
}

/**
 * Writes `text` to another user in the direct message the two have, which is made first when they
 * have none: a room of the two that asks the other in. So a direct message is made by its first
 * message, and nobody is asked into a room nothing is written in. One that is being made is the
 * one a second message meanwhile is written in, so two messages make one room. A message that is
 * not sent says so in the room, as any other.
 */
export async function startDirectMessage(client: MatrixClient, userId: string, text: string): Promise<Room> {
    const ofClient = making.get(client) ?? new Map<string, Promise<Room>>()
    making.set(client, ofClient)
    const made = directRoomWith(client, userId) ?? await (
        ofClient.get(userId) ?? remember(ofClient, userId, makeDirectRoom(client, userId))
    )
    void client.sendTextMessage(made.roomId, text.trim()).catch(() => undefined)
    return made
}

/** Makes a group: a room with a name that asks the others in. Resolves once the client has it. */
export async function startGroup(client: MatrixClient, name: string, userIds: readonly string[]): Promise<Room> {
    const { Preset } = loadedChatSdk()
    const { room_id: roomId } = await client.createRoom({ preset: Preset.PrivateChat, name, invite: [...userIds] })
    return untilSync(client, () => joinedRoom(client, roomId), Infinity)
}

/**
 * Joins a room: one the user is asked into, which is how an invitation is accepted, or one the
 * homeserver lets the user into, as an open room of a space the user is in. Resolves once the
 * client has it.
 */
export async function joinRoom(client: MatrixClient, roomId: string): Promise<Room> {
    const directWith = client.getRoom(roomId)?.getDMInviter()
    await client.joinRoom(roomId)
    const joined = await untilSync(client, () => joinedRoom(client, roomId))
    if (directWith) void markDirect(client, directWith, roomId)
    return joined
}

/** Leaves a room, or declines the invitation to it. Resolves once the client knows the user is out of it. */
export async function leaveRoom(client: MatrixClient, roomId: string): Promise<void> {
    await client.leave(roomId)
    await untilSync(client, () => !['join', 'invite'].includes(client.getRoom(roomId)?.getMyMembership() ?? ''))
}

/**
 * Asks users into a room, one after another, since the homeserver takes one at a time. One it
 * refuses, such as one who is in the room already, does not keep the rest out. It stops when the
 * homeserver takes no more for now or is not reached, and says so as `stoppedBy`: the one it
 * stopped at and those after are then in neither list.
 */
export async function inviteToRoom(client: MatrixClient, roomId: string, userIds: readonly string[]): Promise<{
    invited: string[],
    refused: string[],
    stoppedBy: Exclude<ChatRefusal, 'REFUSED'> | null,
}> {
    const invited: string[] = []
    const refused: string[] = []
    for (const userId of userIds) {
        const refusal = await client.invite(roomId, userId).then(() => null, refusalOf)
        if (refusal === null) invited.push(userId)
        else if (refusal === 'REFUSED') refused.push(userId)
        else return { invited, refused, stoppedBy: refusal }
    }
    return { invited, refused, stoppedBy: null }
}

function remember(ofClient: Map<string, Promise<Room>>, userId: string, room: Promise<Room>): Promise<Room> {
    ofClient.set(userId, room)
    void room.catch(() => undefined).finally(() => ofClient.delete(userId))
    return room
}

/**
 * Resolves once the client knows the room as the direct message with the user. The sync may tell
 * of the room before it tells of the one asked in, and may count them without saying who it is,
 * so the members are asked for then. One who has declined already is never counted, so the room
 * is the user's then too, and is no direct message.
 */
async function makeDirectRoom(client: MatrixClient, userId: string): Promise<Room> {
    const { Preset } = loadedChatSdk()
    const { room_id: roomId } = await client.createRoom({
        preset: Preset.TrustedPrivateChat,
        is_direct: true,
        invite: [userId],
    })
    void markDirect(client, userId, roomId)
    const made = await untilSync(client, () => {
        const room = joinedRoom(client, roomId)
        const hasDeclined = room?.getMember(userId)?.membership === 'leave'
        return room?.getInvitedAndJoinedMemberCount() === 2 || hasDeclined ? room : null
    }, Infinity)
    // A room whose members were not given is asked of again by whoever watches for it, see watchWithInvited.
    if (!made.getMember(userId)) await made.loadMembersIfNeeded().catch(() => undefined)
    return made
}

/**
 * Notes in the user's account that a room is the direct message with another, which is what other
 * clients such as Element know one by. The account holds one list for all of them, so the notes
 * are written one after another, each on what the one before it left. Nothing here reads it, so
 * one that is not written is let go.
 */
function markDirect(client: MatrixClient, userId: string, roomId: string): Promise<void> {
    const { EventType } = loadedChatSdk()
    const marked = (marking.get(client) ?? Promise.resolve()).then(async () => {
        const noted = client.getAccountData(EventType.Direct)?.getContent() ?? {}
        const rooms: unknown = noted[userId]
        const roomIds = Array.isArray(rooms) ? rooms.filter(room => typeof room === 'string') : []
        if (roomIds.includes(roomId)) return
        await client.setAccountData(EventType.Direct, { ...noted, [userId]: [...roomIds, roomId] })
    }).catch(() => undefined)
    marking.set(client, marked)
    return marked
}

/**
 * What `find` gives once it gives something, asked now and after every sync: what was asked of the
 * homeserver is known to the client when the sync brings it, and not when the homeserver answers.
 * It rejects when the client is found stopped, which is looked for at every sync and between them,
 * since a client that is stopped while it waits out a lost connection tells nobody. It also rejects
 * after `waitMs`, where a sync may never bring what is waited for. A room that was made is waited
 * for as long as the client runs: the homeserver has it, so giving up would lose what was to be
 * written in it and let the user make it a second time.
 */
function untilSync<Found>(
    client: MatrixClient,
    find: () => Found | null | undefined | false,
    waitMs: number = SYNC_WAIT_MS,
): Promise<Found> {
    const { ClientEvent } = loadedChatSdk()
    const since = Date.now()
    let look = () => undefined as void
    let looking: ReturnType<typeof setInterval> | undefined
    return new Promise<Found>((resolve, reject) => {
        look = () => {
            const found = find()
            if (found) resolve(found)
            else if (!client.clientRunning) reject(new Error('The chat client is stopped'))
            else if (Date.now() - since >= waitMs) reject(new Error('The sync did not bring what was asked for'))
        }
        looking = setInterval(look, STOPPED_CHECK_MS)
        // eslint-disable-next-line no-sync -- The event of the client's sync, and no synchronous call.
        client.on(ClientEvent.Sync, look)
        look()
    }).finally(() => {
        clearInterval(looking)
        // eslint-disable-next-line no-sync -- As above.
        client.off(ClientEvent.Sync, look)
    })
}

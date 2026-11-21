import '@ow-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { chatPictureOf } from '@/services/chat/users/picture'
import { chatProfileImageCollection } from '@/services/chat/users/chatProfileImageCollection'
import { cacheImageStore, toJpegBuffer } from '@/services/images/subservice/imageFiles'
import type { Homeserver } from './client'
import type { SyncReport } from './report'

const nameOf = (user: { firstname: string, lastname: string }) => `${user.firstname} ${user.lastname}`

const pictureSelection = {
    select: {
        id: true,
        processingAttempts: true,
        processedFiles: { select: { fsLocationSmallSize: true, fsLocationTinySize: true } },
    },
} as const

type Sizes = { fsLocationSmallSize: string | null, fsLocationTinySize: string }
type Image = { id: number, processingAttempts: number, processedFiles: Sizes | null }
type ResizedPicture = { id: number, sizes: Sizes }

/** What a profile write does to an account's picture, with the image the picture is then of. */
type PictureChange = { pictureUrl: string | null, imageId: number | null }
const NO_PICTURE: PictureChange = { pictureUrl: null, imageId: null }

/**
 * The picture to give an account now. Null takes away the one it has, and undefined leaves it as
 * it is.
 */
function pictureToGive({ picture, syncedImageId, syncedIsDeleted, hasPictureOnHomeserver }: {
    picture: Image | undefined,
    syncedImageId: number | null,
    syncedIsDeleted: boolean,
    hasPictureOnHomeserver: boolean,
}): ResizedPicture | null | undefined {
    if (!picture) return syncedImageId !== null || hasPictureOnHomeserver ? null : undefined
    if (picture.processedFiles) {
        return picture.id === syncedImageId ? undefined : { id: picture.id, sizes: picture.processedFiles }
    }
    // The picture waits for the image worker, and the account keeps the one it has meanwhile.
    return syncedIsDeleted ? null : undefined
}

/**
 * The picture uploaded for an account that the account has yet to be given, by the id of its
 * ChatUser. A profile the homeserver refuses is written again on every run, and would otherwise
 * leave a new file there each time. The worker runs the sync in one process, so it lasts between
 * runs, and it is forgotten once the account's profile is written.
 */
const ungivenUploads = new Map<number, { imageId: number, uri: string }>()

/**
 * Synapse makes thumbnails of jpeg, png, gif and webp alone, and a client shows a picture by its
 * thumbnail, so the avif the image is kept as here is made a jpeg. The small size does for a
 * picture, and an image too narrow to have one is whole in the tiny.
 */
async function uploadOnce(homeserver: Homeserver, chatUserId: number, picture: ResizedPicture): Promise<string> {
    const ungiven = ungivenUploads.get(chatUserId)
    if (ungiven?.imageId === picture.id) return ungiven.uri

    const avif = await cacheImageStore.readFile(picture.sizes.fsLocationSmallSize ?? picture.sizes.fsLocationTinySize)
    const uri = await homeserver.uploadPicture(await toJpegBuffer(avif))
    ungivenUploads.set(chatUserId, { imageId: picture.id, uri })
    return uri
}

/**
 * Gives every account the name its user has here and the picture `chatPictureOf` says it has.
 * `ChatUser.syncedName` and `syncedImageId` are what the account was last given, so only a change is
 * sent. An account is made by the chat's sign in, some time after its ChatUser, and one that is not
 * there yet is left for a later run.
 */
export async function syncProfiles(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const chatUsers = await prisma.chatUser.findMany({
        where: { deactivatedAt: null, user: { isNot: null } },
        select: {
            id: true,
            localpart: true,
            syncedName: true,
            syncedImageId: true,
            image: pictureSelection,
            user: { select: { firstname: true, lastname: true, image: pictureSelection } },
        },
    })
    // A user without a picture may set one in the chat client, which no row here tells of.
    const accountsWithPicture = await homeserver.readAccountsWithPicture().catch((error: unknown) => {
        report.refuse('read which accounts have a picture', error)
        return new Set<string>()
    })
    for (const { id, localpart, syncedName, syncedImageId, image, user } of chatUsers) {
        const userId = homeserver.userIdOf(localpart)
        const name = nameOf(user!)
        const nameIsNew = syncedName !== name
        // The image of the picture the account was last given is no longer the account's or its
        // user's, so that picture is not to be shown any longer, whatever comes in its place.
        const syncedIsDeleted = syncedImageId !== null && syncedImageId !== image?.id && syncedImageId !== user!.image?.id
        const picture = pictureToGive({
            picture: chatPictureOf({ image, user })?.image,
            syncedImageId,
            syncedIsDeleted,
            hasPictureOnHomeserver: accountsWithPicture.has(userId),
        })
        if (!nameIsNew && picture === undefined) continue
        const hasAccount = await homeserver.hasAccount(userId).catch((error: unknown) => {
            report.refuse(`look up ${userId}`, error)
            return false
        })
        if (!hasAccount) continue

        let pictureChange = picture === null ? NO_PICTURE : undefined
        if (picture) {
            pictureChange = await uploadOnce(homeserver, id, picture)
                .then((pictureUrl): PictureChange => ({ pictureUrl, imageId: picture.id }))
                .catch((error: unknown) => {
                    report.refuse(`upload the picture of ${userId}`, error)
                    // It is left for a later run, which neither a new name nor a deleted picture waits for.
                    return syncedIsDeleted ? NO_PICTURE : undefined
                })
        }
        if (!nameIsNew && !pictureChange) continue

        await report.carryOut({
            what: `${[nameIsNew && 'name', pictureChange && 'picture'].filter(Boolean).join(' and ')} ${userId}`,
            run: async () => {
                await homeserver.writeProfile(userId, {
                    displayName: nameIsNew ? name : undefined,
                    pictureUrl: pictureChange?.pictureUrl,
                })
                await prisma.chatUser.update({
                    where: { id },
                    data: { syncedName: name, syncedImageId: pictureChange?.imageId },
                })
                ungivenUploads.delete(id)
            },
        })
    }
}

/**
 * Deactivates the accounts of deleted users. A deleted user's ChatUser stays, without a user, see
 * chat.prisma: that is what says the account is to go. The row is then marked, and kept, so its
 * localpart is never given to another user. Its picture is deleted, since nobody is left to remove it.
 */
export async function deactivateAccountsOfDeletedUsers(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const leftBehind = await prisma.chatUser.findMany({
        where: { userId: null, deactivatedAt: null },
        select: { id: true, localpart: true, imageId: true },
    })
    for (const { id, localpart, imageId } of leftBehind) {
        await report.carryOut({
            what: `deactivate ${homeserver.userIdOf(localpart)}`,
            run: async () => {
                await homeserver.deactivate(localpart)
                await prisma.$transaction(async tx => {
                    await tx.chatSpaceMember.deleteMany({ where: { chatUserId: id } })
                    await tx.chatUser.update({ where: { id }, data: { deactivatedAt: new Date() } })
                    if (imageId !== null) {
                        await chatProfileImageCollection.internal.destroyImage.internalCall({
                            prisma: tx,
                            params: { imageId },
                        })
                    }
                })
            },
        })
    }
}

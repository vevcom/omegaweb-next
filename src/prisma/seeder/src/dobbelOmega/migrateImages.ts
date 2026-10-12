import { owIdToPnId, type IdMapper } from './IdMapper'
import { createProgressBar } from './progressBar'
import manifest from '@/prisma/seeder/src/dobbelOmega/manifest'
import { imageOperations } from '@/services/images/subservice/operations'
import { allowedExtensions } from '@/services/images/subservice/constants'
import { mimeTypeForExtension } from '@/lib/store/fileExtensions'
import { ombulCoversImagePanelOperations } from '@/services/ombul/ombulCoverCollection'
import { profileImagesImagePanelOperations } from '@/services/users/profileImageCollection'
import { committeeLogosImagePanelOperations } from '@/services/groups/committees/committeeLogoCollection'
import logger from '@/lib/logger'
import {
    PrismaClientInitializationError,
    PrismaClientKnownRequestError,
    PrismaClientRustPanicError,
    PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/client'
import { File } from 'node:buffer'
import type { Limits } from './migrationLimits'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'

/**
 * This function migrates images from Omegaweb-basic to PN and adds them to the correct image collection
 * If they do not belong to a image collection (group on Omegaweb-basic)
 * they will be added to a garbage collection. The function also places special images
 * like the once related to a ombul, profile picture, or committee logo in the correct special collection.
 *
 * Only the original file is fetched from Omegaweb-basic - imageOperations.uploadImage takes care of
 * generating the small/medium/large avif sizes and storing everything, same as a live upload would.
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param migrateImageCollectionIdMap - IdMapper - A map of the old and new id's of the image collections also
 * @param limits - Limits - used to limit the number of images to migrate
 * the same as the return value of migrateImageCollection
 * @returns - A map of the old and new id's of the images to be used to create correct relations
 */
export default async function migrateImages(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    migrateImageCollectionIdMap: IdMapper,
    limits: Limits
) {
    // Keyed on the name it actually creates: looking up 'Garbage' never matched the row this
    // creates, so the upsert always took the create branch and a second run died on the unique
    // name before migrating anything.
    const garbageCollectionName = 'Søppel fra Omegaweb-basic'
    const garbageCollection = await pnPrisma.imageCollection.upsert({
        where: {
            name: garbageCollectionName
        },
        update: {},
        create: {
            name: garbageCollectionName,
            description: 'Denne samlingen inneholder bilder som ikke tilhørete noen samling i omegaweb-basic',
            visibilityRegular: {
                create: {},
            },
            visibilityAdmin: {
                create: { requirements: { create: [{}] } }
            }
        },
    })

    // Reads (and, if missing, creates from config) each special collection through its real
    // implementation, same as the live app uses - rather than assuming it already exists.
    const ombulCollection = await ombulCoversImagePanelOperations.readCollection({ prisma: pnPrisma, bypassAuth: true })
    const profileCollection = await profileImagesImagePanelOperations.readCollection({ prisma: pnPrisma, bypassAuth: true })
    const committeeLogosCollection = await committeeLogosImagePanelOperations.readCollection({
        prisma: pnPrisma, bypassAuth: true
    })

    const images = await owPrisma.images.findMany({
        include: {
            Ombul: true,
            Articles: true,
            Events: true,
        }
    })

    // Find what the profile collection is on omegaweb-basic
    const omegawebBasicProfileCollection = await owPrisma.imageGroups.findFirstOrThrow({
        where: {
            name: 'Profilbilder',
        },
    })

    // Committees.ImageId has no back-relation on Images, so committee logos can't be picked up via an
    // include like Ombul/Articles/Events below - fetched separately so they're exempted from limits too,
    // same as ombul covers and profile pictures. Otherwise migrateCommittees can silently end up with no
    // logo for a committee whose image got filtered out here under a limited/dev migration.
    const committees = await owPrisma.committees.findMany({
        select: { ImageId: true },
    })
    const committeeImageIds = new Set(
        committees.flatMap(committee => (committee.ImageId ? [committee.ImageId] : []))
    )

    manifest.info(`Before filter: ${images.length} images`)
    const imagesWithCollection = images.map(image => {
        let collectionId = owIdToPnId(migrateImageCollectionIdMap, image.ImageGroupId, 'image collections')
        if (image.Ombul.length) {
            collectionId = ombulCollection.id
        } else if (committeeImageIds.has(image.id)) {
            collectionId = committeeLogosCollection.id
        } else if (!collectionId) {
            collectionId = garbageCollection.id
        } else if (image.ImageGroupId === omegawebBasicProfileCollection.id) {
            collectionId = profileCollection.id
        }
        return {
            ...image,
            collectionId,
        }
    }).filter(image => {
        //Apply limits
        if (limits.numberOffFullImageCollections === null) return true
        if (image.Articles.length) return true
        if (image.Events.length) return true
        //Images belonging to a special collection are always migrated, regardless of limits
        if (image.collectionId === ombulCollection.id) return true
        if (image.collectionId === profileCollection.id) return true
        if (image.collectionId === committeeLogosCollection.id) return true
        if (image.ImageGroupId && image.ImageGroupId < limits.numberOffFullImageCollections) return true
        return false
    })
    manifest.info(`After filter: ${imagesWithCollection.length} images`)

    //correct names if there are duplicates. Kept separate from the OW `name` field (used to fetch the
    //file from Omegaweb-basic below) since that field is a store token, not the display name.
    const namesTaken: { name: string, times: number }[] = []
    const imagesToMigrate = limits.images === null
        ? imagesWithCollection
        : imagesWithCollection.slice(0, limits.images)
    const imagesWithCorrectedName = imagesToMigrate.map(image => {
        const baseName = image.originalName.split('.').slice(0, -1).join('.')
        const nameTaken = namesTaken.find(nameTakenItem => nameTakenItem.name === baseName)
        if (nameTaken) {
            nameTaken.times++
            return { ...image, pnImageName: `${baseName}(${nameTaken.times})` }
        }
        namesTaken.push({ name: baseName, times: 0 })
        return { ...image, pnImageName: baseName }
    })

    const migrateImageIdMap: IdMapper = []
    const bar = createProgressBar('Migrating images', imagesWithCorrectedName.length)

    const migrateOneImage = async (image: (typeof imagesWithCorrectedName)[number]) => {
        try {
            const ext = (image.originalName.split('.').pop() || '').toLowerCase()
            const mimeType = mimeTypeForExtension(ext)
            if (!mimeType) {
                logger.error(`Image ${image.originalName} has unsupported extension "${ext}", skipping`)
                return
            }

            const fsLocationOldVev = `${process.env.OW_STORE_URL}/image/default/${image.name}`
                + `?url=/store/images/${image.name}.${ext}`

            const res = await fetch(fsLocationOldVev, {
                method: 'GET',
                //This is to make the fetch request look like it comes from a browser. Not sure if it helps
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                },
            }).catch(() => {
                // The network-failure case is logged here and nowhere else: the
                // !res check below is the same path, and logging in both printed
                // every failure twice - especially noisy behind a progress bar.
                logger.error(`Failed to fetch image from ${fsLocationOldVev}`)
                return undefined
            })

            if (!res || !res.ok) {
                // res is set only when the request completed but the status was bad,
                // which the catch above never saw.
                if (res) {
                    logger.error(`Failed to fetch image from ${fsLocationOldVev}: HTTP ${res.status}`)
                }
                return
            }

            const buffer = Buffer.from(await res.arrayBuffer())
            const imageFile = new File([new Uint8Array(buffer)], `${image.pnImageName}.${ext}`, { type: mimeType })

            const pnImage = await imageOperations.uploadImage.internalCall({
                prisma: pnPrisma,
                params: { collectionId: image.collectionId },
                data: {
                    imageFile,
                    imageName: image.pnImageName.slice(0, 50),
                    imageAlt: image.pnImageName.split('_').join(' ').slice(0, 100),
                },
                operationImplementationFields: {
                    uploadAsStandardImage: null,
                    // Deliberately the full set rather than the per-collection subset: this migrates
                    // what omegaweb-basic already has, including committee logos, raster over there.
                    allowedExtensions,
                },
            })

            migrateImageIdMap.push({ owId: image.id, pnId: pnImage.id })
        } catch (error) {
            // One bad file must not take the whole import with it. These run inside a
            // Promise.all over every image on the old site, so an uncaught rejection here
            // aborts DobbelOmega entirely - hours in, with the database already reset.
            // Omegaweb-basic holds files whose bytes do not match their extension at all,
            // which sharp only discovers once it tries to decode them, so this is a
            // certainty on the real dataset rather than a defensive flourish.
            //
            // A database or disk that has gone away is the opposite case and must not be
            // swallowed: skipping leaves the image out of migrateImageIdMap, and every
            // migration after this one reads that map to rebuild its relations. An outage
            // would otherwise be reported as a few thousand individually bad files and
            // produce an import that finishes "successfully" with its images missing.
            if (isInfrastructureFailure(error)) throw error

            logger.error(
                `Failed to migrate image ${image.originalName} (owId ${image.id}), skipping: `
                + `${error instanceof Error ? error.message : String(error)}`
            )
        } finally {
            bar.increment()
        }
    }

    //Batched to avoid hammering omegaweb-basic with too many concurrent requests at once
    const batchSize = 1200
    const imageBatches: (typeof imagesWithCorrectedName)[] = [[]]
    for (const image of imagesWithCorrectedName) {
        if (imageBatches[imageBatches.length - 1].length >= batchSize) {
            imageBatches.push([image])
        } else {
            imageBatches[imageBatches.length - 1].push(image)
        }
    }
    for (const imageBatch of imageBatches) {
        await Promise.all(imageBatch.map(migrateOneImage))
    }
    bar.stop()

    return migrateImageIdMap
}

/**
 * Whether an error says the environment is broken rather than the file. Prisma's error
 * classes cover the database (a rejected query, a connection that never came up, a panicked
 * engine), and node's fs errors cover the store volume - a full or unwritable disk fails
 * every image just as reliably as it fails this one, so there is nothing to be gained by
 * carrying on.
 *
 * Anything else - sharp refusing to decode the bytes, a mime type the store does not
 * accept - is a property of the one file and is skipped.
 */
function isInfrastructureFailure(error: unknown): boolean {
    if (
        error instanceof PrismaClientKnownRequestError ||
        error instanceof PrismaClientUnknownRequestError ||
        error instanceof PrismaClientInitializationError ||
        error instanceof PrismaClientRustPanicError
    ) {
        return true
    }

    const fsErrorCodes = ['ENOSPC', 'EACCES', 'EROFS', 'EMFILE', 'ENFILE', 'EDQUOT', 'EIO']
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && typeof error.code === 'string'
        && fsErrorCodes.includes(error.code)
}

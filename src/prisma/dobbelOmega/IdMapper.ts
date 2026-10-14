import logger from '@/lib/logger'

export type MappedResource =
    | 'images'
    | 'image collections'
    | 'committees'
    | 'user accounts'
    | 'drain accounts'
    | 'event registrations'

export type IdMapper = {
    owId: number
    pnId: number
}[]

/**
 * Looks up the PN id for an Omegaweb-basic id in a migrated IdMapper (images, image
 * collections, ...). Returns null if no id is found.
 * @param mapper - IdMapper - A map of the old and new id's for the given resource
 * @param owId - number - The id of the resource on Omegaweb-basic
 * @param resource - what the mapper maps, used to give an accurate error message. Images
 * are commonly missing because migration limits skip most of them (see migrationLimits.ts)
 * - that isn't a bug, so it gets called out separately from other resources.
 * @returns - number | null - The id of the resource on PN
 */
export function owIdToPnId(
    mapper: IdMapper,
    owId: number | null,
    resource: MappedResource,
): number | null {
    if (!owId) return null
    const id = mapper.find(_id => _id.owId === owId)?.pnId
    if (!id) {
        // A missing image is routine - migration limits leave the map short on purpose, and a limited
        // run would otherwise fill the log with lines at error level for something that is not a
        // failure. Any other resource going missing is a genuine gap in the migration.
        if (resource === 'images') {
            logger.warn(
                `No pnId found for owId ${owId} while mapping images` +
                ' - expected if images were limited, see migrationLimits.ts'
            )
            return null
        }
        logger.error(`No pnId found for owId ${owId} while mapping ${resource}`)
        return null
    }
    return id
}

import { Smorekopp } from '@/services/error'

/**
 * Upserts through a pair of service operations rather than a native prisma upsert - use this when
 * going through serviceOperations is the natural choice for a seed file; otherwise prefer a native
 * prisma.model.upsert() against a real unique constraint.
 *
 * checkExistence's resolved value is only ever used for its truthiness, so it can be the read
 * call itself (e.g. `() => someOperations.read({ params })`) rather than a boolean: a thrown
 * NOT FOUND Smorekopp error, or any falsy resolved value (null, undefined, etc.), is treated as
 * "does not exist" and runs create; anything else runs update.
 */
export async function upsert<ReturnCreate, ReturnUpdate>(
    config: {
        checkExistence: () => Promise<unknown>,
        create: () => ReturnCreate,
        update: () => ReturnUpdate,
    }
): Promise<Awaited<ReturnCreate> | Awaited<ReturnUpdate>> {
    const exists = await config.checkExistence().catch(error => {
        if (error instanceof Smorekopp && error.errorCode === 'NOT FOUND') return false
        throw error
    })

    if (exists) {
        return await config.update()
    }
    return await config.create()
}

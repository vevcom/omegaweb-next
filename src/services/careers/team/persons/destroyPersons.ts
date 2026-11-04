import '@pn-server-only'
import { careerTeamImageOperations } from './careerTeamImageCollection'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Deletes the persons and their portraits. The portraits' files are only removed by the returned
 * cleanup, which the caller runs once its transaction has committed.
 */
export async function destroyPersonsAndReturnCleanup(
    tx: Prisma.TransactionClient,
    where: Prisma.CareerTeamPersonWhereInput,
) {
    const persons = await tx.careerTeamPerson.findMany({ where, select: { imageId: true } })
    await tx.careerTeamPerson.deleteMany({ where })
    const cleanups = await Promise.all(persons.flatMap(person => (person.imageId === null ? [] : [
        careerTeamImageOperations.destroyImageDbAndReturnCleanup.internalCall({
            prisma: tx,
            params: { imageId: person.imageId },
        }),
    ])))
    return async () => {
        await Promise.all(cleanups.map(cleanup => cleanup()))
    }
}

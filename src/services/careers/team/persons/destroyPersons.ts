import '@pn-server-only'
import { careerTeamImageOperations } from './careerTeamImageCollection'
import type { Prisma } from '@/prisma-generated-pn-types'

/** Deletes the persons and their portraits. */
export async function destroyPersons(
    tx: Prisma.TransactionClient,
    where: Prisma.CareerTeamPersonWhereInput,
) {
    const persons = await tx.careerTeamPerson.findMany({ where, select: { imageId: true } })
    await tx.careerTeamPerson.deleteMany({ where })
    await Promise.all(persons.flatMap(person => (person.imageId === null ? [] : [
        careerTeamImageOperations.destroyImage.internalCall({
            prisma: tx,
            params: { imageId: person.imageId },
        }),
    ])))
}

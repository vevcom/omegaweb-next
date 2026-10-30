import '@pn-server-only'
import { cmsPersonSchemas } from './schemas'
import { cmsPersonIncluder } from './constants'
import { cmsPersonImageOperations } from './personImageCollection'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { CmsPersonOwner } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Deletes the persons and their portraits. The portraits' files are only removed by the returned
 * cleanup, which the caller runs once its transaction has committed.
 */
async function destroyPersonsAndReturnCleanup(prisma: Prisma.TransactionClient, where: Prisma.CmsPersonWhereInput) {
    const persons = await prisma.cmsPerson.findMany({ where, select: { imageId: true } })
    await prisma.cmsPerson.deleteMany({ where })

    const cleanups: (() => Promise<void>)[] = []
    for (const person of persons) {
        if (person.imageId === null) continue
        cleanups.push(await cmsPersonImageOperations.destroyImageDbAndReturnCleanup.internalCall({
            prisma,
            params: { imageId: person.imageId },
        }))
    }
    return async () => {
        for (const cleanup of cleanups) await cleanup()
    }
}

export const cmsPersonOperations = {
    create: defineSubOperation({
        dataSchema: () => cmsPersonSchemas.data.create,
        operation: ({ owner }: { owner: CmsPersonOwner }) => ({ prisma, data }) => prisma.cmsPerson.create({
            data: { ...data, ...owner },
            include: cmsPersonIncluder,
        }),
    }),

    update: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.update,
        dataSchema: () => cmsPersonSchemas.data.update,
        operation: () => ({ prisma, params, data }) => prisma.cmsPerson.update({
            where: { id: params.cmsPersonId },
            data,
            include: cmsPersonIncluder,
        }),
    }),

    /**
     * Replaces the person's portrait with an upload to the PERSONIMAGES collection, and deletes the
     * portrait it had.
     */
    updateImage: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.updateImage,
        dataSchema: () => cmsPersonSchemas.data.updateImage,
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => {
            // The upload writes several resized files before the database, so it needs more than the
            // default transaction timeout.
            const { image, cleanup } = await prisma.$transaction(async tx => {
                const person = await tx.cmsPerson.findUniqueOrThrow({
                    where: { id: params.cmsPersonId },
                    select: { name: true, imageId: true },
                })
                const uploadedImage = await cmsPersonImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageName: 'Portrett',
                        imageAlt: `Portrett av ${person.name}`.slice(0, 100),
                    },
                })
                await tx.cmsPerson.update({
                    where: { id: params.cmsPersonId },
                    data: { imageId: uploadedImage.id },
                })
                const fileCleanup = person.imageId === null
                    ? async () => {}
                    : await cmsPersonImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: person.imageId },
                    })
                return { image: uploadedImage, cleanup: fileCleanup }
            }, { timeout: 20000 })
            await cleanup()
            return image
        },
    }),

    destroy: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.destroy,
        opensTransaction: true,
        operation: () => async ({ prisma, params }) => {
            const cleanup = await prisma.$transaction(tx =>
                destroyPersonsAndReturnCleanup(tx, { id: params.cmsPersonId })
            )
            await cleanup()
        },
    }),

    /**
     * Deletes every person of an owner, for an owner that is being deleted itself. It runs in the
     * owner's transaction, so the caller runs the returned cleanup after committing.
     */
    destroyAllOfOwnerAndReturnCleanup: defineSubOperation({
        operation: ({ owner }: { owner: CmsPersonOwner }) => ({ prisma }) =>
            destroyPersonsAndReturnCleanup(prisma, owner),
    }),

    /**
     * Swaps a person with its nearest neighbour above or below it among the persons of the same owner.
     */
    move: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.move,
        dataSchema: () => cmsPersonSchemas.data.move,
        opensTransaction: true,
        operation: () => ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const person = await tx.cmsPerson.findUnique({
                where: { id: params.cmsPersonId },
                select: { id: true, order: true, careerTeamDepartmentId: true },
            })
            if (!person) throw new ServiceError('NOT FOUND', 'Fant ikke personen')

            const neighbour = await tx.cmsPerson.findFirst({
                where: {
                    careerTeamDepartmentId: person.careerTeamDepartmentId,
                    order: data.direction === 'UP' ? { lt: person.order } : { gt: person.order },
                },
                orderBy: { order: data.direction === 'UP' ? 'desc' : 'asc' },
                select: { id: true, order: true },
            })
            if (!neighbour) throw new ServiceError('BAD PARAMETERS', 'Personen kan ikke flyttes dit')

            // Swapped by way of -1, since the order is unique within the owner.
            await tx.cmsPerson.update({ where: { id: person.id }, data: { order: -1 } })
            await tx.cmsPerson.update({ where: { id: neighbour.id }, data: { order: person.order } })
            await tx.cmsPerson.update({ where: { id: person.id }, data: { order: neighbour.order } })
        }),
    }),
} as const

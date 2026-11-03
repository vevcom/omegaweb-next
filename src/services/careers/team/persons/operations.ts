import '@pn-server-only'
import { careersTeamPersonAuth } from './auth'
import { careersTeamPersonSchemas } from './schemas'
import { careersTeamPersonIncluder } from './constants'
import { careerTeamImageOperations } from './careerTeamImageCollection'
import { destroyPersonsAndReturnCleanup } from './destroyPersons'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

export const careersTeamPersonOperations = {
    create: defineOperation({
        paramsSchema: careersTeamPersonSchemas.params.create,
        dataSchema: careersTeamPersonSchemas.data.create,
        authorizer: () => careersTeamPersonAuth.create,
        operation: ({ prisma, params, data }) => prisma.careerTeamPerson.create({
            data: { ...data, departmentId: params.departmentId },
            include: careersTeamPersonIncluder,
        }),
    }),

    update: defineOperation({
        paramsSchema: careersTeamPersonSchemas.params.update,
        dataSchema: careersTeamPersonSchemas.data.update,
        authorizer: () => careersTeamPersonAuth.update,
        operation: ({ prisma, params, data }) => prisma.careerTeamPerson.update({
            where: { id: params.personId },
            data,
            include: careersTeamPersonIncluder,
        }),
    }),

    updateImage: defineOperation({
        paramsSchema: careersTeamPersonSchemas.params.updateImage,
        dataSchema: careersTeamPersonSchemas.data.updateImage,
        authorizer: () => careersTeamPersonAuth.updateImage,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            // The upload writes several resized files before the database, so it needs more than the
            // default transaction timeout.
            const { image, cleanup } = await prisma.$transaction(async tx => {
                const person = await tx.careerTeamPerson.findUniqueOrThrow({
                    where: { id: params.personId },
                    select: { name: true, imageId: true },
                })
                const uploadedImage = await careerTeamImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageName: 'Portrett',
                        imageAlt: `Portrett av ${person.name}`.slice(0, 100),
                    },
                })
                await tx.careerTeamPerson.update({
                    where: { id: params.personId },
                    data: { imageId: uploadedImage.id },
                })
                const fileCleanup = person.imageId === null
                    ? async () => {}
                    : await careerTeamImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: person.imageId },
                    })
                return { image: uploadedImage, cleanup: fileCleanup }
            }, { timeout: 20000 })
            await cleanup()
            return image
        },
    }),

    destroy: defineOperation({
        paramsSchema: careersTeamPersonSchemas.params.destroy,
        authorizer: () => careersTeamPersonAuth.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const cleanup = await prisma.$transaction(tx => destroyPersonsAndReturnCleanup(tx, { id: params.personId }))
            await cleanup()
        },
    }),

    move: defineOperation({
        paramsSchema: careersTeamPersonSchemas.params.move,
        dataSchema: careersTeamPersonSchemas.data.move,
        authorizer: () => careersTeamPersonAuth.move,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const person = await tx.careerTeamPerson.findUniqueOrThrow({
                where: { id: params.personId },
                select: { id: true, order: true, departmentId: true },
            })
            const neighbour = await tx.careerTeamPerson.findFirst({
                where: {
                    departmentId: person.departmentId,
                    order: data.direction === 'UP' ? { lt: person.order } : { gt: person.order },
                },
                orderBy: { order: data.direction === 'UP' ? 'desc' : 'asc' },
                select: { id: true, order: true },
            })
            if (!neighbour) throw new ServiceError('BAD PARAMETERS', 'Personen kan ikke flyttes dit')

            // Swapped by way of -1, since the order is unique within the department.
            await tx.careerTeamPerson.update({ where: { id: person.id }, data: { order: -1 } })
            await tx.careerTeamPerson.update({ where: { id: neighbour.id }, data: { order: person.order } })
            await tx.careerTeamPerson.update({ where: { id: person.id }, data: { order: neighbour.order } })
        }),
    }),
} as const

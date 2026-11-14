import '@pn-server-only'
import { chatSpaceOperations } from './subservice/operations'
import { chatSpaceSchemas } from './subservice/schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import type { ImplementationParamsObject, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

type SpaceArgs<ImplementationParamsSchema extends z.ZodTypeAny | undefined> = {
    prisma: PrismaPossibleTransaction<false>,
    spaceId: number,
} & ImplementationParamsObject<ImplementationParamsSchema, 'INFERRED'>

/**
 * The chat space operations of one owner. It owns a space that has its purpose and passes its
 * `ownershipCheck`. Who administers a space is the owner's entry in `chatSpaceAdmins`, not asked here.
 */
export function implementChatSpaces<
    ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined
>({
    purpose,
    implementationParamsSchema,
    authorizers,
    ownershipCheck,
}: {
    purpose: ChatSpacePurpose,
    implementationParamsSchema?: ImplementationParamsSchema,
    authorizers: {
        read: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
        update: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
        destroy: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
        setMembers: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
        setRooms: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    },
    ownershipCheck: (args: SpaceArgs<ImplementationParamsSchema>) => Awaitable<boolean>,
}) {
    const ownsSpace = async (args: SpaceArgs<ImplementationParamsSchema>): Promise<boolean> => {
        const space = await args.prisma.chatSpace.findUnique({ where: { id: args.spaceId }, select: { purpose: true } })
        return space?.purpose === purpose && await ownershipCheck(args)
    }

    return {
        ownsSpace,

        read: chatSpaceOperations.read.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.read({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        readMembers: chatSpaceOperations.readMembers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.read({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        update: chatSpaceOperations.update.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.update({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        destroy: chatSpaceOperations.destroy.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.destroy({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        readAddableUsers: chatSpaceOperations.readAddableUsers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setMembers({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        addMembers: chatSpaceOperations.addMembers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setMembers({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        removeMembers: chatSpaceOperations.removeMembers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setMembers({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        readRooms: chatSpaceOperations.readRooms.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.read({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        createRoom: chatSpaceOperations.createRoom.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setRooms({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        updateRoom: chatSpaceOperations.updateRoom.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setRooms({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        destroyRoom: chatSpaceOperations.destroyRoom.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setRooms({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        addRoomMembers: chatSpaceOperations.addRoomMembers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setRooms({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),
        removeRoomMembers: chatSpaceOperations.removeRoomMembers.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.setRooms({ ...args, spaceId: args.params.spaceId }),
            ownershipCheck: args => ownsSpace({ ...args, spaceId: args.params.spaceId }),
        }),

        internal: {
            /** For the owner to call in the transaction that writes its own row. */
            create: defineSubOperation({
                dataSchema: () => chatSpaceSchemas.data.create,
                operation: () => ({ data }) => chatSpaceOperations.create.internalCall({
                    data,
                    operationImplementationFields: { purpose },
                }),
            }),
        },
    } as const
}

import '@pn-server-only'
import { chatSpaceOperations } from './subservice/operations'
import { chatSpaceSchemas } from './subservice/schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import type { ImplementationParamsObject, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

/** The space in question, with the implementation params of the owner when it takes any, such as its group's id. */
type SpaceArgs<ImplementationParamsSchema extends z.ZodTypeAny | undefined> = {
    prisma: PrismaPossibleTransaction<false>,
    spaceId: number,
} & ImplementationParamsObject<ImplementationParamsSchema, 'INFERRED'>

/**
 * The chat space operations of one service that owns spaces, such as the committees. Its purpose
 * marks the spaces it makes, and it owns a space when the space has that purpose and its own
 * `ownershipCheck` says so: a committee owns the space of that committee, not every committee's.
 *
 * `create` comes out internal: the owner calls it in the transaction that writes its own row, and
 * keeps the space's id there. Who is in a space is `setMembers`'s to let through. Who administers
 * one is not asked here but by the chat sync, of `chatSpaceAdmins` in admins.ts, where the owner
 * adds how its admins are read.
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
    },
    /** Whether the space is the owner's own, on top of having its purpose. */
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

        internal: {
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

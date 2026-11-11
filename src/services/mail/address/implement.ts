import '@pn-server-only'
import { mailAddressOperations } from './operations'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { MailAddress } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

type OwnerArgs<ImplementationParamsSchema extends z.ZodType<unknown>> = {
    prisma: PrismaPossibleTransaction<false>,
    implementationParams: z.infer<ImplementationParamsSchema>,
}

type Authorizers<ImplementationParamsSchema extends z.ZodType<unknown>> = {
    read: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    update: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    updateForwarding: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
}

/**
 * The operations of the address a service's rows have, see operations.ts: an alias's, and a
 * user's. The implementation params name the owner, and `readMailAddress` reads its address, by
 * which `update` and `updateForwarding` refuse an address that is another owner's. The `internal`
 * ones, `create` and `destroy`, are the sub-service's own, for the owner's operations to call with
 * `internalCall` in the transaction that writes or deletes its row.
 */
export function implementMailAddressOperations<
    const ImplementationParamsSchema extends z.ZodType<unknown>
>({
    implementationParamsSchema,
    authorizers,
    readMailAddress,
}: {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizers: Authorizers<ImplementationParamsSchema>,
    /** The address of the owner, or null for an owner that has none. */
    readMailAddress: (args: OwnerArgs<ImplementationParamsSchema>) => Promise<MailAddress | null>,
}) {
    const isOwnersAddress = async (args: OwnerArgs<ImplementationParamsSchema>, mailAddressId: number) =>
        (await readMailAddress(args))?.id === mailAddressId

    return {
        internal: {
            create: mailAddressOperations.create,
            destroy: mailAddressOperations.destroy,
        },
        read: defineOperation({
            paramsSchema: implementationParamsSchema,
            authorizer: ({ params, prisma }) => authorizers.read({ prisma, implementationParams: params }),
            operation: ({ params, prisma }) => readMailAddress({ prisma, implementationParams: params }),
        }),
        update: mailAddressOperations.update.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: ({ implementationParams, prisma }) => authorizers.update({ prisma, implementationParams }),
            ownershipCheck: ({ params, prisma, implementationParams }) =>
                isOwnersAddress({ prisma, implementationParams }, params.mailAddressId),
        }),
        updateForwarding: mailAddressOperations.updateForwarding.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: ({ implementationParams, prisma }) => authorizers.updateForwarding({ prisma, implementationParams }),
            ownershipCheck: ({ params, prisma, implementationParams }) =>
                isOwnersAddress({ prisma, implementationParams }, params.mailAddressId),
        }),
    } as const
}

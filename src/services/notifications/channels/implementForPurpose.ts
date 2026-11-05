import '@pn-server-only'
import { notificationChannelOperations } from './subservice/operations'
import { notificationChannelSchemas } from './subservice/schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { NotificationChannelPurpose } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'

type ChannelArgs = {
    prisma: PrismaPossibleTransaction<false>,
    channelId: number,
}

/**
 * The channel operations of one system that makes channels as it goes, such as the admin pages or,
 * later, an event for itself. Its purpose marks the channels it makes, and it owns a channel when
 * the channel has that purpose and its own `ownershipCheck` says so: an event owns the channel of
 * that event, not every event channel.
 *
 * `readMany` and `createNotification` come out as full operations. `create`, `update` and
 * `destroy` come out internal, since not every system lets users do them: an event makes its
 * channel when it is created. A system that does let users do them implements them, with
 * `ownsChannel` as its ownership check.
 */
export function implementNotificationChannelsForPurpose({
    purpose,
    authorizers,
    ownershipCheck,
}: {
    purpose: NotificationChannelPurpose,
    authorizers: {
        readMany: () => Authorizer,
        createNotification: (args: ChannelArgs) => Awaitable<Authorizer>,
    },
    /** Whether the channel is the system's own, on top of having its purpose. */
    ownershipCheck: (args: ChannelArgs) => Awaitable<boolean>,
}) {
    const hasPurpose = async ({ prisma, channelId }: ChannelArgs): Promise<boolean> => {
        const channel = await prisma.notificationChannel.findUnique({
            where: { id: channelId },
            select: { purpose: true },
        })
        return channel?.purpose === purpose
    }

    const ownsChannel = async (args: ChannelArgs): Promise<boolean> =>
        await hasPurpose(args) && await ownershipCheck(args)

    /** The internal operations never reach a channel of another purpose, whatever the caller passes. */
    const assertPurpose = async (args: ChannelArgs): Promise<void> => {
        if (!await hasPurpose(args)) {
            throw new ServiceError('DISSALLOWED', `Kanalen er ikke en ${purpose}-kanal.`)
        }
    }

    return {
        ownsChannel,

        readMany: notificationChannelOperations.readMany.implement({
            authorizer: () => authorizers.readMany(),
            ownershipCheck: () => true,
            operationImplementationFields: { where: { purpose } },
        }),

        createNotification: notificationChannelOperations.createNotification.implement({
            authorizer: ({ prisma, params }) => authorizers.createNotification({ prisma, channelId: params.channelId }),
            ownershipCheck: ({ prisma, params }) => ownsChannel({ prisma, channelId: params.channelId }),
        }),

        internal: {
            create: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.create,
                dataSchema: () => notificationChannelSchemas.data.create,
                opensTransaction: true,
                operation: () => ({ params, data }) => notificationChannelOperations.create.internalCall({
                    params,
                    data,
                    operationImplementationFields: { purpose },
                }),
            }),

            update: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.update,
                dataSchema: () => notificationChannelSchemas.data.update,
                opensTransaction: true,
                operation: () => async ({ prisma, params, data }) => {
                    await assertPurpose({ prisma, channelId: params.id })
                    return notificationChannelOperations.update.internalCall({ params, data })
                },
            }),

            destroy: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.destroy,
                opensTransaction: true,
                operation: () => async ({ prisma, params }) => {
                    await assertPurpose({ prisma, channelId: params.id })
                    return notificationChannelOperations.destroy.internalCall({ params })
                },
            }),
        },
    } as const
}

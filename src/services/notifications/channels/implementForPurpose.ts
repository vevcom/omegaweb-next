import '@pn-server-only'
import { notificationChannelOperations } from './subservice/operations'
import { notificationChannelSchemas } from './subservice/schemas'
import { availableNotificationMethodIncluder } from './subservice/constants'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { ImplementationParamsObject, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { ParentChannel } from './implementSpecial'
import type { NotificationMethodGeneral } from '@/services/notifications/types'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { NotificationChannelPurpose } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

/** The channel in question, with the implementation params of the system when it takes any, such as the event's id. */
type ChannelArgs<ImplementationParamsSchema extends z.ZodTypeAny | undefined> = {
    prisma: PrismaPossibleTransaction<false>,
    channelId: number,
} & ImplementationParamsObject<ImplementationParamsSchema, 'INFERRED'>

/** What every channel of a purpose is made as, for a system that makes them all alike. */
export type ChannelsOfPurposeConfig = {
    /** The special channel they sit under. Left out for channels that are put under one named when they are made. */
    parent?: ParentChannel,
    description: string,
    /** What their parent offers when left out. */
    availableMethods?: NotificationMethodGeneral,
}

/**
 * The channel operations of one system that makes channels as it goes, such as the admin pages or,
 * later, an event for itself. Its purpose marks the channels it makes, and it owns a channel when
 * the channel has that purpose and its own `ownershipCheck` says so: an event owns the channel of
 * that event, not every event channel. A system whose ownership is to something named in the call,
 * such as the event, takes it as implementation params.
 *
 * `readMany` and `createNotification` come out as full operations. `create`, `update`, `destroy`
 * and `createNotification` come out internal too, since not every system lets users do them: an
 * event makes its channels when it is created and sends in them from its own operations. A system
 * that does let users do them implements them, with `ownsChannel` as its ownership check.
 *
 * A system whose channels are all alike says so once, as `channels`, and makes one with
 * `internal.createAsConfigured`, which takes its name alone.
 */
export function implementNotificationChannelsForPurpose<
    ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined
>({
    purpose,
    channels: channelsConfig,
    implementationParamsSchema,
    authorizers,
    ownershipCheck,
}: {
    purpose: NotificationChannelPurpose,
    channels?: ChannelsOfPurposeConfig,
    implementationParamsSchema?: ImplementationParamsSchema,
    authorizers: {
        readMany: () => Authorizer,
        createNotification: (args: ChannelArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    },
    /** Whether the channel is the system's own, on top of having its purpose. */
    ownershipCheck: (args: ChannelArgs<ImplementationParamsSchema>) => Awaitable<boolean>,
}) {
    const hasPurpose = async ({ prisma, channelId }: ChannelArgs<undefined>): Promise<boolean> => {
        const channel = await prisma.notificationChannel.findUnique({
            where: { id: channelId },
            select: { purpose: true },
        })
        return channel?.purpose === purpose
    }

    const ownsChannel = async (args: ChannelArgs<ImplementationParamsSchema>): Promise<boolean> =>
        await hasPurpose(args) && await ownershipCheck(args)

    /** The internal operations never reach a channel of another purpose, whatever the caller passes. */
    const assertPurpose = async (args: ChannelArgs<undefined>): Promise<void> => {
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

        createNotification: notificationChannelOperations.createNotification.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: args => authorizers.createNotification({ ...args, channelId: args.params.channelId }),
            ownershipCheck: args => ownsChannel({ ...args, channelId: args.params.channelId }),
        }),

        internal: {
            create: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.create,
                dataSchema: () => notificationChannelSchemas.data.create,
                operation: () => ({ params, data }) => notificationChannelOperations.create.internalCall({
                    params,
                    data,
                    operationImplementationFields: { purpose },
                }),
            }),

            createAsConfigured: defineSubOperation({
                dataSchema: () => notificationChannelSchemas.data.createAsConfigured,
                operation: () => async ({ prisma, data }) => {
                    if (!channelsConfig) {
                        throw new ServiceError('SERVER ERROR', `${purpose}-kanaler har ikke noe oppsett å lages fra.`)
                    }
                    const parent = data.parentId === undefined
                        ? await channelsConfig.parent?.readChannelInternal({ prisma })
                        : await prisma.notificationChannel.findUniqueOrThrow({
                            where: { id: data.parentId },
                            include: availableNotificationMethodIncluder,
                        })
                    if (!parent) {
                        throw new ServiceError('SERVER ERROR', `En ${purpose}-kanal må legges under en annen kanal.`)
                    }
                    return notificationChannelOperations.create.internalCall({
                        params: { availableMethods: channelsConfig.availableMethods ?? parent.availableMethods },
                        data: { name: data.name, description: channelsConfig.description, parentId: parent.id },
                        operationImplementationFields: { purpose },
                    })
                },
            }),

            update: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.update,
                dataSchema: () => notificationChannelSchemas.data.update,
                transaction: 'RUNS_IN',
                operation: () => async ({ prisma, params, data }) => {
                    await assertPurpose({ prisma, channelId: params.id })
                    return notificationChannelOperations.update.internalCall({ params, data })
                },
            }),

            destroy: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.destroy,
                transaction: 'RUNS_IN',
                operation: () => async ({ prisma, params }) => {
                    await assertPurpose({ prisma, channelId: params.id })
                    return notificationChannelOperations.destroy.internalCall({ params })
                },
            }),

            createNotification: defineSubOperation({
                paramsSchema: () => notificationChannelSchemas.params.createNotification,
                dataSchema: () => notificationChannelSchemas.data.createNotification,
                operation: () => async ({ prisma, params, data }) => {
                    await assertPurpose({ prisma, channelId: params.channelId })
                    return notificationChannelOperations.createNotification.internalCall({ params, data })
                },
            }),
        },
    } as const
}

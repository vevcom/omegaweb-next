import '@ow-server-only'
import { cmsImageOperations } from './operations'
import { cmsImageSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { SpecialCmsImage } from '@/prisma-generated-pn-types'

/**
 * The operations of the special cms images one service owns. `specials` is the ownership check,
 * so the owner never writes one: no operation here reaches a cms image that is not one of them.
 * A special cms image is created without an image when first read.
 */
export function implementSpecialCmsImages({ specials, authorizers }: {
    specials: readonly SpecialCmsImage[],
    authorizers: {
        read: Authorizer,
        update: Authorizer,
    },
}) {
    return {
        specials,

        internal: {
            read: defineSubOperation({
                paramsSchema: () => cmsImageSchemas.params.readSpecial,
                read: true,
                operation: () => ({ params }) => {
                    if (!specials.includes(params.special)) {
                        throw new ServiceError('BAD PARAMETERS', `${params.special} is not a cms image of this service`)
                    }
                    return cmsImageOperations.readSpecial.internalCall({ params })
                },
            }),
        },

        read: cmsImageOperations.readSpecial.implement({
            authorizer: () => authorizers.read,
            ownershipCheck: ({ params }) => specials.includes(params.special),
        }),

        update: cmsImageOperations.update.implement({
            authorizer: () => authorizers.update,
            ownershipCheck: ({ params }) => cmsImageOperations.isSpecial.internalCall({
                params: { cmsImageId: params.cmsImageId, special: [...specials] },
            }),
        }),
    } as const
}

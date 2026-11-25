import '@ow-server-only'
import { cmsLinkOperations } from './operations'
import { cmsLinkSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { SpecialCmsLink } from '@/prisma-generated-pn-types'

/**
 * The operations of the special links one service owns. `specials` is the ownership check, so the
 * owner never writes one: no operation here reaches a link that is not one of them. A special
 * link is created with placeholder text when first read.
 */
export function implementSpecialCmsLinks({ specials, authorizers }: {
    specials: readonly SpecialCmsLink[],
    authorizers: {
        read: Authorizer,
        update: Authorizer,
    },
}) {
    return {
        specials,

        internal: {
            read: defineSubOperation({
                paramsSchema: () => cmsLinkSchemas.params.readSpecial,
                operation: () => ({ params }) => {
                    if (!specials.includes(params.special)) {
                        throw new ServiceError('BAD PARAMETERS', `${params.special} is not a link of this service`)
                    }
                    return cmsLinkOperations.readSpecial.internalCall({ params })
                },
            }),
        },

        read: cmsLinkOperations.readSpecial.implement({
            authorizer: () => authorizers.read,
            ownershipCheck: ({ params }) => specials.includes(params.special),
        }),

        update: cmsLinkOperations.update.implement({
            authorizer: () => authorizers.update,
            ownershipCheck: ({ params }) => cmsLinkOperations.isSpecial.internalCall({
                params: { linkId: params.linkId, special: [...specials] },
            }),
        }),
    } as const
}

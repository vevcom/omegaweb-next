import '@ow-server-only'
import { cmsParagraphOperations } from './operations'
import { cmsParagraphSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { SpecialCmsParagraph } from '@/prisma-generated-pn-types'

/**
 * The operations of the special paragraphs one service owns. `specials` is the ownership check,
 * so the owner never writes one: no operation here reaches a paragraph that is not one of them.
 * A special paragraph is created empty when first read.
 */
export function implementSpecialCmsParagraphs({ specials, authorizers }: {
    specials: readonly SpecialCmsParagraph[],
    authorizers: {
        read: Authorizer,
        updateContent: Authorizer,
    },
}) {
    return {
        specials,

        internal: {
            read: defineSubOperation({
                paramsSchema: () => cmsParagraphSchemas.params.readSpecial,
                operation: () => ({ params }) => {
                    if (!specials.includes(params.special)) {
                        throw new ServiceError('BAD PARAMETERS', `${params.special} is not a paragraph of this service`)
                    }
                    return cmsParagraphOperations.readSpecial.internalCall({ params })
                },
            }),
        },

        read: cmsParagraphOperations.readSpecial.implement({
            authorizer: () => authorizers.read,
            ownershipCheck: ({ params }) => specials.includes(params.special),
        }),

        updateContent: cmsParagraphOperations.updateContent.implement({
            authorizer: () => authorizers.updateContent,
            ownershipCheck: ({ params }) => cmsParagraphOperations.isSpecial.internalCall({
                params: { paragraphId: params.paragraphId, special: [...specials] },
            }),
        }),
    } as const
}

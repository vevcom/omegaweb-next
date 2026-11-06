import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

/**
 * Who owns an alias or a mailing list when it is created. No owners becomes one requirement with
 * no conditions, which no one passes, so it is the mail server admins' alone, where a visibility
 * with no requirements would be everyone's. Once created, the owners change through the
 * visibility operations, which refuse to empty them.
 */
export const mailOwnerRequirements = Zpn.json({
    label: 'Eiere',
    schema: visibilityRequirementsSchema,
}).default([]).transform(requirements => (requirements.length ? requirements : [{ conditions: [] }]))

const dataFieldSchemas = z.object({
    mailAliasId: z.coerce.number().min(1),
    mailingListId: z.coerce.number().min(1),
    mailAddressExternalId: z.coerce.number().min(1),
    userId: z.coerce.number().min(1),
    groupId: z.coerce.number().min(1),
})


const aliasMailingListRelation = dataFieldSchemas.pick({
    mailAliasId: true,
    mailingListId: true,
})

const mailingListExternalRelation = dataFieldSchemas.pick({
    mailAddressExternalId: true,
    mailingListId: true,
})

const mailingListUserRelation = dataFieldSchemas.pick({
    userId: true,
    mailingListId: true,
})

const mailingListGroupRelation = dataFieldSchemas.pick({
    groupId: true,
    mailingListId: true,
})

export const mailSchemas = {
    data: {
        createAliasMailingListRelation: aliasMailingListRelation,
        createMailingListExternalRelation: mailingListExternalRelation,
        createMailingListUserRelation: mailingListUserRelation,
        createMailingListGroupRelation: mailingListGroupRelation,

        destroyAliasMailingListRelation: aliasMailingListRelation,
        destroyMailingListExternalRelation: mailingListExternalRelation,
        destroyMailingListUserRelation: mailingListUserRelation,
        destroyMailingListGroupRelation: mailingListGroupRelation,
    },
}

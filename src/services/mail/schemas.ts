import { MailListTypeArray } from './constants'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    mailAliasId: z.coerce.number().min(1),
    mailingListId: z.coerce.number().min(1),
    mailAddressExternalId: z.coerce.number().min(1),
    userId: z.coerce.number().min(1),
    groupId: z.coerce.number().min(1),
})

const paramsFieldSchemas = z.object({
    filter: z.enum(MailListTypeArray),
    id: z.coerce.number().min(1),
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
    params: {
        readMailTraversal: paramsFieldSchemas.pick({
            filter: true,
            id: true,
        }),
    },
}

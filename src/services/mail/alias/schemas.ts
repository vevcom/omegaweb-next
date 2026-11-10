import { mailAddressDataFieldSchemas } from '@/services/mail/address/schemas'
import { mailOwnerRequirements, mailParamsFieldSchemas } from '@/services/mail/schemas'
import { z } from 'zod'

/** The address is written as the address sub-service has it, and is its to store, see mail/address. */
const dataFieldSchemas = z.object({
    localPart: mailAddressDataFieldSchemas.shape.localPart,
    domain: mailAddressDataFieldSchemas.shape.domain,
    description: z.string(),
    ownerRequirements: mailOwnerRequirements,
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
    markOwnedByUserId: mailParamsFieldSchemas.shape.markOwnedByUserId,
    /** The user whose aliases are read. */
    userId: z.coerce.number().min(1),
})

const alias = paramsFieldSchemas.pick({
    id: true,
})

export const mailAliasSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            localPart: true,
            domain: true,
            description: true,
            ownerRequirements: true,
        }),
        updateDescription: dataFieldSchemas.pick({
            description: true,
        }),
    },
    params: {
        readMany: paramsFieldSchemas.pick({ markOwnedByUserId: true }),
        readReceived: paramsFieldSchemas.pick({ userId: true }),
        // The alias whose address the operations of `aliasMailAddressOperations` act on.
        mailAddress: alias,
        updateDescription: alias,
        visibility: alias,
        destroy: alias,
    },
}

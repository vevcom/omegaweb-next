import { validMailAddressDomains } from '@/services/mail/constants'
import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

/** What stands before the @ of an address of ours: letters and digits, with single . _ + - between them. */
export const MAIL_ADDRESS_LOCAL_PART = /^[a-z0-9]+([._+-][a-z0-9]+)*$/
export const MAIL_ADDRESS_LOCAL_PART_MAX_LENGTH = 64

/**
 * An address of ours as it is written: what stands before the @, and the domain picked from ours.
 * A service whose rows have an address picks these for its own forms, as the alias service does.
 */
export const mailAddressDataFieldSchemas = z.object({
    localPart: z.string().trim().toLowerCase()
        .min(1, 'Skriv inn det som skal stå foran @')
        .max(MAIL_ADDRESS_LOCAL_PART_MAX_LENGTH, `Maks ${MAIL_ADDRESS_LOCAL_PART_MAX_LENGTH} tegn foran @`)
        .regex(MAIL_ADDRESS_LOCAL_PART, 'Bare bokstaver, tall og . _ + - mellom dem'),
    domain: z.string().trim().toLowerCase().refine(
        domain => validMailAddressDomains().includes(domain),
        () => ({ message: `Domenet er ugyldig. Gyldige domener er: ${validMailAddressDomains().join(', ')}` }),
    ),
    forwardsToPrivateEmail: Zpn.checkboxOrBoolean({ label: 'Videresend til privat e-post' }),
})

const paramsFieldSchemas = z.object({
    mailAddressId: z.coerce.number().min(1),
})

const writtenAddress = mailAddressDataFieldSchemas.pick({
    localPart: true,
    domain: true,
})

const mailAddress = paramsFieldSchemas.pick({
    mailAddressId: true,
})

export const mailAddressSchemas = {
    data: {
        create: writtenAddress,
        update: writtenAddress,
        updateForwarding: mailAddressDataFieldSchemas.pick({
            forwardsToPrivateEmail: true,
        }),
    },
    params: {
        update: mailAddress,
        updateForwarding: mailAddress,
        destroy: mailAddress,
    },
}

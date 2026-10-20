import { standardLicenseNames } from './constants'
import { isSafeLink, safeLinkMessage } from '@/lib/fields/safeLink'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(
        5, 'Navn må være minst 5 tegn langt'
    ).max(
        50, 'Navn kan maks være 50 tegn langt'
    ),
    link: z.string().trim().min(
        1, 'Lenken kan ikke være tom'
    ).refine(isSafeLink, safeLinkMessage),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    standardLicenseName: z.enum(standardLicenseNames),
})

const license = dataFieldSchemas.pick({
    name: true,
    link: true,
})

const licenseId = paramsFieldSchemas.pick({
    id: true,
})

const standardLicenseName = paramsFieldSchemas.pick({
    standardLicenseName: true,
})

export const licenseSchemas = {
    data: {
        create: license,
        update: license.partial(),
    },
    params: {
        destroy: licenseId,
        update: licenseId,
        generateStandardLicense: standardLicenseName,
        readStandardLicense: standardLicenseName,
    },
}

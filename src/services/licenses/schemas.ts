import { standardLicenseNames } from './constants'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(
        5, 'Navn må være minst 5 tegn langt'
    ).max(
        50, 'Navn kan maks være 50 tegn langt'
    ),
    link: z.string().min(
        1, 'Link må være minst 1 tegn langt'
    )
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

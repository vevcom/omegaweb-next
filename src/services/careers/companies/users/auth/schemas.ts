import { z } from 'zod'

const dataFieldSchemas = z.object({
    email: z.string().trim().toLowerCase().email('Ugyldig e-postadresse')
        .max(200, 'Maks lengde er 200 tegn'),
    currentPassword: z.string().max(50).optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const id = paramsFieldSchemas.pick({ id: true })

export const companyUserAuthSchemas = {
    data: {
        registerNewEmail: dataFieldSchemas.pick({ email: true, currentPassword: true }),
        // Not an operation: what the login route takes, checked by companyUserIdOfCredentials.
        login: z.object({ email: z.string().min(1).max(200), password: z.string().min(1).max(50) }),
    },
    params: {
        sendPasswordLink: id,
        registerNewEmail: id,
    },
}

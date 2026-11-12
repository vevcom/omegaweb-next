import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    email: z.string().trim().toLowerCase().email('Ugyldig e-postadresse')
        .max(200, 'Maks lengde er 200 tegn'),
    firstname: z.string().trim().min(1, 'Fornavnet kan ikke være tomt').max(50, 'Maks lengde er 50 tegn'),
    lastname: z.string().trim().min(1, 'Etternavnet kan ikke være tomt').max(50, 'Maks lengde er 50 tegn'),
    admin: Zpn.checkboxOrBoolean({ label: 'Administrator' }),
    active: Zpn.checkboxOrBoolean({ label: 'Aktiv' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    companyId: z.number(),
})

const id = paramsFieldSchemas.pick({ id: true })
const companyId = paramsFieldSchemas.pick({ companyId: true })

export const companyUserSchemas = {
    data: {
        create: dataFieldSchemas.pick({ email: true, firstname: true, lastname: true, admin: true }),
        update: dataFieldSchemas.pick({ firstname: true, lastname: true }),
        updateRole: dataFieldSchemas.pick({ admin: true, active: true }),
    },
    params: {
        readOfCompany: companyId,
        read: id,
        create: companyId,
        update: id,
        updateRole: id,
        destroy: id,
    },
}

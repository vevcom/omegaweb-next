import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { JobType } from '@/prisma-generated-pn-types'
import { searchParamsFieldSchemas } from '@/services/search/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    companyId: z.coerce.number({
        errorMap: () => ({ message: 'Velg en bedrift' }),
    }).int().positive().int(),
    articleName: z.string().max(50, 'Maks lengde er 50 tegn').min(2, 'Minimum lengde er 2 tegn'),
    description: z.string().max(200, 'Maks lengde er 200 tegn').min(2, 'Minimum lengde er 2 tegn').or(z.literal('')),
    type: z.nativeEnum(JobType),
    applicationDeadline: Zpn.date({ label: 'Søknadsfrist' }),
    active: Zpn.checkboxOrBoolean({ label: 'Aktiv' }),
    location: z.string().optional(),
    rollingDueDate: Zpn.checkboxOrBoolean({ label: 'Løpende' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    jobAdId: z.number(),
    name: z.string().max(100).nullable(),
    type: z.nativeEnum(JobType).nullable(),
})

const id = paramsFieldSchemas.pick({
    id: true,
})

export const jobAdSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            companyId: true,
            articleName: true,
            description: true,
            type: true,
            applicationDeadline: true,
            location: true,
            rollingDueDate: true,
        }),
        update: dataFieldSchemas.partial().pick({
            companyId: true,
            description: true,
            type: true,
            applicationDeadline: true,
            active: true,
            location: true,
            rollingDueDate: true,
        }),
    },
    params: {
        read: id,
        search: searchParamsFieldSchemas.pick({ query: true, limit: true }),
        readInactivePage: readPageInputSchemaObject(
            id,
            paramsFieldSchemas.pick({
                name: true,
                type: true,
            }),
        ),
        update: id,
        updateArticle: paramsFieldSchemas.pick({
            jobAdId: true,
        }),
        destroy: id,
    },
}

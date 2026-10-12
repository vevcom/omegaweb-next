import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { JobType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const baseSchema = z.object({
    companyId: z.coerce.number({
        errorMap: () => ({ message: 'Velg en bedrift' }),
    }).int().positive().int(),
    articleName: z.string().max(50, 'max lengde 50').min(2, 'min lengde 2'),
    description: z.string().max(200, 'max lengde 200').min(2, 'min lengde 2').or(z.literal('')),
    type: z.nativeEnum(JobType),
    applicationDeadline: Zpn.date({ label: 'Søknadsfrist' }),
    active: Zpn.checkboxOrBoolean({ label: 'Aktiv' }),
    location: z.string().optional(),
})

export const jobAdSchemas = {
    create: baseSchema.pick({
        companyId: true,
        articleName: true,
        description: true,
        type: true,
        applicationDeadline: true,
        location: true,
    }),
    update: baseSchema.partial().pick({
        companyId: true,
        description: true,
        type: true,
        applicationDeadline: true,
        active: true,
        location: true,
    }),
    readInactivePage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.object({
            name: z.string().max(100).nullable(),
            type: z.nativeEnum(JobType).nullable(),
        }),
    ),
}

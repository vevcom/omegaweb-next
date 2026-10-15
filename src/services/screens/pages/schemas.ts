import { ScreenPageType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim()
        .min(2, 'Navnet må være minst 2 tegn langt')
        .max(50, 'Navnet kan maks være 50 tegn langt'),
    type: z.nativeEnum(ScreenPageType, {
        errorMap: () => ({ message: 'Velg en gyldig sidetype' }),
    }),
    jobAdId: z.coerce.number().int().optional(),
    eventId: z.coerce.number().int().optional(),
    eventTagId: z.coerce.number().int().optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    screenPageId: z.number(),
})

const id = paramsFieldSchemas.pick({
    id: true,
})

const implementation = paramsFieldSchemas.pick({
    screenPageId: true,
})

export const screenPageSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
        }),
        // A page links to exactly what its type shows, so the link the type needs is required and
        // the others are cleared.
        update: dataFieldSchemas.pick({
            name: true,
            type: true,
            jobAdId: true,
            eventId: true,
            eventTagId: true,
        })
            .refine(({ type, jobAdId }) => type !== 'JOBAD' || jobAdId !== undefined, {
                message: 'Velg en stillingsannonse',
                path: ['jobAdId'],
            })
            .refine(({ type, eventId }) => type !== 'EVENT' || eventId !== undefined, {
                message: 'Velg et arrangement',
                path: ['eventId'],
            })
            .refine(({ type, eventTagId }) => type !== 'EVENT_TAG' || eventTagId !== undefined, {
                message: 'Velg en tagg',
                path: ['eventTagId'],
            })
            .transform(({ name, type, jobAdId, eventId, eventTagId }) => ({
                name,
                type,
                jobAdId: type === 'JOBAD' ? jobAdId ?? null : null,
                eventId: type === 'EVENT' ? eventId ?? null : null,
                eventTagId: type === 'EVENT_TAG' ? eventTagId ?? null : null,
            })),
    },
    params: {
        read: id,
        update: id,
        updateCmsImage: implementation,
        updateCmsParagraphContent: implementation,
        destroy: id,
    },
}

import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(3, 'Navn må ha minst 3 tegn').max(30, 'Navn kan ha maks 30 tegn').trim(),
    description: z.string().max(200, 'Beskrivelse kan ha maks 200 tegn').trim(),
    color: Zpn.colorInput()
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const eventTag = dataFieldSchemas.pick({
    name: true,
    description: true,
    color: true,
})

const eventTagId = paramsFieldSchemas.pick({
    id: true,
})

export const eventTagSchemas = {
    data: {
        create: eventTag,
        update: eventTag.partial(),
    },
    params: {
        read: eventTagId,
        update: eventTagId,
        destroy: eventTagId,
    },
}

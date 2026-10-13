import { Zpn } from '@/lib/fields/zpn'
import { SpecialEventTags } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(3, 'Navn må ha minst 3 tegn').max(30, 'Navn kan ha maks 30 tegn').trim(),
    description: z.string().max(200, 'Beskrivelse kan ha maks 200 tegn').trim(),
    color: Zpn.colorInput()
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    special: z.nativeEnum(SpecialEventTags),
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
        readSpecial: paramsFieldSchemas.pick({
            special: true,
        }),
        update: eventTagId,
        destroy: eventTagId,
    },
}

import { reservedScreenNames } from './constants'
import { Zpn } from '@/lib/fields/zpn'
import { ScreenOrientation } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim()
        .min(2, 'Navnet må være minst 2 tegn langt')
        .max(50, 'Navnet kan maks være 50 tegn langt')
        .refine(name => !reservedScreenNames.includes(name), 'Navnet er reservert'),
    orientation: z.nativeEnum(ScreenOrientation, {
        errorMap: () => ({ message: 'Velg en gyldig retning' }),
    }),
    // In the order the screen shows them.
    pageIds: Zpn.numberListCheckboxFriendly({ label: 'Sider' })
        .refine(pageIds => new Set(pageIds).size === pageIds.length, 'En side kan bare vises én gang på en skjerm'),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    name: z.string(),
})

const id = paramsFieldSchemas.pick({
    id: true,
})

export const screenSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            orientation: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            orientation: true,
        }),
        updatePages: dataFieldSchemas.pick({
            pageIds: true,
        }),
    },
    params: {
        read: paramsFieldSchemas.pick({
            name: true,
        }),
        update: id,
        updatePages: id,
        destroy: id,
    },
}

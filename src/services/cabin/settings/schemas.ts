import { z } from 'zod'

const dataFieldSchemas = z.object({
    ledgerAccountId: z.number().nullable(),
})

export const cabinSettingsSchemas = {
    data: {
        update: dataFieldSchemas.pick({
            ledgerAccountId: true,
        }),
    },
}

import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    password: z.string().min(1, 'Skriv inn passordet'),
    releaseDate: Zpn.date({ label: 'Slippdato' }),
    openToAll: Zpn.checkboxOrBoolean({ label: 'Åpen for alle' }),
})

const password = dataFieldSchemas.pick({
    password: true,
})

export const releaseCountdownSchemas = {
    data: {
        unlock: password,
        updateSettings: dataFieldSchemas.pick({
            password: true,
            releaseDate: true,
            openToAll: true,
        }),
        updateGitGraph: password,
        mockGitGraph: password,
    },
}

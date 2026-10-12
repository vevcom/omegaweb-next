import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const password = z.string().min(1, 'Skriv inn passordet')

export const releaseCountdownSchemas = {
    unlock: z.object({ password }),
    updateSettings: z.object({
        password,
        releaseDate: Zpn.date({ label: 'Slippdato' }),
        openToAll: Zpn.checkboxOrBoolean({ label: 'Åpen for alle' }),
    }),
    updateGitGraph: z.object({ password }),
}

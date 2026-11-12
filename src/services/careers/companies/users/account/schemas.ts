import { z } from 'zod'

export const companyUserAccountSchemas = {
    params: {
        sendPasswordLink: z.object({ id: z.number() }),
    },
}

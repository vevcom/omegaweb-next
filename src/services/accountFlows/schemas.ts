import { siteNameSchema } from '@/lib/sites/site'
import { z } from 'zod'

/** The schemas every kind of account shares. The password is the kind's own, see `AccountKind`. */
export const accountSchemas = {
    data: {
        email: z.object({ email: z.string().trim().toLowerCase().max(200)
            .min(2)
            .email() }),
    },
    params: {
        token: z.object({ token: z.string() }),
        site: z.object({ site: siteNameSchema }),
    },
}

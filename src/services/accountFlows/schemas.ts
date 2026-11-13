import { siteNameSchema } from '@/lib/sites/site'
import { z } from 'zod'

const email = z.object({ email: z.string().trim().toLowerCase().max(200)
    .min(2)
    .email() })
const token = z.object({ token: z.string() })
const site = z.object({ site: siteNameSchema })

/** The schemas every kind of account shares. The password is the kind's own, see `AccountKind`. */
export const accountSchemas = {
    data: {
        sendResetPasswordEmail: email,
    },
    params: {
        verifyResetPasswordToken: token,
        resetPassword: token,
        sendResetPasswordEmail: site,
        verifyEmail: token,
    },
}

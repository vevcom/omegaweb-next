import { siteNameSchema } from '@/lib/sites/site'
import { userDataFieldSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const email = userDataFieldSchemas.pick({ email: true })
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

import ResetPasswordForm from './ResetPasswordForm'
import { authLinks } from './links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authOperations } from '@/services/auth/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { AuthPagesConfig } from './config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function resetPasswordFormPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams }: PageOperationArgs) => {
            const token = QueryParams.token.decode(searchParams)
            if (!token) return { token: null, valid: false }
            const verified = await withFallback(authOperations.verifyResetPasswordToken({ params: { token } }), null)
            return { token, valid: verified !== null }
        },
        metadata: () => ({ title: 'Nullstill passord' }),
        render: ({ data }) => {
            if (!data.token) {
                return <>
                    <h1>Ops</h1>
                    <p>Lenken er ufullstendig. Be om en ny lenke for å nullstille passordet.</p>
                </>
            }
            if (!data.valid) {
                return <>
                    <h1>Ops</h1>
                    <p>Lenken er ugyldig eller utløpt. Be om en ny lenke for å nullstille passordet.</p>
                </>
            }
            return <ResetPasswordForm token={data.token} loginPath={authLinks(config).login()} />
        },
    })
}

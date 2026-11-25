import { ResetPasswordForm } from '@/pageKits/auth/components/userAccountFlowComponents'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authOperations } from '@/services/auth/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function resetPasswordFormPage(config: AuthPagesConfig) {
    return serverPage({
        servedOn: 'auth-domain',
        allowUnregistered: true,
        operation: async ({ searchParams }: PageOperationArgs) => {
            const token = QueryParams.token.decode(searchParams)
            if (!token) return { token: null, valid: false, email: null }
            const verified = await withFallback(authOperations.verifyResetPasswordToken({ params: { token } }), null)
            return { token, valid: verified !== null, email: verified?.email ?? null }
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
            return <ResetPasswordForm config={config} token={data.token} email={data.email} />
        },
    })
}

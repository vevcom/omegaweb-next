import SendResetPasswordEmailForm from '@/pageKits/auth/components/SendResetPasswordEmailForm'
import { sendResetPasswordEmailAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

export function sendResetPasswordEmailPage(config: AuthPagesConfig) {
    return serverPage({
        servedOn: 'auth-domain',
        allowUnregistered: true,
        operation: () => ({}),
        metadata: () => ({ title: 'Glemt passord' }),
        render: () => (
            <SendResetPasswordEmailForm
                action={configureAction(sendResetPasswordEmailAction, { params: { site: config.site } })}
            />
        ),
    })
}

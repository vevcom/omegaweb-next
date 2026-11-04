import SendResetPasswordEmailForm from '@/pageKits/auth/components/SendResetPasswordEmailForm'
import { serverPage } from '@/app/ServerPage'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

export function sendResetPasswordEmailPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        operation: () => ({}),
        metadata: () => ({ title: 'Glemt passord' }),
        render: () => <SendResetPasswordEmailForm site={config.site} />,
    })
}

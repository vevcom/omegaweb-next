import SendResetPasswordEmailForm from './SendResetPasswordEmailForm'
import { serverPage } from '@/app/ServerPage'
import type { AuthPagesConfig } from './authPages'

export function sendResetPasswordEmailPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        operation: () => ({}),
        metadata: () => ({ title: 'Glemt passord' }),
        render: () => <SendResetPasswordEmailForm site={config.site} />,
    })
}

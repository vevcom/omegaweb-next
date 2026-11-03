import SessionReceiver from '@/pageKits/auth/components/SessionReceiver'
import { authLinks } from '@/pageKits/auth/links'
import { transferCallbackUrl } from '@/auth/nextAuth/sessionTransfer'
import { serverPage } from '@/app/ServerPage'
import { siteHref } from '@/app/siteContextOfRequest'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * Where a login another domain hands over arrives, see src/app/api/sso. A login carried over for
 * another domain goes back there either way. One asked for by this domain goes on to the login
 * form when the other domain had none to give.
 */
export function sessionTransferPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams }: PageOperationArgs) => {
            const ticket = typeof searchParams.ticket === 'string' ? searchParams.ticket : null
            const callbackUrl = transferCallbackUrl(
                typeof searchParams.callbackUrl === 'string' ? searchParams.callbackUrl : null
            ) ?? links.afterLogin()
            if (!callbackUrl.startsWith('/')) return { ticket, destination: callbackUrl, fallback: callbackUrl }
            return {
                ticket,
                destination: await siteHref(callbackUrl),
                fallback: await siteHref(links.login({ callbackUrl })),
            }
        },
        metadata: () => ({ title: 'Logger inn' }),
        render: ({ data }) => <SessionReceiver {...data} />,
    })
}

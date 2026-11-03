import VerifyEmail from './VerifyEmail'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { AuthPagesConfig } from './authPages'
import type { PageOperationArgs } from '@/app/ServerPage'

export function verifyEmailPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        // Only reads the token: opening the link confirms nothing. A mail scanner fetching it ahead of
        // the user would otherwise confirm the address and use up the token before they click.
        operation: ({ searchParams }: PageOperationArgs) => {
            const token = QueryParams.token.decode(searchParams)
            if (!token) notFound()
            return token
        },
        metadata: () => ({ title: 'Bekreft e-post' }),
        render: ({ data: token }) => <VerifyEmail config={config} token={token} />,
    })
}

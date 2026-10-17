import VerifyEmail from './VerifyEmail'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    allowUnregistered: true,
    // Only reads the token: opening the link confirms nothing. A mail scanner fetching it ahead of
    // the user would otherwise confirm the address and use up the token before they click.
    operation: async ({ searchParams }: PageOperationArgs) => {
        const token = QueryParams.token.decode(searchParams)
        if (!token) {
            notFound()
        }
        return token
    },
    metadata: () => ({ title: 'Bekreft e-post' }),
    render: ({ data: token }) => (
        <PageWrapper>
            <VerifyEmail token={token} />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

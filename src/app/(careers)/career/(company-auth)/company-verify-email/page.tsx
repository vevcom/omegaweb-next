import { VerifyEmail } from '@/app/(careers)/career/(company-auth)/companyUserAccountFlowComponents'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

/** Where the link sent to a company user's new email leads. */
const { page, generateMetadata } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => ({ token: QueryParams.token.decode(searchParams) }),
    metadata: () => ({ title: 'Bekreft e-post' }),
    render: ({ data }) => (data.token ? <VerifyEmail token={data.token} /> : <>
        <h1>Ops</h1>
        <p>Lenken er ufullstendig. Be om en ny fra siden til brukeren.</p>
    </>),
})

export default page
export { generateMetadata }

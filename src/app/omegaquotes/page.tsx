import OmegaquoteList from './OmegaquotesQuoteList'
import OmegaquoteQuote from './OmegaquotesQuote'
import CreateOmegaquoteForm from './CreateOmegaquoteForm'
import { OmegaquotePagingProvider } from '@/contexts/paging/OmegaquotesPaging'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { omegaquoteOperations } from '@/services/omegaquotes/operations'
import { omegaQuotesAuth } from '@/services/omegaquotes/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/serverPage'
import type { PageSizeOmegaquote } from '@/contexts/paging/OmegaquotesPaging'

const pageSize: PageSizeOmegaquote = 20

const { page, generateMetadata } = serverPage({
    operation: async () => omegaquoteOperations.readPage({
        params: {
            paging: {
                page: {
                    pageSize,
                    page: 0,
                    cursor: null,
                },
                details: undefined
            }
        }
    }),
    capabilities: (_, session) => ({
        canCreate: session.user ? omegaQuotesAuth.create.data({ userId: session.user.id }) : Require.user(),
    }),
    metadata: () => ({ title: 'Omegaquotes' }),
    render: ({ data: quotes, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canCreate.authorized && <CreateOmegaquoteForm/>
        }>
            <OmegaquotePagingProvider
                startPage={{
                    pageSize,
                    page: 1,
                }}
                details={undefined}
                serverRenderedData={quotes}
            >
                <main>
                    <OmegaquoteList
                        serverRendered={quotes.map(quote => <OmegaquoteQuote key={quote.id} quote={quote}/>)}
                    />
                </main>
            </OmegaquotePagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

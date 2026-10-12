import BullshitList from './BullshitList'
import Bullshit from './Bullshit'
import BullshitForm from './CreateBullshitForm'
import { BullshitPagingProvider } from '@/contexts/paging/BullshitPaging'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { bullshitOperations } from '@/services/bullshit/operations'
import { bullshitAuth } from '@/services/bullshit/auth'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageSizeBullshit } from '@/contexts/paging/BullshitPaging'

const pageSize: PageSizeBullshit = 20

const { page, generateMetadata } = serverPage({
    // Someone who may not read the page still gets it, empty - they may be allowed to create.
    operation: async () => withFallback(
        bullshitOperations.readPage({
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
        null,
        ['UNAUTHORIZED', 'UNAUTHENTICATED']
    ),
    capabilities: () => ({
        canCreate: bullshitAuth.create,
    }),
    metadata: () => ({ title: 'Bullshit' }),
    render: ({ data: bullshits, capabilities, session }) => (
        <PageWrapper headerItem={
            session.user && capabilities.canCreate.authorized && <BullshitForm />
        }>
            {bullshits && (
                <BullshitPagingProvider
                    // router.refresh() after a submit hands down a new first page, but the provider
                    // seeds its paging state from serverRenderedData only on mount. Keying on the
                    // first page remounts it, so a new quote cannot push one out of sight.
                    key={bullshits.map(bullshit => bullshit.id).join(',')}
                    startPage={{
                        pageSize,
                        page: 1,
                    }}
                    details={undefined}
                    serverRenderedData={bullshits}
                >
                    <main>
                        <BullshitList
                            serverRendered={bullshits.map(bullshit => <Bullshit key={bullshit.id} quote={bullshit} />)}
                        />
                    </main>
                </BullshitPagingProvider>
            )}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

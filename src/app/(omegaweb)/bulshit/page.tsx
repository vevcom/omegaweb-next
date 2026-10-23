import BulshitList from './BulshitList'
import Bulshit from './Bulshit'
import BulshitForm from './CreateBulshitForm'
import { BulshitPagingProvider } from '@/contexts/paging/BulshitPaging'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { bulshitOperations } from '@/services/bulshit/operations'
import { bulshitAuth } from '@/services/bulshit/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageSizeBulshit } from '@/contexts/paging/BulshitPaging'

const pageSize: PageSizeBulshit = 20

const { page, generateMetadata } = serverPage({
    // Someone who may not read the page still gets it, empty - they may be allowed to create.
    operation: async () => withFallback(
        bulshitOperations.readPage({
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
        canCreate: bulshitAuth.createOwn,
    }),
    metadata: () => ({ title: 'Bulshit' }),
    render: ({ data: bulshits, capabilities, session }) => (
        <PageWrapper headerItem={
            session.user && capabilities.canCreate.authorized && <BulshitForm bulshitPosterId={session.user.id} />
        }>
            {bulshits && (
                <BulshitPagingProvider
                    // router.refresh() after a submit hands down a new first page, but the provider
                    // seeds its paging state from serverRenderedData only on mount. Keying on the
                    // first page remounts it, so a new quote cannot push one out of sight.
                    key={bulshits.map(bulshit => bulshit.id).join(',')}
                    startPage={{
                        pageSize,
                        page: 1,
                    }}
                    details={undefined}
                    serverRenderedData={bulshits}
                >
                    <main>
                        <BulshitList
                            serverRendered={bulshits.map(bulshit => <Bulshit key={bulshit.id} quote={bulshit} />)}
                        />
                    </main>
                </BulshitPagingProvider>
            )}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

import AddNews from './AddNews'
import CurrentNews from './CurrentNews'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { newsAuth } from '@/services/news/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    capabilities: () => ({
        canCreate: newsAuth.create,
    }),
    metadata: () => ({ title: 'Nyheter' }),
    render: ({ capabilities }) => (
        <PageWrapper
            headerItem={
                <div className="flex items-center gap-[1em]">
                    <ArchiveLink href="news/archive" />
                    {
                        capabilities.canCreate.authorized && (
                            <AddHeaderItemPopUp title="Ny nyhet" popUpKey="createNewsPop">
                                <AddNews />
                            </AddHeaderItemPopUp>
                        )
                    }
                </div>
            }
        >
            <main className="image-card-list">
                <CurrentNews />
            </main>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

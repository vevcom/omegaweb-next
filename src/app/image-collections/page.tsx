import MakeNewCollection from './MakeNewCollection'
import ImageCollectionList from './ImageCollectionList'
import ToggleShowAdminCollections from './ToggleShowAdminCollections'
import { DynamicImageCollectionPagingProvider } from '@/contexts/paging/DynamicImageCollectionPaging'
import CollectionCardLink from '@/components/Image/Collection/CollectionCardLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import { dynamicImageOperations } from '@/services/images/dynamic/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'
import type { PageSizeDynamicImageCollection } from '@/contexts/paging/DynamicImageCollectionPaging'

const pageSize: PageSizeDynamicImageCollection = 12

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const showOnlyCollectionsSessionAdministrates =
            QueryParams.onlyAdministratedCollections.decode(searchParams) ?? false
        const details = { showOnlyCollectionsSessionAdministrates }

        const collections = await dynamicImageOperations.readCollectionPage({
            params: {
                paging: {
                    page: {
                        pageSize,
                        page: 0,
                        cursor: null,
                    },
                    details,
                },
            },
        })

        return { collections, details, showOnlyCollectionsSessionAdministrates }
    },
    capabilities: () => ({
        canCreateCollection: dynamicImageAuth.createCollection,
    }),
    metadata: () => ({ title: 'Fotogalleri' }),
    render: ({ data, capabilities }) => (
        <PageWrapper headerItem={capabilities.canCreateCollection.authorized && <MakeNewCollection />}>
            <DynamicImageCollectionPagingProvider
                startPage={{
                    pageSize,
                    page: 1,
                }}
                details={data.details}
                serverRenderedData={data.collections}
            >
                <ImageCollectionList
                    toggle={
                        <ToggleShowAdminCollections
                            showOnlyCollectionsSessionAdministrates={data.showOnlyCollectionsSessionAdministrates}
                        />
                    }
                    serverRendered={data.collections.map(collection => (
                        <CollectionCardLink key={collection.id} collection={collection} />
                    ))}
                />
            </DynamicImageCollectionPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

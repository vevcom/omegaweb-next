import DynamicCollectionPanel from './DynamicCollectionPanel'
import { dynamicImageOperations } from '@/services/images/dynamic/operations'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ name: string }>) => {
        const collectionName = decodeURIComponent(params.name)

        const collection = await dynamicImageOperations.readCollection({ params: { collectionName } })

        // Readable only by those who administrate the collection - a visitor without that access
        // simply gets no admin controls.
        const doubleLevelVisibility = await withFallback(
            dynamicImageOperations.visibility.readDoubleLevelMatrix({
                params: { collectionId: collection.id }
            }),
            null
        )

        return { collection, doubleLevelVisibility }
    },
    metadata: (data) => ({ title: data.collection.name }),
    // The page chrome lives in DynamicCollectionPanel: the admin controls go in the wrapper's
    // header slot and the image panel they refresh in its body, so both have to be rendered from
    // the same client component.
    render: ({ data }) => (
        <DynamicCollectionPanel
            collection={data.collection}
            doubleLevelVisibility={data.doubleLevelVisibility}
        />
    ),
})

export default page
export { generateMetadata }

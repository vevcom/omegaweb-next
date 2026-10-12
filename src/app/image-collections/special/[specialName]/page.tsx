import styles from './page.module.scss'
import SpecialCollectionPanel from './SpecialCollectionPanel'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { specialImagePanelOperations } from '@/services/images/specialPanels/operations'
import { serverPage } from '@/app/serverPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'
import type { SpecialCollection } from '@/prisma-generated-pn-types'

/**
 * The read operation for each special collection, keyed by the `SpecialCollection` the route
 * addresses (the operations object keys them by camelCase name).
 */
const collectionOperations = {
    FLAIRIMAGES: specialImagePanelOperations.flairImages,
    OMBULCOVERS: specialImagePanelOperations.ombulCovers,
    COMMITTEELOGOS: specialImagePanelOperations.committeeLogos,
    PROFILEIMAGES: specialImagePanelOperations.profileImages,
    PROMOIMAGES: specialImagePanelOperations.promoImages,
    STANDARDIMAGES: specialImagePanelOperations.standardImages,
} as const satisfies Record<SpecialCollection, unknown>

const isSpecialCollection = (value: string): value is SpecialCollection =>
    Object.keys(collectionOperations).includes(value)

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ specialName: string }>) => {
        const specialName = decodeURIComponent(params.specialName)
        if (!isSpecialCollection(specialName)) notFound()

        const collection = await collectionOperations[specialName].readCollection({})
        return { specialName, collection }
    },
    metadata: (data) => ({ title: data.collection.name }),
    render: ({ data }) => (
        <PageWrapper>
            {data.collection.description && <p className={styles.description}>{data.collection.description}</p>}
            <main>
                <SpecialCollectionPanel special={data.specialName} />
            </main>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

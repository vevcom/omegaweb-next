import SpecialCollectionPanel from './SpecialCollectionPanel'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { specialImagePanelOperations } from '@/services/images/specialPanels/operations'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { SpecialCollection } from '@/prisma-generated-pn-types'

const isSpecialCollection = (value: string): value is SpecialCollection =>
    Object.keys(specialImagePanelOperations).includes(value)

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ specialName: string }>) => {
        const specialName = decodeURIComponent(params.specialName)
        if (!isSpecialCollection(specialName)) notFound()

        const collection = await specialImagePanelOperations[specialName].readCollection({})
        return { specialName, collection }
    },
    metadata: (data) => ({ title: data.collection.name }),
    render: ({ data }) => (
        <PageWrapper>
            {data.collection.description && (
                <p className="block text-m text-base-content/80 mb-4">{data.collection.description}</p>
            )}
            <main>
                <SpecialCollectionPanel special={data.specialName} />
            </main>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

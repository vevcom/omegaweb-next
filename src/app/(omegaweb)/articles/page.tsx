import AddCategory from './AddCategory'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ImageCard from '@/components/ImageCard/ImageCard'
import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'

const { page, generateMetadata } = serverPage({
    operation: async () => articleCategoryOperations.readAll({}),
    capabilities: () => ({
        canCreate: articleCategoryAuth.create,
    }),
    metadata: () => ({ title: 'Artikler' }),
    render: ({ data: categories, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canCreate.authorized && (
                <AddHeaderItemPopUp popUpKey="CreateCategory">
                    <AddCategory />
                </AddHeaderItemPopUp>
            )
        }>
            <main className="image-card-list">
                {
                    categories.length ? (
                        categories.map((category) => (
                            <ImageCard
                                key={category.id}
                                title={category.name}
                                href={`/articles/${category.name}`}
                                image={category.coverImage}
                            >
                                {category.description}
                            </ImageCard>
                        ))
                    ) : (
                        <i>
                                Ingen kategorier å vise
                        </i>
                    )
                }
            </main>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

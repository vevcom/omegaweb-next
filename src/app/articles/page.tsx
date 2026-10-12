import styles from './page.module.scss'
import AddCategory from './AddCategory'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ImageCard from '@/components/ImageCard/ImageCard'
import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'

const { page, generateMetadata } = serverPage({
    operation: async () => articleCategoryOperations.readAll({}),
    metadata: () => ({ title: 'Artikler' }),
    render: ({ data: categories }) => {
        //TODO: add can create categoies permission
        const canCreateArticleCategories = true //temp

        return (
            <PageWrapper headerItem={
                canCreateArticleCategories && (
                    <AddHeaderItemPopUp popUpKey="CreateCategory">
                        <AddCategory />
                    </AddHeaderItemPopUp>
                )
            }>
                <main className={styles.wrapper}>
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
        )
    },
})

export default page
export { generateMetadata }

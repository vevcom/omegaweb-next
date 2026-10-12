import styles from './layout.module.scss'
import SideBar from './SideBar'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { serverLayout } from '@/app/serverPage'
import type { LayoutOperationArgs } from '@/app/serverPage'

export default serverLayout({
    operation: async ({ params }: LayoutOperationArgs<{ category: string }>) =>
        articleCategoryOperations.read({ params: { name: decodeURIComponent(params.category) } }),
    render: ({ data: category, children }) => (
        <div className={styles.wrapper}>
            {/* These routes do not go through PageWrapper, so the nav's title has to be set here -
                in the layout, so it covers both the category page and the articles under it. */}
            <PageTitleSetter title={category.name} />
            <SideBar category={category}>
                {children}
            </SideBar>
        </div>
    ),
})

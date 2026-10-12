import styles from './layout.module.scss'
import SlideSidebar from './SlideSidebar'
import { visibleAdminNav } from '@/app/admin/adminNavDef'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { serverLayout } from '@/app/serverPage'
import type { LayoutOperationArgs } from '@/app/serverPage'

export default serverLayout({
    // Only what the sidebar renders crosses into it - the authorizers stay on the server.
    operation: async ({ session }: LayoutOperationArgs) => visibleAdminNav(session).map(group => ({
        header: group.header,
        links: group.links.map(({ title, path }) => ({ title, path })),
    })),
    render: ({ data: navigation, children }) => (
        <div className={styles.wrapper}>
            <PageTitleSetter title={'Admin'} />
            <div className={styles.slideBar}>
                <SlideSidebar navigation={navigation} />
            </div>
            <div className={styles.content}>
                { children }
            </div>
        </div>
    ),
})

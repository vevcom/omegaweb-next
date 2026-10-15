import SlideSidebar from './SlideSidebar'
import { visibleAdminNav } from '@/app/admin/adminNavDef'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    // Only what the sidebar renders crosses into it - the authorizers stay on the server.
    operation: ({ session }: LayoutOperationArgs) => visibleAdminNav(session).map(group => ({
        header: group.header,
        links: group.links.map(({ title, path }) => ({ title, path })),
    })),
    render: ({ data: navigation, children }) => (
        <div className="max-w-full flex flex-row relative p-0 max-mobile:h-[calc(100dvh-60px)]">
            <PageTitleSetter title={'Admin'} />
            <div className="bg-surface-base rounded-round self-start sticky max-mobile:static">
                <SlideSidebar navigation={navigation} />
            </div>
            <div
                className={[
                    'bg-surface-base grow min-w-0 ml-2 p-2 rounded-round overflow-y-auto h-[calc(100dvh-64px-26px)]',
                    'max-mobile:m-0 max-mobile:h-[calc(100dvh-128px)]',
                ].join(' ')}
            >
                { children }
            </div>
        </div>
    ),
})

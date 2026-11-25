import SlideSidebar from './SlideSidebar'
import { adminNavDef } from '@/app/(omegaweb)/admin/adminNavDef'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: ({ session }: LayoutOperationArgs) => adminNavDef.visible(session),
    render: ({ data: navigation, children }) => (
        <div className="max-w-full grow min-h-0 flex flex-row relative p-0">
            <PageTitleSetter title={'Administrasjon'} />
            <div className="bg-base-100 text-base-content rounded-round flex flex-col">
                <SlideSidebar navigation={navigation} />
            </div>
            <div
                className="
                    bg-base-100 grow min-w-0 ml-2 p-2 rounded-round overflow-y-auto
                    max-mobile:m-0
                "
            >
                { children }
            </div>
        </div>
    ),
})

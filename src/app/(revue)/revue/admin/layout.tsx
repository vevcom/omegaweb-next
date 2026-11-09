import RevueAdminSidebar from './RevueAdminSidebar'
import { revueAdminNavDef } from '@/app/(revue)/revue/admin/revueAdminNavDef'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: ({ session }: LayoutOperationArgs) => revueAdminNavDef.visible(session),
    render: ({ data: links, children }) => (
        <div className="
            flex gap-8
            max-mobile:flex-col max-mobile:gap-4
        ">
            <aside className="
                w-[250px] shrink-0 self-start sticky top-24
                max-mobile:static max-mobile:w-full
            ">
                <RevueAdminSidebar links={links} />
            </aside>
            <div className="grow min-w-0">
                {children}
            </div>
        </div>
    ),
})

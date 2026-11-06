import CareerAdminSidebar from './CareerAdminSidebar'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: ({ session }: LayoutOperationArgs) => careerAdminNavDef.visible(session),
    render: ({ data: links, children }) => (
        <div className="
            flex gap-8 py-8
            max-mobile:flex-col max-mobile:gap-4
        ">
            <aside className="
                w-[250px] shrink-0 self-start sticky top-8
                max-mobile:static max-mobile:w-full
            ">
                <CareerAdminSidebar links={links} />
            </aside>
            <div className="
                grow min-w-0 p-8 bg-surface-raised border border-careers-line
                max-mobile:p-6
            ">
                {children}
            </div>
        </div>
    ),
})

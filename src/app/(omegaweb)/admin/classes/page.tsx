import BumpClasses from './BumpClasses'
import { classOperations } from '@/services/groups/classes/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { classAuth } from '@/services/groups/classes/auth'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import GroupTypeTable from '@/components/Group/GroupTypeTable'
import { CLASS_LEVEL_ORDERING } from '@/services/groups/constants'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('classes', session)
        const [classRows, expandedClasses, currentOrder] = await Promise.all([
            classOperations.readMany({}),
            classOperations.readExpanded({}),
            omegaOrderOperations.readCurrent({}),
        ])
        return { classRows, expandedClasses, currentOrder }
    },
    capabilities: () => ({
        canBump: classAuth.bumpClasses,
    }),
    metadata: () => ({ title: 'Klasser' }),
    render: ({ data, capabilities }) => {
        // The expanded groups carry the name, member count and order; the class rows carry the level.
        // Joining them on the group id lets the table be listed in the order students move through.
        // A class is not administered per group, so no row links anywhere.
        const rows = CLASS_LEVEL_ORDERING.flatMap(level => {
            const classRow = data.classRows.find(row => row.level === level)
            const expanded = classRow && data.expandedClasses.find(group => group.id === classRow.groupId)
            return expanded ? [{
                key: level,
                name: expanded.name,
                order: expanded.order,
                members: expanded.members,
            }] : []
        })

        return (
            <PageWrapper>
                <GroupTypeTable rows={rows} currentOrder={data.currentOrder.order} nameHeading="Klasse" />

                <div className="flex flex-col gap-2 mt-6">
                    <p className="text-text-muted max-w-[70ch]">
                        Klassene følger ordenen til Omega automatisk. Når Omega har blitt inkrementert må
                        klassene rykkes opp: alle studenter flyttes én klasse opp, og uteksaminerte beholder
                        medlemskapet sitt. Dette må gjøres før Omega kan inkrementeres på nytt.
                    </p>
                    {capabilities.canBump.authorized && <BumpClasses />}
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

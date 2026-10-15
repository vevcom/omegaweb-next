import { committeeOperations } from '@/services/groups/committees/operations'
import getCommittee from '@/app/committees/[shortName]/getCommittee'
import { serverPage } from '@/app/ServerPage'
import UserCard from '@/components/User/UserCard'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const members = await committeeOperations.readMembers({
            params: {
                groupId: committee.groupId,
            }
        })
        return members
    },
    render: ({ data: members }) => {
        const membersGroupedByOrder = members.reduce((acc, member) => {
            const order = member.order
            if (!acc[order]) {
                acc[order] = []
            }
            acc[order].push(member)
            return acc
        }, {} as Record<number, typeof members>)

        const ordersSorted = Object.keys(membersGroupedByOrder)
            .sort((orderOne, orderTwo) => parseInt(orderTwo, 10) - parseInt(orderOne, 10))

        return <div>
            <h2>Historiske medlemsskap</h2>

            {ordersSorted.map((order) =>
                <div key={order}>
                    <h3 className="text-center text-l">{order}. Orden</h3>
                    <hr />
                    <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-2">
                        {membersGroupedByOrder[parseInt(order, 10)].map((member, i) => (
                            <UserCard
                                key={i}
                                user={member.user}
                                subText={member.title}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    },
})

export default page
export { generateMetadata }

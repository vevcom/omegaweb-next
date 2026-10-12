import styles from './page.module.scss'
import getCommittee from './getCommittee'
import { updateCommitteeParagraphAction } from '@/services/groups/committees/actions'
import { committeeOperations } from '@/services/groups/committees/operations'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import UserCard from '@/components/User/UserCard'
import { configureAction } from '@/services/configureAction'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

export type PropTypes = {
    params: Promise<{
        shortName: string
    }>
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)

        const [paragraph, members] = await Promise.all([
            committeeOperations.readParagraph({ params: { shortName: committee.shortName } }),
            committeeOperations.readMembers({
                params: {
                    groupId: committee.groupId,
                    active: true,
                },
            }),
        ])

        return { committee, paragraph, members }
    },
    capabilities: (data) => ({
        canEditCommitteeParagraph: committeeAuth.updateParagraphContent.data({
            groupId: data.committee.groupId,
        }),
    }),
    metadata: (data) => ({ title: data.committee.name }),
    render: ({ data, capabilities }) => (
        <div className={styles.wrapper}>
            <CmsParagraph
                capabilities={{ canEdit: capabilities.canEditCommitteeParagraph }}
                cmsParagraph={data.paragraph}
                updateCmsParagraphAction={configureAction(
                    updateCommitteeParagraphAction,
                    { implementationParams: { shortName: data.committee.shortName } }
                )}
            />

            <h2>Komitémedlemmer</h2>
            <div className={styles.memberList}>
                {data.members.map((member, i) => <UserCard
                    key={i}
                    user={member.user}
                    subText={member.title}
                />)}
            </div>
        </div>
    ),
})

export default page
export { generateMetadata }

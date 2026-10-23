import getCommittee from '@/app/(omegaweb)/committees/[shortName]/getCommittee'
import Image from '@/components/Image/Image'
import ImageUploader from '@/components/Image/ImageUploader'
import MigrateGroup from '@/components/Group/MigrateGroup'
import ManageGroupMembers from '@/components/Group/ManageGroupMembers'
import PensionGroup from '@/components/Group/PensionGroup'
import { groupMembersByOrder } from '@/components/Group/groupMembersByOrder'
import { configureAction } from '@/services/configureAction'
import {
    addCommitteeMembersAction,
    migrateCommitteeAction,
    removeCommitteeMembersAction,
    setCommitteeMemberAdminAction,
    setCommitteeMemberTitleAction,
    pensionCommitteeAction,
    updateCommitteeLogoAction,
} from '@/services/groups/committees/actions'
import { committeeOperations } from '@/services/groups/committees/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const sectionClassName = `
    flex flex-col gap-4 p-4 rounded-round layer
    [&>h3]:m-0 [&>h3]:pb-2 [&>h3]:border-b [&>h3]:border-surface-hover [&>h3]:text-l [&>h3]:font-bold
`

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)

        // Every membership, not just the active ones of the current order: the management UI can
        // address any order the committee has memberships in.
        const [expandedGroups, members, currentOrder] = await Promise.all([
            committeeOperations.readExpanded({}),
            committeeOperations.readMembers({ params: { groupId: committee.groupId } }),
            omegaOrderOperations.readCurrent({}),
        ])

        const expanded = expandedGroups.find(group => group.id === committee.groupId)

        return { committee, expanded, members, currentOrder }
    },
    capabilities: (data) => ({
        canEditLogo: committeeAuth.updateLogo.data({ groupId: data.committee.groupId }),
        canMigrate: committeeAuth.migrateGroup.data({ groupId: data.committee.groupId }),
        canAddMembers: committeeAuth.addMembers.data({ groupId: data.committee.groupId }),
        canSetMemberAdmin: committeeAuth.setMemberAdmin.data({ groupId: data.committee.groupId }),
        canSetMemberTitle: committeeAuth.setMemberTitle.data({ groupId: data.committee.groupId }),
        canRemoveMembers: committeeAuth.removeMembers.data({ groupId: data.committee.groupId }),
        canPension: committeeAuth.pension,
    }),
    metadata: (data) => ({ title: `Administrer ${data.committee.name}` }),
    render: ({ data, capabilities }) => {
        const { committee, expanded, members, currentOrder } = data

        // Only the active members of the committee's own order can be carried into the next one.
        const membersOfGroupOrder = members.filter(
            member => member.active && member.order === expanded?.order
        )

        return (
            <div className="flex flex-col gap-6 min-h-[500px]">
                <header className="
                    flex flex-col gap-2
                    [&_h2]:m-0
                ">
                    <h2>Administrer {committee.name}</h2>
                    <div className="flex flex-wrap gap-6 text-text-muted text-s">
                        <span>Kortnavn: {committee.shortName}</span>
                        {expanded && <span>Orden: {expanded.order}</span>}
                        {expanded && <span>Aktive medlemmer: {expanded.members}</span>}
                    </div>
                </header>

                {!committee.group.pensioned && <section className={sectionClassName}>
                    <h3>Logo</h3>
                    <div className="
                        grid grid-cols-[auto_minmax(16rem,24rem)] items-start gap-6
                        max-mobile:grid-cols-1
                    ">
                        <Image image={committee.logoImage} width={300} />
                        {
                            capabilities.canEditLogo.authorized && (
                                <ImageUploader
                                    title="Endre komitelogo"
                                    refreshOnSuccess
                                    uploadImageAction={configureAction(
                                        updateCommitteeLogoAction,
                                        { params: { shortName: committee.shortName } }
                                    )}
                                />
                            )
                        }
                    </div>
                </section>}

                {capabilities.canPension.authorized && (
                    <section className={sectionClassName}>
                        <h3>Pensjonering</h3>
                        <PensionGroup
                            groupId={committee.groupId}
                            groupName={committee.name}
                            pensioned={committee.group.pensioned}
                            currentOmegaOrder={currentOrder.order}
                            pensionGroupAction={pensionCommitteeAction}
                        />
                    </section>
                )}

                {!committee.group.pensioned && expanded
                    && (capabilities.canAddMembers.authorized || capabilities.canRemoveMembers.authorized) && (
                    <section className={sectionClassName}>
                        <h3>Medlemmer</h3>
                        <ManageGroupMembers
                            groupId={committee.groupId}
                            groupOrder={expanded.order}
                            orders={groupMembersByOrder(members, expanded.order)}
                            addMembersAction={
                                capabilities.canAddMembers.authorized ? addCommitteeMembersAction : undefined
                            }
                            setMemberAdminAction={
                                capabilities.canSetMemberAdmin.authorized ? setCommitteeMemberAdminAction : undefined
                            }
                            setMemberTitleAction={
                                capabilities.canSetMemberTitle.authorized ? setCommitteeMemberTitleAction : undefined
                            }
                            removeMembersAction={
                                capabilities.canRemoveMembers.authorized ? removeCommitteeMembersAction : undefined
                            }
                        />
                    </section>
                )}

                {!committee.group.pensioned && capabilities.canMigrate.authorized && expanded && (
                    <section className={sectionClassName}>
                        <h3>Migrering</h3>
                        <MigrateGroup
                            groupId={committee.groupId}
                            groupOrder={expanded.order}
                            currentOmegaOrder={currentOrder.order}
                            candidates={membersOfGroupOrder.map(member => ({
                                userId: member.userId,
                                name: `${member.user.firstname} ${member.user.lastname}`,
                                title: member.title,
                                admin: member.admin,
                            }))}
                            migrateGroupAction={migrateCommitteeAction}
                        />
                    </section>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }

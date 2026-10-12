import styles from './page.module.scss'
import {
    addStudyProgrammeMembersAction,
    removeStudyProgrammeMembersAction,
} from '@/services/groups/studyProgrammes/actions'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import ManageGroupMembers from '@/components/Group/ManageGroupMembers'
import { groupMembersByOrder } from '@/components/Group/groupMembersByOrder'
import { ClassLevelConfig } from '@/services/groups/constants'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

/**
 * Administers one study programme's members.
 *
 * Membership normally follows what Feide reports about a user, so this is the exception rather than
 * the rule - someone on a programme Feide does not know about, or someone who should not be on one.
 * A member removed here stays removed: Feide only acts on a programme the first time it reports it.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ id: string }>) => {
        const id = Number(params.id)
        if (!Number.isInteger(id)) notFound()

        const studyProgramme = await studyProgrammeOperations.read({ params: { id } })

        const [expandedGroups, members] = await Promise.all([
            studyProgrammeOperations.readExpanded({}),
            studyProgrammeOperations.readMembers({ params: { groupId: studyProgramme.groupId } }),
        ])

        const expanded = expandedGroups.find(group => group.id === studyProgramme.groupId)
        if (!expanded) notFound()

        return { studyProgramme, expanded, members }
    },
    capabilities: (data) => ({
        canAddMembers: studyProgrammeAuth.addMembers.data({
            groupId: data.studyProgramme.groupId,
        }),
        canRemoveMembers: studyProgrammeAuth.removeMembers.data({
            groupId: data.studyProgramme.groupId,
        }),
    }),
    metadata: (data) => ({ title: data.studyProgramme.name }),
    render: ({ data, capabilities }) => {
        const { studyProgramme, expanded, members } = data

        return (
            <PageWrapper>
                <div className={styles.wrapper}>
                    <div className={styles.facts}>
                        <span>Kode: {studyProgramme.code}</span>
                        <span>Orden: {expanded.order}</span>
                        <span>Aktive medlemmer: {expanded.members}</span>
                        <span>
                            Startklasse: {studyProgramme.classLevel
                                ? ClassLevelConfig[studyProgramme.classLevel].name
                                : 'Ikke satt'}
                        </span>
                    </div>

                    <p className={styles.explanation}>
                        Medlemskap følger normalt det Feide melder om brukeren. Legger du til eller fjerner
                        noen her, blir det stående: Feide legger bare til et studieprogram første gang det
                        blir meldt for brukeren.
                    </p>

                    {(capabilities.canAddMembers.authorized || capabilities.canRemoveMembers.authorized) && (
                        <ManageGroupMembers
                            groupId={studyProgramme.groupId}
                            groupOrder={expanded.order}
                            orders={groupMembersByOrder(members, expanded.order)}
                            addMembersAction={
                                capabilities.canAddMembers.authorized ? addStudyProgrammeMembersAction : undefined
                            }
                            removeMembersAction={
                                capabilities.canRemoveMembers.authorized ? removeStudyProgrammeMembersAction : undefined
                            }
                        />
                    )}
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

'use client'
import styles from './ManageUserStudyProgrammes.module.scss'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import {
    addStudyProgrammeMembersAction,
    removeStudyProgrammeMembersAction,
} from '@/services/groups/studyProgrammes/actions'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useState } from 'react'

export type StudyProgrammeOption = {
    id: number,
    groupId: number,
    name: string,
    code: string,
}

type PropTypes = {
    userId: number,
    /** Every study programme there is - what the user may be put into. */
    studyProgrammes: StudyProgrammeOption[],
    /**
     * The user's active study programme memberships, each with the order it sits in.
     *
     * The order is needed to remove one: study programmes follow omega automatically, so the group
     * moves on at an increment while the membership stays in the order it was granted. Removing
     * without saying which order would address the group's current one, where there is nothing.
     */
    memberships: { groupId: number, order: number }[],
}

function RemoveStudyProgrammeMembershipForm({ userId, programme }: {
    userId: number,
    programme: StudyProgrammeOption & { order: number },
}) {
    const canRemove = useAuthorizer({
        authorizer: studyProgrammeAuth.removeMembers.data({ groupId: programme.groupId })
    }).authorized
    if (!canRemove) return null

    return (
        <Form
            className={styles.removeForm}
            submitText="Fjern"
            submitColor="red"
            action={() => configureAction(
                removeStudyProgrammeMembersAction,
                { params: { groupId: programme.groupId, order: programme.order } }
            )({ data: { userIds: [userId] } })}
            refreshOnSuccess
            confirmation={{
                confirm: true,
                text: `Fjerne brukeren fra ${programme.name}? `
                    + 'Medlemskapet blir satt inaktivt, og Feide legger det ikke til igjen.',
            }}
        />
    )
}

function AddStudyProgrammeMembershipForm({ userId, available }: {
    userId: number,
    available: StudyProgrammeOption[],
}) {
    const [groupIdToAdd, setGroupIdToAdd] = useState(available[0].groupId)
    const canAdd = useAuthorizer({
        authorizer: studyProgrammeAuth.addMembers.data({ groupId: groupIdToAdd })
    }).authorized
    if (!canAdd) return null

    return (
        <Form
            className={styles.addForm}
            submitText="Legg til"
            action={() => configureAction(
                addStudyProgrammeMembersAction, { params: { groupId: groupIdToAdd } }
            )({ data: { users: [{ userId, admin: false }] } })}
            refreshOnSuccess
        >
            <SelectNumber
                name="studyProgramme"
                label="Legg til studieprogram"
                value={groupIdToAdd}
                onChange={setGroupIdToAdd}
                options={available.map(programme => ({
                    value: programme.groupId,
                    label: `${programme.name} (${programme.code})`,
                    key: `${programme.id}`,
                }))}
            />
        </Form>
    )
}

/**
 * Puts a user on a study programme or takes them off it by hand.
 *
 * Membership normally follows what Feide reports, but Feide is not the whole truth - a user may be
 * on a programme it does not know about. Removing one sticks: Feide only ever adds a programme the
 * first time it reports it, so it will not undo this at the next login.
 */
export default function ManageUserStudyProgrammes({
    userId,
    studyProgrammes,
    memberships,
}: PropTypes) {
    const memberOf = memberships.flatMap(membership => {
        const programme = studyProgrammes.find(option => option.groupId === membership.groupId)
        return programme ? [{ ...programme, order: membership.order }] : []
    })
    const memberOfGroupIds = new Set(memberships.map(membership => membership.groupId))
    const available = studyProgrammes.filter(programme => !memberOfGroupIds.has(programme.groupId))

    return (
        <div className={styles.ManageUserStudyProgrammes}>
            <h2>Studieprogram</h2>

            {memberOf.length === 0 ? (
                <p className={styles.empty}>Brukeren står ikke på noe studieprogram.</p>
            ) : (
                <div className={styles.programmes}>
                    {memberOf.map(programme => (
                        <div className={styles.programme} key={`${programme.id}-${programme.order}`}>
                            <span>{programme.name} ({programme.code})</span>
                            <RemoveStudyProgrammeMembershipForm userId={userId} programme={programme} />
                        </div>
                    ))}
                </div>
            )}

            {available.length > 0 && (
                <AddStudyProgrammeMembershipForm userId={userId} available={available} />
            )}
        </div>
    )
}

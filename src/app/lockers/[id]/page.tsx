import styles from './page.module.scss'
import LockerNotFound from './LockerNotFound'
import CreateLockerReservationForm from './CreateLockerReservationForm'
import UpdateLockerReservationForm from './UpdateLockerReservationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import BackLink from '@/components/HeaderItems/BackLink'
import { lockerOperations } from '@/services/lockers/operations'
import { groupOperations } from '@/services/groups/operations'
import { lockerReservationAuth } from '@/services/lockers/reservations/auth'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import { displayDate } from '@/lib/dates/displayDate'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ id: string }>) => {
        const lockerId = parseInt(params.id, 10)

        // A missing locker renders its own view rather than the not-found page - and so does an id
        // that is not a number, which the read turns down as BAD PARAMETERS. Every other failure
        // (not logged in, no access to lockers) is left for serverPage to handle.
        const locker = await withFallback(
            lockerOperations.read({ params: { id: lockerId } }),
            null,
            ['NOT FOUND', 'BAD PARAMETERS']
        )
        if (!locker) {
            return { lockerId, locker: null, groupsFormData: [], user: null } as const
        }

        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        const groups = await groupOperations.readGroupsOfUser.internalCall({
            params: {
                userId: user.id,
            },
        })

        // Groups the user has left are not offered: reserving on behalf of a group takes an active membership.
        const groupsFormData = groups.filter(group => lockerReservationAuth.create.data({
            userId: user.id,
            groupId: group.id,
        }).auth(session).authorized).map(group => {
            const name = inferGroupName(group)
            return { value: group.id.toString(), label: name }
        })

        return { lockerId, locker, groupsFormData, user } as const
    },
    capabilities: (data) => ({
        canCreateReservation: data.user
            ? lockerReservationAuth.create.data({ userId: data.user.id, groupId: null })
            : Require.user(),
        canUpdateReservation: data.locker?.LockerReservation.length
            ? lockerReservationAuth.update.data({ userId: data.locker.LockerReservation[0].user.id, groupId: null })
            : Require.custom(() => false, { errorMessage: 'Skapet er ikke reservert.' }),
    }),
    metadata: (data) => ({ title: data.locker ? `Skap ${data.lockerId}` : 'Skap' }),
    render: ({ data, capabilities }) => {
        const header = <BackLink href="/lockers" label="Alle skap" />

        if (!data.locker) {
            return (
                <PageWrapper headerItem={header}>
                    <div className={styles.locker}>
                        <LockerNotFound />
                    </div>
                </PageWrapper>
            )
        }
        const { lockerId, locker, groupsFormData, user } = data
        const reservation = locker.LockerReservation.at(0)
        const groupName = reservation?.group ? inferGroupName(assertGroupValidity(reservation.group)) : null

        return (
            <PageWrapper headerItem={header}>
                <div className={styles.locker}>
                    <section className={styles.card}>
                        <h2>Skap {lockerId}</h2>
                        <p className={styles.location}>{locker.building}, {locker.floor}. etasje</p>
                        {reservation ? (
                            <dl className={styles.reservation}>
                                <dt>Reservert av</dt>
                                <dd>{reservation.user.firstname} {reservation.user.lastname}</dd>
                                {groupName && <>
                                    <dt>På vegne av</dt>
                                    <dd>{groupName}</dd>
                                </>}
                                <dt>Til</dt>
                                <dd>{reservation.endDate ? displayDate(reservation.endDate, false) : 'Ubestemt tid'}</dd>
                            </dl>
                        ) : (
                            <p className={styles.free}>Skapet er ledig</p>
                        )}
                    </section>

                    {reservation
                        ? capabilities.canUpdateReservation.authorized && (
                            <section className={styles.card}>
                                <UpdateLockerReservationForm
                                    reservation={{
                                        id: reservation.id,
                                        groupId: reservation.group?.id ?? null,
                                        endDate: reservation.endDate,
                                    }}
                                    groupsFormData={groupsFormData}
                                />
                            </section>
                        )
                        : capabilities.canCreateReservation.authorized && (
                            <section className={styles.card}>
                                <CreateLockerReservationForm
                                    lockerId={lockerId}
                                    userId={user.id}
                                    groupsFormData={groupsFormData}
                                />
                            </section>
                        )}
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

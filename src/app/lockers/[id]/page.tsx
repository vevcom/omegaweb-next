import styles from './page.module.scss'
import LockerNotFound from './LockerNotFound'
import CreateLockerReservationForm from './CreateLockerReservationForm'
import UpdateLockerReservationForm from './UpdateLockerReservationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { lockerOperations } from '@/services/lockers/operations'
import { groupOperations } from '@/services/groups/operations'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
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

        const groupsFormData = groups.map(group => {
            const name = inferGroupName(group)
            return { value: group.id.toString(), label: name }
        })

        return { lockerId, locker, groupsFormData, user } as const
    },
    metadata: () => ({ title: 'Skapreservasjon' }),
    render: ({ data }) => {
        if (!data.locker) {
            return <LockerNotFound />
        }
        const { lockerId, locker, groupsFormData, user } = data

        const isReserved = locker.LockerReservation.length > 0
        const reservation = locker.LockerReservation[0]
        const groupName = (isReserved && reservation.group)
            ? inferGroupName(assertGroupValidity(reservation.group))
            : ''

        const { firstname, lastname } = isReserved
            ? reservation.user
            : { firstname: '', lastname: '' }
        const groupText = isReserved && reservation.group
            ? `på vegne av ${groupName}`
            : ''
        let endDateText = ''
        if (isReserved) {
            if (reservation.endDate === null) {
                endDateText = 'på ubestemt tid'
            } else {
                endDateText = `fram til ${reservation.endDate.toLocaleDateString()}`
            }
        }

        return (
            <PageWrapper>
                <div className={styles.lockerCard}>
                    <h2>Skap nr. {lockerId}</h2>
                    <p>{locker.building} {locker.floor}. etasje</p>
                    {
                        isReserved
                            ?
                            <>
                                <p>Dette skapet er reservert av {firstname} {lastname} {groupText} {endDateText}</p>
                                {
                                    user.id === reservation.user.id
                                        ?
                                        <UpdateLockerReservationForm
                                            reservationId={reservation.id}
                                            groupsFormData={groupsFormData}
                                        />
                                        :
                                        <></>
                                }
                            </>
                            :
                            <>
                                <p>Dette skapet er ledig</p>
                                <CreateLockerReservationForm
                                    lockerId={lockerId}
                                    groupsFormData={groupsFormData}
                                />
                            </>
                    }
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

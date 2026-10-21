import LockerNotFound from './LockerNotFound'
import CreateLockerReservationForm from './CreateLockerReservationForm'
import UpdateLockerReservationForm from './UpdateLockerReservationForm'
import UpdateLockerForm from './UpdateLockerForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import BackLink from '@/components/HeaderItems/BackLink'
import Form from '@/components/Form/Form'
import { lockerOperations } from '@/services/lockers/operations'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { lockerAuth } from '@/services/lockers/auth'
import { destroyLockerAction } from '@/services/lockers/actions'
import { groupOperations } from '@/services/groups/operations'
import { lockerReservationAuth } from '@/services/lockers/reservations/auth'
import { deactivateLockerReservationAction } from '@/services/lockers/reservations/actions'
import { configureAction } from '@/services/configureAction'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import { displayDate } from '@/lib/dates/displayDate'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const lockerClassName = 'flex flex-wrap items-start gap-4 my-4'
const cardClassName = `
    flex-[1_1_320px] max-w-[480px] py-4 px-6 rounded-round bg-surface-raised shadow-soft
    [&>h2]:mb-0
`

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
            return { lockerId, locker: null, groupsFormData: [], user: null, locations: [] } as const
        }

        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        const [groups, locations] = await Promise.all([
            groupOperations.readGroupsOfUser.internalCall({
                params: {
                    userId: user.id,
                },
            }),
            lockerLocationOperations.readAll({}),
        ])

        // Groups the user has left are not offered: reserving on behalf of a group takes an active membership.
        const groupsFormData = groups.filter(group => lockerReservationAuth.create.data({
            userId: user.id,
            groupId: group.id,
        }).auth(session).authorized).map(group => {
            const name = inferGroupName(group)
            return { value: group.id.toString(), label: name }
        })

        return { lockerId, locker, groupsFormData, user, locations } as const
    },
    capabilities: (data) => ({
        canCreateReservation: data.user
            ? lockerReservationAuth.create.data({ userId: data.user.id, groupId: null })
            : Require.user(),
        canUpdateReservation: data.locker?.LockerReservation.length
            ? lockerReservationAuth.update.data({ userId: data.locker.LockerReservation[0].user.id, groupId: null })
            : Require.custom(() => false, { errorMessage: 'Skapet er ikke reservert.' }),
        canUpdateLocker: lockerAuth.update,
        canDestroyLocker: lockerAuth.destroy,
        canDeactivateReservation: data.locker?.LockerReservation.length
            ? lockerReservationAuth.deactivate.data({ userId: data.locker.LockerReservation[0].user.id })
            : Require.custom(() => false, { errorMessage: 'Skapet er ikke reservert.' }),
    }),
    metadata: (data) => ({ title: data.locker ? `Skap ${data.lockerId}` : 'Skap' }),
    render: ({ data, capabilities }) => {
        const header = <BackLink href="/lockers" label="Alle skap" />

        if (!data.locker) {
            return (
                <PageWrapper headerItem={header}>
                    <div className={lockerClassName}>
                        <LockerNotFound />
                    </div>
                </PageWrapper>
            )
        }
        const { lockerId, locker, groupsFormData, user, locations } = data
        const reservation = locker.LockerReservation.at(0)
        const groupName = reservation?.group ? inferGroupName(assertGroupValidity(reservation.group)) : null

        return (
            <PageWrapper headerItem={header}>
                <div className={lockerClassName}>
                    <section className={cardClassName}>
                        <h2>Skap {lockerId}</h2>
                        <p className="text-text-muted mb-4">{locker.building}, {locker.floor}. etasje</p>
                        {reservation ? (
                            <dl className="
                                grid grid-cols-[auto_1fr] gap-x-4 gap-y-2
                                [&>dt]:text-text-muted
                                [&>dd]:m-0
                            ">
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
                            <p className="text-accent-green font-medium">Skapet er ledig</p>
                        )}
                        {reservation && capabilities.canDeactivateReservation.authorized && (
                            <Form
                                className="mt-4"
                                submitText="Frigi skapet"
                                submitColor="red"
                                refreshOnSuccess
                                action={configureAction(deactivateLockerReservationAction, {
                                    params: { id: reservation.id },
                                })}
                                confirmation={{
                                    confirm: true,
                                    text: `Er du sikker på at du vil frigi skap ${lockerId}? ` +
                                        'Reservasjonen avsluttes nå, og skapet blir ledig for andre.',
                                }}
                            />
                        )}
                    </section>

                    {reservation
                        ? capabilities.canUpdateReservation.authorized && (
                            <section className={cardClassName}>
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
                            <section className={cardClassName}>
                                <CreateLockerReservationForm
                                    lockerId={lockerId}
                                    userId={user.id}
                                    groupsFormData={groupsFormData}
                                />
                            </section>
                        )}

                    {(capabilities.canUpdateLocker.authorized || capabilities.canDestroyLocker.authorized) && (
                        <section className={cardClassName}>
                            {capabilities.canUpdateLocker.authorized && (
                                <UpdateLockerForm
                                    lockerId={lockerId}
                                    current={{ building: locker.building, floor: locker.floor }}
                                    locations={locations}
                                />
                            )}
                            {capabilities.canDestroyLocker.authorized && (reservation ? (
                                <p className="mt-4 text-text-muted">Skapet er reservert. Frigi det før det slettes.</p>
                            ) : (
                                <Form
                                    className="mt-4"
                                    submitText="Slett skapet"
                                    submitColor="red"
                                    navigateOnSuccess="/lockers"
                                    action={configureAction(destroyLockerAction, { params: { id: lockerId } })}
                                    confirmation={{
                                        confirm: true,
                                        text: `Er du sikker på at du vil slette skap ${lockerId}? ` +
                                            'Tidligere reservasjoner av det slettes også.',
                                    }}
                                />
                            ))}
                        </section>
                    )}
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

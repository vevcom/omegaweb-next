import { inferGroupNameIfValid } from '@/lib/groups/inferGroupName'
import { displayDate } from '@/lib/dates/displayDate'
import Link from 'next/link'
import type { LockerWithReservation } from '@/services/lockers/types'

export const lockerRowClassName = [
    'flex items-center gap-2 bg-surface-raised py-3 px-4 text-inherit no-underline',
    'transition-[background-color] duration-300',
    '[&>span]:min-w-0 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap',
].join(' ')

export const lockerColumnClassName = {
    id: 'flex-[0_0_calc(7*var(--gap))]',
    location: 'flex-1',
    user: 'flex-1',
    group: 'flex-1 max-mobile:hidden',
    end: 'flex-[0_0_calc(14*var(--gap))] max-mobile:hidden',
}

type PropTypes = {
    locker: LockerWithReservation
}

export default function LockerRow({ locker }: PropTypes) {
    const reservation = locker.LockerReservation[0]
    const groupName = reservation?.group ? inferGroupNameIfValid(reservation.group) ?? '' : ''
    const endDateText = reservation ? endDateOf(reservation.endDate) : ''

    return (
        <Link
            href={`/lockers/${locker.id}`}
            className={[
                lockerRowClassName,
                'even:bg-[color-mix(in_srgb,var(--surface-raised),white_3%)] hover:bg-surface-hover hover:no-underline',
            ].join(' ')}
            role="row"
        >
            <span className={lockerColumnClassName.id} role="cell">{locker.id}</span>
            <span className={lockerColumnClassName.location} role="cell">{locker.building} {locker.floor}. etasje</span>
            <span className={`${lockerColumnClassName.user} ${reservation ? '' : 'text-text-muted'}`} role="cell">
                {reservation ? `${reservation.user.firstname} ${reservation.user.lastname}` : 'Ledig'}
            </span>
            <span className={lockerColumnClassName.group} role="cell">{groupName}</span>
            <span className={lockerColumnClassName.end} role="cell">{endDateText}</span>
        </Link>
    )
}

function endDateOf(endDate: Date | null): string {
    return endDate ? displayDate(endDate, false) : 'Ubestemt'
}

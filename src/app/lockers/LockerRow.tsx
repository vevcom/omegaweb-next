import styles from './LockerList.module.scss'
import { inferGroupNameIfValid } from '@/lib/groups/inferGroupName'
import { displayDate } from '@/lib/dates/displayDate'
import Link from 'next/link'
import type { LockerWithReservation } from '@/services/lockers/types'

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
            className={`${styles.row} ${reservation ? styles.reserved : styles.free}`}
            role="row"
        >
            <span className={styles.colId} role="cell">{locker.id}</span>
            <span className={styles.colLocation} role="cell">{locker.building} {locker.floor}. etasje</span>
            <span className={styles.colUser} role="cell">
                {reservation ? `${reservation.user.firstname} ${reservation.user.lastname}` : 'Ledig'}
            </span>
            <span className={styles.colGroup} role="cell">{groupName}</span>
            <span className={styles.colEnd} role="cell">{endDateText}</span>
        </Link>
    )
}

function endDateOf(endDate: Date | null): string {
    return endDate ? displayDate(endDate, false) : 'Ubestemt'
}

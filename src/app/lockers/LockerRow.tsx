import styles from './LockerRow.module.scss'
// import { checkGroupValidity, inferGroupName } from '@/services/groups/read'
import { displayDate } from '@/lib/dates/displayDate'
import Link from 'next/link'
import type { LockerWithReservation } from '@/services/lockers/types'

type PropTypes = {
    locker: LockerWithReservation
}

export default function LockerRow({ locker }: PropTypes) {
    const isReserved = locker.LockerReservation.length > 0
    const reservation = locker.LockerReservation[0]
    const groupName = 'test'
    // TODO fix groupName
    // const groupName = (isReserved && reservation.group) ? inferGroupName(checkGroupValidity(reservation.group)) : ''

    let endDateText = ''
    if (isReserved) {
        if (reservation.endDate === null) {
            endDateText = 'ubestemt'
        } else {
            endDateText = displayDate(reservation.endDate, false)
        }
    }

    return (
        <Link href={`/lockers/${locker.id}`} className={styles.lockerRow}>
            <p>{locker.id}</p>
            <p>{locker.building}</p>
            <p>{locker.floor}</p>
            <p className={styles.hideSecond}>
                {isReserved ? `${reservation.user.firstname} ${reservation.user.lastname}` : ''}
            </p>
            <p className={styles.hideFirst}>{groupName}</p>
            <p>{endDateText}</p>
        </Link>
    )
}

'use client'
import styles from './AttendanceCountsPill.module.scss'
import { useAttendanceCounts } from './AttendanceCounts'

export default function AttendanceCountsPill() {
    const { counts } = useAttendanceCounts()

    return <div className={styles.AttendanceCountsPill}>
        <span className={styles.tally}>
            <strong>{counts.attended}</strong> / {counts.total}
        </span>
        {counts.attendedFromWaitingList > 0 && <span className={styles.fromWaitingList}>
            + {counts.attendedFromWaitingList} fra venteliste
        </span>}
    </div>
}

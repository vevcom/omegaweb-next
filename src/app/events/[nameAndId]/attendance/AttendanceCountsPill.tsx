'use client'
import styles from './AttendanceCountsPill.module.scss'
import { useAttendanceCounts } from './AttendanceCounts'

/**
 * The tally as a pill in the corner of the header, so the one holding the scanner can read where
 * they are at without looking away from the camera.
 */
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

'use client'
import { useAttendanceCounts } from './AttendanceCounts'

export default function AttendanceCountsPill() {
    const { counts } = useAttendanceCounts()

    return <div className="header-pill items-baseline! px-4 whitespace-nowrap leading-[40px]">
        <span className="
            text-m
            [&>strong]:text-l [&>strong]:text-accent-green
        ">
            <strong>{counts.attended}</strong> / {counts.total}
        </span>
        {counts.attendedFromWaitingList > 0 && <span className="text-s text-text-muted">
            + {counts.attendedFromWaitingList} fra venteliste
        </span>}
    </div>
}

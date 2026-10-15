'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { EventAttendanceCounts } from '@/services/events/registration/types'

type AttendanceCountsContextType = {
    counts: EventAttendanceCounts,
    setCounts: (counts: EventAttendanceCounts) => void,
}

const AttendanceCountsContext = createContext<AttendanceCountsContextType | undefined>(undefined)

/**
 * The tally of one event, shared between the pill in the header and the scanner in the body - they
 * sit in different slots of the page, but it is one number, and each scan reports the new one back.
 */
export function AttendanceCountsProvider({
    initialCounts,
    children,
}: {
    initialCounts: EventAttendanceCounts,
    children: ReactNode,
}) {
    const [counts, setCounts] = useState(initialCounts)

    return (
        <AttendanceCountsContext.Provider value={{ counts, setCounts }}>
            {children}
        </AttendanceCountsContext.Provider>
    )
}

export function useAttendanceCounts() {
    const context = useContext(AttendanceCountsContext)
    if (!context) throw new Error('useAttendanceCounts must be used within AttendanceCountsProvider')
    return context
}

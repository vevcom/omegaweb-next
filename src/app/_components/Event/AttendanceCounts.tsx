'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { EventAttendanceCounts } from '@/services/events/registration/types'

type AttendanceCountsContextType = {
    counts: EventAttendanceCounts,
    setCounts: (counts: EventAttendanceCounts) => void,
}

const AttendanceCountsContext = createContext<AttendanceCountsContextType | undefined>(undefined)

export function AttendanceCountsProvider({
    initialCounts,
    children,
}: {
    initialCounts: EventAttendanceCounts,
    children: ReactNode,
}) {
    const [counts, setCounts] = useState(initialCounts)
    // A refresh of the page brings new counts, such as after marking someone by hand.
    const [given, setGiven] = useState(initialCounts)
    if (given !== initialCounts) {
        setGiven(initialCounts)
        setCounts(initialCounts)
    }

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

import type { Prisma } from '@/prisma-generated-pn-types'

export const slotScheduleLimits = {
    slotMinutes: { min: 3, max: 120 },
    breakMinutes: { min: 0, max: 60 },
    totalMinutes: { min: 1, max: 720 },
    longBreakEveryMinutes: { min: 10, max: 720 },
    longBreakMinutes: { max: 120 },
    slots: { min: 1, max: 100 },
} as const

export const defaultSlotScheduleLengths = {
    slotMinutes: 10,
    breakMinutes: 5,
    totalMinutes: 120,
    longBreakEveryMinutes: null,
    longBreakMinutes: null,
} as const

export const defaultLongBreak = {
    longBreakEveryMinutes: 60,
    longBreakMinutes: 10,
} as const

export const slotScheduleSelection = {
    start: true,
    slotMinutes: true,
    breakMinutes: true,
    totalMinutes: true,
    longBreakEveryMinutes: true,
    longBreakMinutes: true,
} as const satisfies Prisma.EventSlotScheduleSelect

'use client'
import { dateLessThan, dateLessThanOrEqualTo, datesEqual } from '@/lib/dates/comparison'
import { osloDateTime } from '@/lib/dates/oslo'
import { useState } from 'react'
import type { BookingFiltered } from '@/services/cabin/booking/types'

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS = [
    'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

export type DateRange = {
    start?: Date,
    end?: Date,
}

export type Night = 'free' | 'past' | 'booked' | 'closed'

export type CalendarWindow = {
    today: Date,
    bookingUntil: Date,
    bookings: BookingFiltered[],
}

const addDays = (date: Date, days: number) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))

/** What the night starting on `date` is. Dates are whole days at UTC midnight. */
export function nightOf(date: Date, { today, bookingUntil, bookings }: CalendarWindow): Night {
    if (dateLessThan(date, today)) return 'past'
    if (!dateLessThan(date, bookingUntil)) return 'closed'
    const booked = bookings.some(booking =>
        dateLessThanOrEqualTo(booking.start, date) && dateLessThan(date, booking.end))
    return booked ? 'booked' : 'free'
}

/**
 * The stay after picking `date`: it ends a started stay when every night up to it is free, and
 * otherwise starts a new one on a free night. Null when the pick changes nothing.
 */
export function pickDate(dateRange: DateRange, date: Date, calendarWindow: CalendarWindow): DateRange | null {
    const { start, end } = dateRange
    if (start && !end && dateLessThan(start, date)) {
        let night = start
        while (dateLessThan(night, date) && nightOf(night, calendarWindow) === 'free') night = addDays(night, 1)
        if (datesEqual(night, date)) return { start, end: date }
    }
    return nightOf(date, calendarWindow) === 'free' ? { start: date } : null
}

const dayClassName = 'min-h-12 w-full rounded-inner border text-m flex flex-col items-center justify-center'

const nightClassNames: Record<Night, string> = {
    free: `
        bg-base-100 border-base-300
        hover:bg-base-200
        cursor-pointer
    `,
    past: 'bg-transparent border-transparent text-base-content/40',
    booked: `
        border-warning/60 text-base-content font-semibold
        [--stripe:color-mix(in_srgb,var(--color-warning)_35%,transparent)]
        bg-[repeating-linear-gradient(135deg,var(--stripe)_0_4px,transparent_4px_10px)]
    `,
    closed: 'bg-base-300 border-transparent text-base-content/60',
}

const nightLabels: Record<Night, string> = {
    free: 'ledig',
    past: 'passert',
    booked: 'opptatt',
    closed: 'ikke åpnet ennå',
}

const selectedClassName = 'bg-primary border-primary text-primary-content cursor-pointer'
const inRangeClassName = 'bg-primary/30 border-primary/50 cursor-pointer'

/**
 * Picks a stay one month at a time. A day stands for the night that starts on it, and the day a
 * booked night starts can still be picked as the day to check out.
 */
export default function CabinCalendar({
    bookingUntil,
    intervalChangeCallback,
    defaultDateRange,
    bookings,
}: {
    bookingUntil: Date,
    intervalChangeCallback?: (dateRange: DateRange) => void,
    defaultDateRange?: DateRange,
    bookings?: BookingFiltered[],
}) {
    // The calendar works in whole dates, and today is the date in Oslo.
    const today = new Date(osloDateTime(new Date()).toISODate() ?? '')
    const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange ?? {})
    const [month, setMonth] = useState(() => {
        const shown = dateRange.start ?? today
        return new Date(Date.UTC(shown.getUTCFullYear(), shown.getUTCMonth(), 1))
    })

    const calendarWindow = { today, bookingUntil, bookings: bookings ?? [] }
    const nightAt = (date: Date) => nightOf(date, calendarWindow)

    const pick = (date: Date) => {
        const newDateRange = pickDate(dateRange, date, calendarWindow)
        if (!newDateRange) return
        setDateRange(newDateRange)
        intervalChangeCallback?.(newDateRange)
    }

    const firstMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const lastMonth = new Date(Date.UTC(bookingUntil.getUTCFullYear(), bookingUntil.getUTCMonth(), 1))
    const showMonth = (offset: number) =>
        setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1)))

    const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
    const leadingBlanks = (month.getUTCDay() + 6) % 7
    const days = Array.from({ length: daysInMonth }, (nothing, index) => addDays(month, index))

    const navButtonClassName = `
        size-11 rounded-inner border border-base-300 bg-base-100 text-l
        hover:bg-base-200
        disabled:opacity-40
        disabled:hover:bg-base-100
    `

    return <div className="flex flex-col gap-3 w-full max-w-[40rem]">
        <div className="flex items-center justify-between gap-2">
            <button
                type="button"
                aria-label="Forrige måned"
                className={navButtonClassName}
                disabled={!dateLessThan(firstMonth, month)}
                onClick={() => showMonth(-1)}
            >‹</button>
            <h3 className="m-0 text-l" aria-live="polite">{MONTHS[month.getUTCMonth()]} {month.getUTCFullYear()}</h3>
            <button
                type="button"
                aria-label="Neste måned"
                className={navButtonClassName}
                disabled={!dateLessThan(month, lastMonth)}
                onClick={() => showMonth(1)}
            >›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-s font-semibold text-base-content/80">
            {WEEKDAYS.map(weekday => <div key={weekday}>{weekday}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }, (nothing, index) => <div key={`blank-${index}`} />)}
            {days.map(date => {
                const dayNight = nightAt(date)
                const monthName = MONTHS[date.getUTCMonth()].toLowerCase()
                const isEnd = datesEqual(date, dateRange.start) || datesEqual(date, dateRange.end)
                const inRange = dateRange.start && dateRange.end
                    && dateLessThan(dateRange.start, date) && dateLessThan(date, dateRange.end)
                const canCheckOut = dayNight !== 'free' && dayNight !== 'past' && nightAt(addDays(date, -1)) === 'free'
                let className = nightClassNames[dayNight]
                if (isEnd) className = selectedClassName
                else if (inRange) className = inRangeClassName
                else if (canCheckOut) className = `${className} cursor-pointer`

                return <button
                    key={date.getTime()}
                    type="button"
                    aria-label={`${date.getUTCDate()}. ${monthName}, ${nightLabels[dayNight]}`}
                    aria-pressed={Boolean(isEnd || inRange)}
                    disabled={dayNight !== 'free' && !canCheckOut}
                    className={`
                        ${dayClassName}
                        ${className}
                    `}
                    onClick={() => pick(date)}
                >
                    {date.getUTCDate()}
                </button>
            })}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-s">
            {(['free', 'booked', 'closed'] as const).map(night => (
                <span key={night} className="flex items-center gap-2">
                    <span className={`
                        size-4 rounded-sm border
                        ${nightClassNames[night]}
                    `} />
                    {nightLabels[night].charAt(0).toUpperCase() + nightLabels[night].slice(1)}
                </span>
            ))}
            <span className="flex items-center gap-2">
                <span className={`
                    size-4 rounded-sm border
                    ${selectedClassName}
                `} />
                Ditt valg
            </span>
        </div>
        <p className="m-0 text-s text-base-content/80">
            Velg dagen du kommer, og så dagen du drar. Du kan også bruke Tab og Enter.
        </p>
    </div>
}

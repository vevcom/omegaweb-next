'use client'
import styles from './CabinCalendar.module.scss'
import { dateInInterval, dateLessThan, datesEqual, getWeekNumber } from '@/lib/dates/comparison'
import React, { useState } from 'react'
import type { BookingFiltered } from '@/services/cabin/booking/types'
import type { ReactNode } from 'react'

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS = [
    'Januar',
    'Februar',
    'Mars',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Desember'
]

enum Selection {
    'START',
    'END',
    'INRANGE'
}

type Day = {
    date: Date,
    selection?: Selection,
    bookingSelection?: Selection,
}

type Week = {
    days: (Day | null)[],
    number: number,
}

export type DateRange = {
    start?: Date,
    end?: Date,
}

function createNullArray(num: number): null[] {
    return Array.from({ length: num }).map(() => null)
}

/**
 * Generate data in teh calendar.
 * This includes generating a n array of weeks,
 * Where the week contains all the days in the week, and the state of that day
 * The state of the day can be beginning, end or middle of a range.
 * And a range can have different types
 */
function generateCalendarData(
    startDate: Date,
    endDate: Date,
    dateRange: DateRange,
    bookings: BookingFiltered[]
): (Week | string)[] {
    const bookingsAdjusted = bookings ?? []

    // This will mark everything outside the booking period as booked
    bookingsAdjusted.push({
        type: 'CABIN',
        start: endDate,
        end: new Date(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate())
    })
    const earliesBookableDay = dateLessThan(new Date(), startDate) ? startDate : new Date()
    bookingsAdjusted.push({
        type: 'CABIN',
        start: new Date(startDate.getUTCFullYear(), startDate.getUTCMonth() - 1, startDate.getUTCDate()),
        end: earliesBookableDay,
    })
    const firstDayOfMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))

    const stopAtMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1))


    const firstDayOfFirstWeek = new Date(firstDayOfMonth)

    // This will change Sunday to 6, and Monday to 0
    const dayOfWeek = firstDayOfMonth.getUTCDay() === 0 ? 6 : firstDayOfMonth.getUTCDay() - 1

    const firstDayOfFirstWeekOffset = firstDayOfMonth.getUTCDate() - dayOfWeek
    firstDayOfFirstWeek.setUTCDate(firstDayOfFirstWeekOffset)

    const ret: (Week | string)[] = []

    let lastMonth = firstDayOfMonth.getUTCMonth() - 1

    for (let i = 0; i < 100; i++) {
        const mondayDate = new Date(firstDayOfFirstWeek)
        mondayDate.setUTCDate(mondayDate.getUTCDate() + 7 * i)

        let days: (Day | null)[] = []

        for (let j = 0; j < 7; j++) {
            const thisDate = new Date(firstDayOfFirstWeek)
            thisDate.setUTCDate(thisDate.getUTCDate() + i * 7 + j)

            let selection: undefined | Selection = undefined

            if (datesEqual(thisDate, dateRange.start)) {
                selection = Selection.START
            } else if (datesEqual(thisDate, dateRange.end)) {
                selection = Selection.END
            } else if (dateRange.start && dateRange.end) {
                const inRange = dateRange && dateLessThan(dateRange.start, thisDate) && dateLessThan(thisDate, dateRange.end)

                if (inRange) {
                    selection = Selection.INRANGE
                }
            }

            let bookingSelection: undefined | Selection

            bookingsAdjusted.forEach(booking => {
                if (datesEqual(thisDate, booking.start)) {
                    if (bookingSelection === undefined) {
                        bookingSelection = Selection.START
                    } else if (bookingSelection === Selection.END) {
                        bookingSelection = Selection.INRANGE
                    }
                } else if (datesEqual(thisDate, booking.end)) {
                    if (bookingSelection === undefined) {
                        bookingSelection = Selection.END
                    } else if (bookingSelection === Selection.START) {
                        bookingSelection = Selection.INRANGE
                    }
                } else {
                    const inRange = dateLessThan(booking.start, thisDate) && dateLessThan(thisDate, booking.end)

                    if (inRange) {
                        bookingSelection = Selection.INRANGE
                    }
                }
            })

            if (lastMonth !== thisDate.getUTCMonth()) {
                lastMonth = thisDate.getUTCMonth()
                if (!dateLessThan(thisDate, stopAtMonth)) {
                    i = 100
                    break
                }

                if (days.length > 0) {
                    ret.push({
                        number: getWeekNumber(mondayDate),
                        days: [...days, ...createNullArray(7 - days.length)]
                    })
                }

                ret.push(MONTHS[thisDate.getUTCMonth()])

                days = createNullArray(days.length)
            }

            days.push({
                date: thisDate,
                selection,
                bookingSelection,
            })
        }


        if (i === 0 && dateLessThan(mondayDate, firstDayOfMonth)) {
            // This will only happen the first week
            ret.splice(0, 1)
        }

        ret.push({
            number: getWeekNumber(mondayDate),
            days
        })
    }


    return ret
}

function dateInBooking(date: Date, bookings: BookingFiltered[], dateIsStart: boolean) {
    for (let i = 0; i < bookings.length; i++) {
        if (dateInInterval(date, bookings[i].start, bookings[i].end, dateIsStart, !dateIsStart)) {
            return true
        }
    }
    return false
}

function bookingCollides(dateRange: DateRange, bookings: BookingFiltered[]) {
    if (!dateRange.start || !dateRange.end) return false

    const startDate = dateRange.start
    const endDate = dateRange.end
    return bookings.some(booking => dateLessThan(booking.start, endDate) && dateLessThan(startDate, booking.end))
}

function preventBookingCollision(dateRange: DateRange, bookings: BookingFiltered[], lastChangeWasStart: boolean) {
    if (!dateRange.start || !dateRange.end) return dateRange

    if (!dateLessThan(dateRange.start, dateRange.end)) {
        return {
            start: lastChangeWasStart ? dateRange.start : undefined,
            end: lastChangeWasStart ? undefined : dateRange.end,
        }
    }

    // lastChangeWasStart => we can change the end date => end downwards

    if (lastChangeWasStart) {
        if (bookingCollides(dateRange, bookings)) {
            const newEnd = new Date(dateRange.end)
            newEnd.setUTCDate(newEnd.getUTCDate() - 1)
            return preventBookingCollision({
                start: dateRange.start,
                end: newEnd
            }, bookings, lastChangeWasStart)
        }
        return dateRange
    }

    if (bookingCollides(dateRange, bookings)) {
        const newStart = new Date(dateRange.start)
        newStart.setUTCDate(newStart.getUTCDate() + 1)
        return preventBookingCollision({
            start: newStart,
            end: dateRange.end
        }, bookings, lastChangeWasStart)
    }

    return dateRange
}

export default function CabinCalendar({
    startDate,
    bookingUntil,
    intervalChangeCallback,
    defaultDateRange,
    bookings,
}: {
    startDate: Date,
    bookingUntil: Date,
    intervalChangeCallback?: (dateRange: DateRange) => void,
    defaultDateRange?: DateRange,
    bookings?: BookingFiltered[],
}) {
    const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange ?? {})
    const [lastChangeWasStart, setLastChangeWasStart] = useState(false)
    const [weeks, setWeeks] = useState(generateCalendarData(startDate, bookingUntil, dateRange, bookings ?? []))

    function callback(day: Day) {
        if (datesEqual(day.date, dateRange.start) || datesEqual(day.date, dateRange.end)) return


        let newDateRange: DateRange = {}
        let shouldChangeStart = !lastChangeWasStart
        if (dateRange.start && day.date < dateRange.start) shouldChangeStart = true
        if (dateRange.end && day.date > dateRange.end) shouldChangeStart = false

        if (dateInBooking(day.date, bookings ?? [], shouldChangeStart)) return

        if (shouldChangeStart) {
            newDateRange = {
                start: day.date,
                end: dateRange.end
            }
        } else {
            newDateRange = {
                start: dateRange.start,
                end: day.date,
            }
        }

        newDateRange = preventBookingCollision(newDateRange, bookings ?? [], shouldChangeStart)

        setDateRange(newDateRange)
        if (intervalChangeCallback) intervalChangeCallback(newDateRange)
        setLastChangeWasStart(shouldChangeStart)
        setWeeks(generateCalendarData(startDate, bookingUntil, newDateRange, bookings ?? []))
    }

    return <div
        className={styles.calendar}
    >
        <div className={`${styles.week} ${styles.weekHeader}`}>
            <div className={styles.weekNumber}>Uke</div>
            <div className={styles.weekDays}>
                {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
            </div>
        </div>

        {weeks.map((week, index) => {
            if (typeof week === 'string') {
                return <MonthHeader key={index}>{week}</MonthHeader>
            }
            return <CalendarWeek week={week} key={index} callback={callback} />
        })}
    </div>
}

function MonthHeader({
    children
}: {
    children: ReactNode
}) {
    return <h2 className={styles.monthHeader}>{children}</h2>
}

function CalendarWeek({
    week,
    callback
}: {
    week: Week,
    callback: (day: Day) => void
}) {
    return <div className={styles.week} >
        <div className={styles.weekNumber}>{week.number}</div>
        <div className={styles.weekDays}>
            {week.days.map((day, weekdayIndex) => {
                if (day) return <CalendarDay day={day} key={weekdayIndex} callback={callback} />
                return <div key={weekdayIndex} className={styles.day}></div>
            })}
        </div>
    </div>
}

function CalendarDay({
    day,
    callback
}: {
    day: Day,
    callback: (sourceDay: Day) => void
}) {
    const classList: string[] = [styles.front]

    const selectionMap: Record<Selection, string> = {
        [Selection.START]: styles.start,
        [Selection.END]: styles.end,
        [Selection.INRANGE]: styles.inRange
    }

    function getSelectionStyle(sel?: Selection): string {
        if (sel === undefined) return ''
        return selectionMap[sel]
    }

    classList.push(getSelectionStyle(day.selection))

    return <div className={`${styles.day} ${styles.exists}`}>
        <div
            className={classList.join(' ')}
            onMouseDown={() => callback(day)}
        >
            <div className={styles.dateNumber}>{day.date.getDate()}</div>
        </div>
        <div className={`${styles.behind} ${getSelectionStyle(day.bookingSelection)}`}>
            <div className={styles.left} />
            <div className={styles.right} />
        </div>
    </div>
}

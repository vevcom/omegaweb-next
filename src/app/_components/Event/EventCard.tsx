import SmallEventTag from './SmallEventTag'
import Image from '@/components/Image/Image'
import { formatVevenUri } from '@/lib/urlEncoding'
import { osloDateTime } from '@/lib/dates/oslo'
import React from 'react'
import Link from 'next/link'
import type { EventExpanded } from '@/services/events/types'

type PropTypes = {
    event: EventExpanded
}

const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

const twoDigitHour = (date: Date) => String(osloDateTime(date).hour).padStart(2, '0')

export default function EventCard({ event }: PropTypes) {
    const attendanceRatio = event.places > 0 ? event.numOfRegistrations / event.places : 0
    const attendance = `${Math.max(0, Math.min(attendanceRatio, 1)) * 100}%`
    const link = `/events/${formatVevenUri(`${event.name}`, event.id)}`
    const from = event.takesRegistration ? event.registrationStart : event.eventStart
    const to = event.takesRegistration ? event.registrationEnd : event.eventEnd

    return <Link href={link} className="list-row">
        <div className="list-row-thumb">
            {event.coverImage.image && (
                <Image width={200} image={event.coverImage.image} />
            )}
        </div>

        <div className="list-row-lead">
            <b>{osloDateTime(event.eventStart).day}</b>
            <span>{months[osloDateTime(event.eventStart).month - 1]}</span>
        </div>

        <div className="list-row-main">
            <h2>{event.name}</h2>
            <div className="flex items-center gap-2 list-none">
                {event.tags.map(tag => (
                    <SmallEventTag key={tag.id} eventTag={tag} />
                ))}
            </div>
        </div>

        <div className="list-row-meta">
            {event.location && <span>{event.location}</span>}
            <span>{twoDigitHour(from)}–{twoDigitHour(to)}</span>
            {event.takesRegistration && (
                <span className="text-text font-medium">{event.numOfRegistrations} / {event.places}</span>
            )}
        </div>

        {event.takesRegistration && (
            <div className="list-row-bar">
                <div style={{ width: attendance }}></div>
            </div>
        )}
    </Link>
}

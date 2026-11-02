import Image from '@/components/Image/Image'
import { eventHref } from '@/components/Event/Pages/eventPages'
import { osloDateTime } from '@/lib/dates/oslo'
import Link from 'next/link'
import type { UpcomingRegistrationOfUser } from '@/services/events/registration/types'

type PropTypes = {
    registration: UpcomingRegistrationOfUser
    /** The event pages the row links under. */
    basePath: string
}

const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

const twoDigitHour = (date: Date) => String(osloDateTime(date).hour).padStart(2, '0')

export default function UpcomingRegistrationRow({ registration, basePath }: PropTypes) {
    const { event, variant } = registration
    const start = osloDateTime(event.eventStart)

    return (
        <Link href={eventHref(basePath, event)} className="list-row">
            <div className="list-row-thumb">
                {event.coverImage.image && (
                    <Image width={200} image={event.coverImage.image} />
                )}
            </div>

            <div className="list-row-lead">
                <b>{start.day}</b>
                <span>{months[start.month - 1]}</span>
            </div>

            <div className="list-row-main">
                <h2>{event.name}</h2>
                <p>
                    {event._count.variants > 1 && <>{variant.name} · </>}
                    {registration.onWaitingList
                        ? <span className="text-accent-orange">På venteliste</span>
                        : <span className="text-accent-green">Påmeldt</span>}
                </p>
            </div>

            <div className="list-row-meta">
                {event.location && <span>{event.location}</span>}
                <span>{twoDigitHour(event.eventStart)}–{twoDigitHour(event.eventEnd)}</span>
            </div>
        </Link>
    )
}

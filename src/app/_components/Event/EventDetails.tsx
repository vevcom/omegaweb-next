import styles from './EventDetails.module.scss'
import EventCompany from './EventCompany'
import RegistrationUI from './RegistrationUI'
import Date from '@/components/Date/Date'
import Link from 'next/link'
import { faCalendar, faExclamation, faLocationDot, faPeopleGroup, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { EventRegistrationPageData } from './eventPageData'
import type { CompanyOfEvent, EventExpanded } from '@/services/events/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = EventRegistrationPageData & {
    event: EventExpanded & {
        hostedByCommittee: { name: string, shortName: string } | null,
        company: CompanyOfEvent | null,
    },
    capabilities: Capabilities<'canRegister' | 'canRegisterAsAdmin'>,
    className?: string,
}

/**
 * What there is to know about an event beside its description - when and where it is, with which
 * company and hosted by whom - and its registration, with the visitor's own.
 */
export default function EventDetails({
    event,
    ownRegistration,
    dotPunishment,
    eventPaymentBalance,
    eventPaymentCustomerSessionSecret,
    capabilities,
    className,
}: PropTypes) {
    return (
        <aside className={`${styles.EventDetails} ${className ?? ''}`}>
            <p>
                <FontAwesomeIcon icon={faCalendar} />
                <Date date={event.eventStart} includeTime /> - <Date date={event.eventEnd} includeTime />
            </p>
            <p>
                <FontAwesomeIcon icon={faLocationDot} />
                {event.location}
            </p>
            {event.company && <EventCompany company={event.company} />}
            {event.hostedByCommittee && <p>
                <FontAwesomeIcon icon={faPeopleGroup} />
                <span>
                    Arrangeres av <Link href={`/committees/${event.hostedByCommittee.shortName}`}>
                        {event.hostedByCommittee.name}
                    </Link>
                </span>
            </p>}
            {event.takesRegistration ? <>
                <p>
                    <FontAwesomeIcon icon={faUsers} />
                    {event.numOfRegistrations} / {event.places}
                </p>
                <p>
                    Påmelding start: <Date date={event.registrationStart} includeTime />
                </p>
                <p>
                    Påmelding slutt: <Date date={event.registrationEnd} includeTime />
                </p>
                {event.waitingList && <p>
                    På venteliste: {event.numOnWaitingList}
                </p>}
                <RegistrationUI
                    event={event}
                    registration={ownRegistration}
                    dotPunishment={dotPunishment}
                    availableBalance={eventPaymentBalance}
                    customerSessionClientSecret={eventPaymentCustomerSessionSecret}
                    capabilities={{
                        canRegister: capabilities.canRegister.toJsObject(),
                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                    }}
                />
            </> : <p>
                <FontAwesomeIcon icon={faExclamation} />
                Dette arrangementet tar ikke påmeldinger
            </p>}
        </aside>
    )
}

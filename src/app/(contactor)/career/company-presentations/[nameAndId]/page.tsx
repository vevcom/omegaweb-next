import styles from './page.module.scss'
import ContactorPageHeader from '@/app/(contactor)/_components/ContactorPageHeader'
import { contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import EventDetails from '@/components/Event/EventDetails'
import EventDescription from '@/components/Event/EventDescription'
import { eventRegistrationCapabilities, readEventRegistrationPageData } from '@/components/Event/eventPageData'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import { eventOperations } from '@/services/events/operations'
import { updateEventCmsCoverImageAction } from '@/services/events/actions'
import { eventAuth } from '@/services/events/auth'
import { configureAction } from '@/services/configureAction'
import { ServiceError } from '@/services/error'
import { decodeVevenUriHandleError, formatVevenUri } from '@/lib/urlEncoding'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * A company presentation on Contactor's site: the event and its registration as on Omega's event
 * page, in Contactor's look. Running the event - its settings, registrations and attendance - is
 * left to Omega's event page, which those who administrate it get a link to.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        const event = await eventOperations.read({ params: { id: decodeVevenUriHandleError(params.nameAndId) } })
        if (!event.tags.some(tag => tag.special === 'COMPANY_PRESENTATION')) {
            throw new ServiceError('NOT FOUND', 'Arrangementet er ikke en bedriftspresentasjon')
        }

        // Readable only by those who administrate the event, so a visitor without that access
        // gets neither the editing tools nor the link to administrate it (see the event page).
        const doubleLevelVisibility = await withFallback(
            eventOperations.visibility.readDoubleLevelMatrix({ params: { id: event.id } }),
            null
        )

        return {
            event,
            doubleLevelVisibility,
            registration: await readEventRegistrationPageData(event, session),
        }
    },
    capabilities: (data, session) => ({
        canEditCmsCoverImage: eventAuth.updateCmsCoverImage.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canEditCmsParagraph: eventAuth.updateParagraphContent.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canUpdate: eventAuth.update.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        ...eventRegistrationCapabilities(data, session),
    }),
    metadata: (data) => ({ title: data.event.name }),
    render: ({ data: { event, registration }, capabilities }) => (
        <>
            <ContactorPageHeader badge="Bedriftspresentasjon" title={event.name} lead={event.company?.name}>
                <Link href={contactorNavDef.companyPresentations.href}>
                    <FontAwesomeIcon icon={faArrowLeft} />Alle bedriftspresentasjoner
                </Link>
                {capabilities.canUpdate.authorized && (
                    <Link href={`/events/${formatVevenUri(event.name, event.id)}`}>
                        Administrer arrangementet<FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                )}
            </ContactorPageHeader>
            <div className={styles.layout}>
                <section className={styles.description}>
                    <CmsImage
                        className={styles.coverImage}
                        capabilities={{ canEdit: capabilities.canEditCmsCoverImage }}
                        cmsImage={event.coverImage}
                        width={900}
                        updateCmsImageAction={configureAction(
                            updateEventCmsCoverImageAction,
                            { implementationParams: { eventId: event.id } }
                        )}
                    />
                    <EventDescription event={event} capabilities={{ canEdit: capabilities.canEditCmsParagraph }} />
                </section>
                <EventDetails
                    className={styles.details}
                    event={event}
                    {...registration}
                    capabilities={{
                        canRegister: capabilities.canRegister,
                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin,
                    }}
                />
            </div>
        </>
    ),
})

export default page
export { generateMetadata }

import styles from './page.module.scss'
import ContactorPageHeader from '@/app/(contactor)/_components/ContactorPageHeader'
import { contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import EventCard from '@/components/Event/EventCard'
import { eventOperations } from '@/services/events/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'

const { page, generateMetadata } = serverPage({
    operation: async () => {
        const companyPresentationTag = await eventTagOperations.readSpecial({
            params: { special: 'COMPANY_PRESENTATION' },
        })
        return await eventOperations.readManyCurrent({ params: { tags: [companyPresentationTag.name] } })
    },
    metadata: () => ({ title: 'Bedriftspresentasjoner' }),
    render: ({ data: companyPresentations }) => (
        <>
            <ContactorPageHeader
                badge="Arrangementer"
                title="Bedriftspresentasjoner"
                lead="Kommende bedriftspresentasjoner i regi av Contactor NTNU."
            >
                <Link href={`${contactorNavDef.companyPresentations.href}/archive`}>
                    Tidligere bedriftspresentasjoner<FontAwesomeIcon icon={faArrowRight} />
                </Link>
            </ContactorPageHeader>
            {companyPresentations.length ? (
                <div className={styles.list}>
                    {companyPresentations.map(companyPresentation =>
                        <EventCard
                            key={companyPresentation.id}
                            event={companyPresentation}
                            basePath={contactorNavDef.companyPresentations.href}
                        />
                    )}
                </div>
            ) : (
                <p className={styles.empty}>Det er ingen kommende bedriftspresentasjoner akkurat nå.</p>
            )}
        </>
    ),
})

export default page
export { generateMetadata }

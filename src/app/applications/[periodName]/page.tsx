import styles from './page.module.scss'
import PrioritizedCommittees from './PrioritizedCommittees'
import { default as DateComponent } from '@/components/Date/Date'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import CountDown from '@/components/countDown/CountDown'
import BackdropImage from '@/components/BackdropImage/BackdropImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import PopUp from '@/components/PopUp/PopUp'
import Textarea from '@/components/UI/Textarea'
import Form from '@/components/Form/Form'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import CreateUpdateApplicationPeriodForm from '@/app/applications/CreateUpdateApplicationPeriodForm'
import {
    createApplicationAction,
    updateApplicationAction,
    destroyApplicationAction,
} from '@/services/applications/actions'
import { applicationOperations } from '@/services/applications/operations'
import { updateCommitteeParagraphAction } from '@/services/groups/committees/actions'
import { committeeOperations } from '@/services/groups/committees/operations'
import {
    destroyApplicationPeriodAction,
    removeAllApplicationTextsAction,
} from '@/services/applications/periods/actions'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import { configureAction } from '@/services/configureAction'
import { committeeAuth } from '@/services/groups/committees/auth'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import { serverPage } from '@/app/serverPage'
import { faVideo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { PageOperationArgs, ServerPageSession } from '@/app/serverPage'

export type PropTypes = {
    params: Promise<{
        periodName: string
    }>
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ periodName: string }>) => {
        const userId = session.user?.id
        const period = await applicationPeriodOperations.read({
            params: { name: params.periodName },
        })
        const [applications, committees] = await Promise.all([
            userId
                ? applicationOperations.readForUser({ params: { userId, periodId: period.id } })
                : Promise.resolve([]),
            committeeOperations.readAll({}),
        ])
        return { period, applications, committees }
    },
    metadata: () => ({ title: 'Søknadsperiode' }),
    render: ({ data, session }) => {
        const { period, applications, committees } = data
        const userId = session.user?.id

        const periodWithApplications = {
            ...period,
            committeesParticipating: period.committeesParticipating.map(part => ({
                ...part,
                priority: applications.find(
                    application => application.applicationPeriodCommiteeId === part.id
                )?.priority ?? null,
                text: applications.find(
                    application => application.applicationPeriodCommiteeId === part.id
                )?.text ?? ''
            })).toSorted((partOne, partTwo) => {
                if (partOne.priority === null && partTwo.priority === null) return 0
                if (partOne.priority === null) return 1
                if (partTwo.priority === null) return -1
                return partOne.priority - partTwo.priority
            })
        }

        // The list is already sorted with the applied-to committees first, so the prioritized ones
        // form a prefix that can be handed to the reorderable list as one block.
        const appliedTo = periodWithApplications.committeesParticipating
            .filter(part => part.priority !== null)
        const notAppliedTo = periodWithApplications.committeesParticipating
            .filter(part => part.priority === null)

        type CommitteeParticipation = typeof periodWithApplications.committeesParticipating[number]

        const renderCommitteeCard = (part: CommitteeParticipation, sessionOfRequest: ServerPageSession) => (
            <BackdropImage
                image={part.committee.logoImage}
                imageSize={170}
            >
                <div className={styles.committeeCardContent}>
                    <h2>{part.committee.name}</h2>
                    <CmsParagraph
                        className={styles.committeeParagraph}
                        capabilities={runCapabilities(sessionOfRequest, {
                            canEdit: committeeAuth.updateParagraphContent.data({ groupId: part.committee.groupId }),
                        })}
                        cmsParagraph={part.committee.paragraph}
                        updateCmsParagraphAction={
                            configureAction(
                                updateCommitteeParagraphAction,
                                { implementationParams: { shortName: part.committee.shortName } }
                            )
                        }
                    />
                    <div className={styles.navigation}>
                        {
                            userId ? (
                                <PopUp
                                    popUpKey={`committee-${part.committee.shortName}-apply`}
                                    showButtonContent={
                                        <span>
                                            {part.priority === null ? 'Søk nå!' : 'Endre søknad'}
                                        </span>
                                    }
                                    showButtonClass={styles.applyButton}
                                >
                                    <h1>Søknad til {part.committee.name}</h1>
                                    <Form
                                        closePopUpOnSuccess={
                                            `committee-${part.committee.shortName}-apply`
                                        }
                                        refreshOnSuccess
                                        action={part.priority === null ?
                                            configureAction(createApplicationAction, {
                                                params: { userId, committeeParticipationId: part.id }
                                            }) : configureAction(updateApplicationAction, {
                                                params: { userId, committeeParticipationId: part.id }
                                            })
                                        }
                                        submitText={
                                            part.priority === null ? 'Send søknad' : 'Endre søknad'
                                        }
                                    >
                                        <Textarea
                                            name="text"
                                            label="Søknadstekst"
                                            defaultValue={part.text}
                                            className={styles.textarea}
                                        />
                                    </Form>
                                    {
                                        part.priority !== null && (
                                            <Form
                                                refreshOnSuccess
                                                closePopUpOnSuccess={
                                                    `committee-${part.committee.shortName}-apply`
                                                }
                                                action={configureAction(destroyApplicationAction, {
                                                    params: {
                                                        userId,
                                                        committeeParticipationId: part.id
                                                    }
                                                })}
                                                confirmation={{
                                                    confirm: true,
                                                    text: 'Er du sikker på at du vil slette søknaden?',
                                                }}
                                                submitColor="red"
                                                submitText="Slett søknad"
                                            />
                                        )
                                    }
                                </PopUp>
                            ) : <Link href="/login" className={styles.applyButton}>
                            Logg inn for å søke
                            </Link>
                        }
                        <Link
                            href={`/committees/${part.committee.shortName}`}
                            className={styles.committeeLink}
                        >
                        Les mer
                        </Link>
                        <PopUp
                            popUpKey={`committee-${part.committee.shortName}-video`}
                            showButtonContent={
                                <FontAwesomeIcon icon={faVideo} />
                            }
                            showButtonClass={styles.videoButton}
                        >
                            {/* TODO: Video saved on committee */}
                            <h1>Komitévideo for {part.committee.name}</h1>
                        </PopUp>
                    </div>
                </div>
            </BackdropImage>
        )

        return (
            <PageWrapper headerItem={
                <SettingsHeaderItemPopUp popUpKey={`period-${period.name}-settings`} scale={35}>
                    <CreateUpdateApplicationPeriodForm
                        committees={committees}
                        closePopUpOnSuccess={`period-${period.name}-settings`}
                        period={period}
                    />
                    <p>
                        Etter søknadsperioden er over og plasser fordelt anbefales det av personvernshensyn å
                        fjerne alle søknadstekster. Dette kan gjøres her. Dette sletter ikke historikk om hvem
                        som har søkt og på hva men sletter alle søknadstekstene og bytter de ut med en tom tekst:
                        &quot; SLETTET TEKST &quot;.
                    </p>
                    <Form
                        action={configureAction(removeAllApplicationTextsAction, { params: { name: period.name } })}
                        confirmation={{
                            confirm: true,
                            text: `
                                Er du sikker på at du vil fjerne alle søknadstekster i denne perioden?
                                Dette kan ikke angres!
                            `,
                        }}
                        submitColor="red"
                        submitText="Fjern alle søknadstekster"
                        closePopUpOnSuccess={`period-${period.name}-settings`}
                        refreshOnSuccess
                    />
                    <p>
                        Du kan slette en søknadsperiode dette vil slette alle asosierte søknader,
                        men det er anbefalt å heller fjerne alle søknadstekster istedenfor å slette søknadsperioden.
                    </p>
                    <Form
                        action={configureAction(destroyApplicationPeriodAction, { params: { name: period.name } })}
                        confirmation={{
                            confirm: true,
                            text: `
                                Er du sikker på at du vil slette denne søknadsperioden?
                                Dette kan ikke angres!
                            `,
                        }}
                        submitColor="red"
                        submitText="Slett søknadsperiode"
                        closePopUpOnSuccess={`period-${period.name}-settings`}
                        refreshOnSuccess
                        navigateOnSuccess={'/applications'}
                    />

                </SettingsHeaderItemPopUp>
            }>
                <div className={styles.periodContent}>
                    <div className={styles.top} />

                    <div className={styles.periodDates}>
                        <div className={styles.periodDateItem}>
                            <b>Søknadsstart:</b>
                            <DateComponent date={period.startDate} includeTime />
                        </div>
                        <div className={styles.periodDateItem}>
                            <b>Søknadsfrist:</b>
                            <DateComponent date={period.endDate} includeTime />
                        </div>
                        <div className={styles.periodDateItem}>
                            <b>Frist for prioritering:</b>
                            <DateComponent date={period.endPriorityDate} includeTime />
                        </div>

                        {
                            period.endDate.getTime() > (new Date()).getTime() && (
                                <div className={`${styles.periodDateItem} ${styles.countDownItem}`}>
                                    <b>Nedtelling:</b>
                                    <div className={styles.countDown}>
                                        <Link href={`/applications/${period.name}/countdown`}>
                                            <CountDown referenceDate={period.endDate} />
                                        </Link>
                                    </div>
                                </div>
                            )
                        }
                    </div>

                    <div className={styles.committees}>
                        {
                            userId !== undefined && appliedTo.length > 0 && (
                                <PrioritizedCommittees
                                    userId={userId}
                                    items={appliedTo.map(part => ({
                                        committeeParticipationId: part.id,
                                        card: renderCommitteeCard(part, session),
                                    }))}
                                />
                            )
                        }
                        {
                            notAppliedTo.map(part => (
                                <div key={part.committee.id} className={styles.committeeCard}>
                                    <div className={styles.committeeCardBody}>
                                        {renderCommitteeCard(part, session)}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

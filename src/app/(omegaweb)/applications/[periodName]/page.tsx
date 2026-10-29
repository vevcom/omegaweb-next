import { committeeCardBodyClassName, committeeCardClassName } from './committeeCardClassNames'
import PrioritizedCommittees from './PrioritizedCommittees'
import { default as DateComponent } from '@/components/Date/Date'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import CountDown from '@/components/CountDown/CountDown'
import BackdropImage from '@/components/BackdropImage/BackdropImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import CmsLink from '@/components/Cms/CmsLink/CmsLink'
import PopUp from '@/components/PopUp/PopUp'
import Textarea from '@/components/UI/Textarea'
import Form from '@/components/Form/Form'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import CreateUpdateApplicationPeriodForm from '@/app/(omegaweb)/applications/CreateUpdateApplicationPeriodForm'
import {
    createApplicationAction,
    updateApplicationAction,
    destroyApplicationAction,
} from '@/services/applications/actions'
import { applicationOperations } from '@/services/applications/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import {
    destroyApplicationPeriodAction,
    removeAllApplicationTextsAction,
} from '@/services/applications/periods/actions'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import {
    updateCommitteeParticipationParagraphAction,
    updateCommitteeParticipationVideoLinkAction,
} from '@/services/applications/committeeParticipation/actions'
import { committeeParticipationAuth } from '@/services/applications/committeeParticipation/auth'
import { videoLinkIsSet } from '@/services/applications/committeeParticipation/constants'
import { applicationPeriodAuth } from '@/services/applications/periods/auth'
import { applicationAuth } from '@/services/applications/auth'
import { configureAction } from '@/services/configureAction'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import type { PageOperationArgs, ServerPageSession } from '@/app/ServerPage'

const periodDateItemClassName = `
    bg-surface-raised rounded-inner p-3 flex items-center gap-[0.5em] text-text
    [&>b]:text-accent-blue [&>b]:font-medium [&>b]:whitespace-nowrap
`

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
                : [],
            committeeOperations.readAll({}),
        ])
        return { period, applications, committees }
    },
    capabilities: (data, session) => ({
        canUpdatePeriod: applicationPeriodAuth.update,
        canRemoveAllApplicationTexts: applicationPeriodAuth.removeAllApplicationTexts,
        canDestroyPeriod: applicationPeriodAuth.destroy,
        canCreateApplication: session.user
            ? applicationAuth.create.data({ userId: session.user.id })
            : Require.user(),
        canUpdateApplication: session.user
            ? applicationAuth.update.data({ userId: session.user.id })
            : Require.user(),
        canDestroyApplication: session.user
            ? applicationAuth.destroy.data({ userId: session.user.id })
            : Require.user(),
    }),
    metadata: () => ({ title: 'Søknadsperiode' }),
    render: ({ data, session, capabilities }) => {
        const { period, applications, committees } = data
        const userId = session.user?.id

        const periodWithApplications = {
            ...period,
            committeesParticipating: period.committeesParticipating.map(part => ({
                ...part,
                priority: applications.find(
                    application => application.applicationPeriodCommitteeId === part.id
                )?.priority ?? null,
                text: applications.find(
                    application => application.applicationPeriodCommitteeId === part.id
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

        const renderCommitteeCard = (part: CommitteeParticipation, sessionOfRequest: ServerPageSession) => {
            const cmsCapabilities = runCapabilities(sessionOfRequest, {
                canEditParagraph: committeeParticipationAuth.updateParagraphContent.data({
                    groupId: part.committee.groupId,
                }),
                canEditVideoLink: committeeParticipationAuth.updateVideoLink.data({
                    groupId: part.committee.groupId,
                }),
            })

            return (<BackdropImage
                image={part.committee.logoImage}
                imageSize={170}
            >
                <div className="
                    h-full flex flex-col p-2
                    [&>h2]:shrink-0 [&>h2]:text-l [&>h2]:font-bold [&>h2]:mb-2
                ">
                    <h2>{part.committee.name}</h2>
                    <CmsParagraph
                        className="
                            flex-[1_1_auto] min-h-0 mb-2 overflow-hidden
                            max-mobile:max-h-[calc(14*var(--gap))]
                            [mask-image:linear-gradient(to_bottom,black_calc(100%-2*var(--gap)),transparent)]
                        "
                        capabilities={{ canEdit: cmsCapabilities.canEditParagraph }}
                        cmsParagraph={part.paragraph}
                        updateCmsParagraphAction={
                            configureAction(
                                updateCommitteeParticipationParagraphAction,
                                { implementationParams: { participationId: part.id } }
                            )
                        }
                    />
                    <div className="shrink-0 flex gap-[0.5em] items-center flex-wrap">
                        {
                            userId ? (
                                <PopUp title={`Søknad til ${part.committee.name}`}
                                    popUpKey={`committee-${part.committee.shortName}-apply`}
                                    showButtonContent={
                                        <span>
                                            {part.priority === null ? 'Søk nå!' : 'Endre søknad'}
                                        </span>
                                    }
                                    showButtonClass="btn m-0!"
                                >
                                    {
                                        (part.priority === null
                                            ? capabilities.canCreateApplication.authorized
                                            : capabilities.canUpdateApplication.authorized
                                        ) && (
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
                                                    className="min-w-[50vw] h-[20vh]"
                                                />
                                            </Form>
                                        )
                                    }
                                    {
                                        part.priority !== null && capabilities.canDestroyApplication.authorized && (
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
                            ) : <Link href="/login" className="btn m-0!">
                            Logg inn for å søke
                            </Link>
                        }
                        <Link
                            href={`/committees/${part.committee.shortName}`}
                            className="secondary-btn m-0!"
                        >
                        Les mer
                        </Link>
                        <CmsLink
                            className="
                                min-w-0! h-auto!
                                [&>a]:static! [&>a]:w-auto! [&>a]:h-auto!
                                [&>span]:static! [&>span]:w-auto! [&>span]:h-auto!
                            "
                            cmsLink={part.videoLink}
                            disabled={!videoLinkIsSet(part.videoLink)}
                            capabilities={{ canEdit: cmsCapabilities.canEditVideoLink }}
                            updateCmsLinkAction={
                                configureAction(
                                    updateCommitteeParticipationVideoLinkAction,
                                    { implementationParams: { participationId: part.id } }
                                )
                            }
                        />
                    </div>
                </div>
            </BackdropImage>)
        }

        return (
            <PageWrapper headerItem={
                (
                    capabilities.canUpdatePeriod.authorized
                    || capabilities.canRemoveAllApplicationTexts.authorized
                    || capabilities.canDestroyPeriod.authorized
                ) && (
                    <SettingsHeaderItemPopUp
                        title={`Innstillinger for ${period.name}`}
                        popUpKey={`period-${period.name}-settings`} scale={35}
                    >
                        {capabilities.canUpdatePeriod.authorized && (
                            <CreateUpdateApplicationPeriodForm
                                committees={committees}
                                closePopUpOnSuccess={`period-${period.name}-settings`}
                                period={period}
                            />
                        )}
                        {capabilities.canRemoveAllApplicationTexts.authorized && (
                            <>
                                <p>
                                    Når søknadsperioden er over og plassene er fordelt, anbefaler vi av
                                    personvernhensyn å fjerne alle søknadstekstene. Det kan gjøres her. Historikken
                                    over hvem som har søkt på hva, blir ikke slettet, men alle søknadstekstene
                                    byttes ut med teksten «SLETTET TEKST».
                                </p>
                                <Form
                                    action={configureAction(
                                        removeAllApplicationTextsAction, { params: { name: period.name } }
                                    )}
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
                            </>
                        )}
                        {capabilities.canDestroyPeriod.authorized && (
                            <>
                                <p>
                                    Du kan slette søknadsperioden, men da slettes også alle søknadene i den.
                                    Vi anbefaler heller å fjerne alle søknadstekstene i stedet for å slette
                                    søknadsperioden.
                                </p>
                                <Form
                                    action={configureAction(
                                        destroyApplicationPeriodAction, { params: { name: period.name } }
                                    )}
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
                            </>
                        )}
                    </SettingsHeaderItemPopUp>
                )
            }>
                <div className="
                    rounded-round grid grid-cols-1 gap-2
                    max-mobile:p-2
                ">
                    <div />

                    <div className="flex flex-wrap gap-2">
                        <div className={periodDateItemClassName}>
                            <b>Søknadsstart:</b>
                            <DateComponent date={period.startDate} includeTime />
                        </div>
                        <div className={periodDateItemClassName}>
                            <b>Søknadsfrist:</b>
                            <DateComponent date={period.endDate} includeTime />
                        </div>
                        <div className={periodDateItemClassName}>
                            <b>Frist for prioritering:</b>
                            <DateComponent date={period.endPriorityDate} includeTime />
                        </div>

                        {
                            period.endDate.getTime() > (new Date()).getTime() && (
                                <div className={`
                                    ${periodDateItemClassName}
                                    flex-wrap
                                `}>
                                    <b>Nedtelling:</b>
                                    <div className="
                                        text-m
                                        [&_a]:text-inherit [&_a]:no-underline
                                    ">
                                        <Link href={`/applications/${period.name}/countdown`}>
                                            <CountDown referenceDate={period.endDate} />
                                        </Link>
                                    </div>
                                </div>
                            )
                        }
                    </div>

                    <div className="m-0 pt-2 grid gap-2">
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
                                <div key={part.committee.id} className={committeeCardClassName}>
                                    <div className={committeeCardBodyClassName}>
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

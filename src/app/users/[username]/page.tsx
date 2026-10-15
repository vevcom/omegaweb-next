import { ClassLevelConfig } from '@/services/groups/constants'
import Button from '@/components/UI/Button'
import ProfilePicture from '@/components/User/ProfilePicture'
import UserDisplayName from '@/components/User/UserDisplayName'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import { updateUserBioParagraphContentAction } from '@/services/users/actions'
import { userOperations } from '@/services/users/operations'
import { userAuth } from '@/services/users/auth'
import { configureAction } from '@/services/configureAction'
import { sexConfig } from '@/services/users/constants'
import { flairOperations } from '@/services/flairs/operations'
import { serverPage } from '@/app/ServerPage'
import { RelationshipStatus } from '@/prisma-generated-pn-types'
import UserNavBar from '@/app/users/[username]/UserNavBar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faMoneyBill,
    faQrcode,
    faSignOut,
} from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'
import type { PageOperationArgs } from '@/app/ServerPage'

export type PropTypes = {
    params: Promise<{
        username: string
    }>,
}

// One labelled block per kind of membership, so the studies, the committees and the interest groups are told apart.
const groupSectionClassName = 'mt-[1em] [&_h2]:text-[1.1em] [&_h2]:text-ink-strong'
const labelClassName = 'w-[10em] inline-block font-medium text-accent-blue'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        if (params.username === 'me') {
            if (!session.user) redirect('/login')
            redirect(`/users/${session.user.username}`) //This throws.
        }

        const profile = await userOperations.readProfile({ params: { username: params.username } })
        const flairs = await flairOperations.readUserFlairs({ params: { userId: profile.user.id } })

        return {
            profile,
            flairs: [...flairs].sort((flairOne, flairTwo) => flairOne.rank - flairTwo.rank),
        }
    },
    capabilities: ({ profile }) => ({
        canUpdateBio: userAuth.updateBioParagraphContent.data({ userId: profile.user.id }),
    }),
    metadata: () => ({ title: 'Profil' }),
    render: ({ data, capabilities, session }) => {
        const { profile, flairs } = data

        const { committeeMemberships, activeStudyProgrammes, activeInterestGroups } = profile.groups

        // Newest order first: the history reads from the most recent membership downwards.
        const committeeMembershipsByOrder = [...committeeMemberships.active, ...committeeMemberships.historical]
            .sort((membershipOne, membershipTwo) => membershipTwo.order - membershipOne.order)

        const omegaMembership = profile.omegaMembership

        // NOT_SPECIFIED has no colour, so its profile picture gets no ring.
        const relationshipColour: Partial<Record<RelationshipStatus, string>> = {
            [RelationshipStatus.SINGLE]: 'green',
            [RelationshipStatus.ITS_COMPLICATED]: 'yellow',
            [RelationshipStatus.TAKEN]: 'red',
        }

        const flairColour = {
            '--flairColor': flairs.length > 0
                ? `rgb(${flairs[0].colorR}, ${flairs[0].colorG}, ${flairs[0].colorB})`
                : 'transparent'
        } as React.CSSProperties
        const isOwnProfile = profile.user.id === session.user?.id

        function memberhipTitle(): string {
            switch (omegaMembership.level) {
                case 'SOELLE':
                    return 'Soelle Noviice (avsky!)'
                case 'SYSKEN':
                    return `
                        ${sexConfig[profile.user.sex ?? 'OTHER'].title}
                        uudaf den ${omegaMembership.order}´dis orden i Sanctus Omega Broderskab
                    `
                case 'DEN_GEMENE_HOB':
                    return 'Fortabt uudi den gemene hob'
                default:
            }
            return 'Kunne ikke finne tittel'
        }

        return (
            <div className="h-full">
                <div className="grid grid-rows-[1fr_auto] gap-2 h-full">
                    <div className={[
                        'relative h-full min-h-0 bg-surface-base rounded-round',
                        "before:content-[''] before:absolute before:inset-[calc(0.25rem*1.5)]",
                        'before:rounded-[calc(var(--rounding)-0.375rem)]',
                        'before:border-4 before:border-[color:var(--flairColor,transparent)] before:pointer-events-none',
                    ].join(' ')} style={flairColour}>
                        <div className={[
                            'absolute inset-[calc(0.25rem*1.5+4px)] overflow-y-auto p-8 grid grid-cols-[250px_1fr]',
                            'grid-rows-[auto]',
                            'items-start content-start gap-[0.5em] max-mobile:block',
                        ].join(' ')}>
                            <ProfilePicture
                                width={240}
                                profileImage={profile.user.image}
                                ringColor={relationshipColour[profile.user.relationshipStatus]}
                            />
                            <div
                                className={[
                                    'flex flex-col justify-center',
                                    'max-mobile:text-center max-mobile:items-center max-mobile:my-[1em] max-mobile:mx-[2em]',
                                ].join(' ')}
                            >
                                <div className="flex flex-row flex-wrap items-center max-mobile:justify-center">
                                    <h1 className="mr-[.2em] text-[3em]"><UserDisplayName
                                        user={profile.user}
                                        width={40}
                                    /></h1>
                                </div>
                                <p className="text-text font-secondary font-light italic">
                                    { memberhipTitle() }
                                </p>

                                <div className="flex flex-wrap gap-[0.5em]">
                                    {committeeMemberships.active.map(membership =>
                                        <div
                                            className="mt-[0.5em]"
                                            key={`${membership.committee.shortName}-${membership.order}`}
                                        >
                                            <Link href={`/committees/${membership.committee.shortName}`}>
                                                <p className={[
                                                    'rounded-[0.3em] p-[0.5em] bg-accent-blue',
                                                    'text-surface-base inline-block',
                                                ].join(' ')}>
                                                    {membership.title} i {membership.committee.name}
                                                </p>
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <hr className={[
                                    'border-none h-px my-[0.5em] mr-[4em] ml-0',
                                    'bg-surface-subtle max-mobile:w-4/5 max-mobile:mx-auto',
                                ].join(' ')} />

                                {committeeMembershipsByOrder.length > 0 && (
                                    <section className={groupSectionClassName}>
                                        <h2>Komitémedlemskap:</h2>
                                        {committeeMembershipsByOrder.map(membership =>
                                            <Link
                                                key={`${membership.committee.shortName}-${membership.order}`}
                                                href={`/committees/${membership.committee.shortName}`}
                                                className="no-underline group"
                                            >
                                                <p className="text-accent-blue group-hover:underline">
                                                    {membership.title} udaf {membership.order}´dis orden i{' '}
                                                    {membership.committee.name}
                                                </p>
                                            </Link>
                                        )}
                                    </section>
                                )}

                                {activeInterestGroups.length > 0 && (
                                    <section className={groupSectionClassName}>
                                        <h2>Aktive Interessegruppemedlemskap:</h2>
                                        {activeInterestGroups.map(membership =>
                                            <Link
                                                key={`${membership.interestGroup.id}-${membership.order}`}
                                                href={`/interest-groups/${membership.interestGroup.id}`}
                                                className="no-underline group"
                                            >
                                                <p className="text-accent-blue group-hover:underline">
                                                    {membership.title} udaf {membership.order}´dis orden i{' '}
                                                    {membership.interestGroup.name}
                                                </p>
                                            </Link>
                                        )}
                                    </section>
                                )}

                                {activeStudyProgrammes.length > 0 && (
                                    <section className={groupSectionClassName}>
                                        <h2>Studier:</h2>
                                        {activeStudyProgrammes.map(({ studyProgramme }) =>
                                            <p key={studyProgramme.id} className="text-text">
                                                {studyProgramme.name} {`(${studyProgramme.code})`}
                                            </p>
                                        )}
                                    </section>
                                )}
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="flex flex-col items-center gap-2">
                                    {isOwnProfile && (
                                        <>
                                            <Link href="/users/me/omegaid">
                                                <Button color="secondary" className="flex! items-center! gap-[0.5em]!">
                                                    <FontAwesomeIcon icon={faQrcode} />
                                                    <p className="w-[8em]">Omega-ID</p>
                                                </Button>
                                            </Link>
                                            <Link href="/users/me/account">
                                                <Button color="secondary" className="flex! items-center! gap-[0.5em]!">
                                                    <FontAwesomeIcon icon={faMoneyBill} />
                                                    <p className="w-[8em]">Konto</p>
                                                </Button>
                                            </Link>
                                            <Link href="/logout">
                                                <Button color="secondary" className="flex! items-center! gap-[0.5em]!">
                                                    <FontAwesomeIcon icon={faSignOut} />
                                                    <p className="w-[8em]">Logg ut</p>
                                                </Button>
                                            </Link>
                                        </>
                                    )}
                                </div>

                            </div>
                            <div
                                className={[
                                    'max-mobile:my-[1em] max-mobile:mx-[2em]',
                                    '[&_p]:font-light! [&_p]:mb-[0.5em]! [&_p]:text-text!',
                                ].join(' ')}
                            >


                                {/* An empty bio is only worth showing to someone who can write it, in edit mode. */}
                                {(profile.user.bioParagraph.contentHtml !== '' || capabilities.canUpdateBio.authorized) &&
                                    <div className={[
                                        'mb-[2em] p-[1em] border-l-[3px] border-accent-blue',
                                        'text-ink-hover bg-surface-raised',
                                    ].join(' ')}>
                                        <h2>Bio:</h2>
                                        <CmsParagraph
                                            cmsParagraph={profile.user.bioParagraph}
                                            updateCmsParagraphAction={configureAction(
                                                updateUserBioParagraphContentAction,
                                                { implementationParams: { userId: profile.user.id } }
                                            )}
                                            capabilities={{ canEdit: capabilities.canUpdateBio }}
                                        />
                                    </div>
                                }

                                {(profile.user.relationshipStatus !== RelationshipStatus.NOT_SPECIFIED) &&
                                <p>
                                    <span className={labelClassName}>Sivilstatus: </span>
                                    {profile.user.relationshipStatusText ? profile.user.relationshipStatusText :
                                        profile.user.relationshipStatus === RelationshipStatus.SINGLE && 'Singel' ||
                                        profile.user.relationshipStatus === RelationshipStatus.ITS_COMPLICATED
                                            && 'Det er komplisert' ||
                                        profile.user.relationshipStatus === RelationshipStatus.TAKEN && 'I et forhold'
                                    }

                                </p>
                                }


                                <p>
                                    <span className={labelClassName}>E-post:</span>
                                    {profile.user.email}
                                </p>
                                <p>
                                    <span className={labelClassName}>Brukernavn:</span>
                                    {profile.user.username}
                                </p>
                                <p>
                                    <span className={labelClassName}>Klasse:</span>
                                    {profile.class ? ClassLevelConfig[profile.class.level].name : 'Ingen klasse'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <UserNavBar username={profile.user.username} userId={profile.user.id} />
                </div>
            </div>
        )
    },
})

export default page
export { generateMetadata }

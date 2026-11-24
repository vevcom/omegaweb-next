import Button from '@/components/UI/Button'
import UserProfile, { profileGroupSectionClassName, profileLabelClassName } from '@/components/User/UserProfile'
import { userOperations } from '@/services/users/operations'
import { userAuth } from '@/services/users/auth'
import { flairOperations } from '@/services/flairs/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import { serverPage } from '@/app/ServerPage'
import { RelationshipStatus } from '@/prisma-generated-pn-types'
import UserNavBar from '@/app/(omegaweb)/users/[username]/UserNavBar'
import UserSettingsNav from '@/app/(omegaweb)/users/[username]/UserSettingsNav'
import DirectMessageButton from '@/app/(omegaweb)/users/[username]/DirectMessageButton'
import SiteLink from '@/components/SiteLink/SiteLink'
import { siteRedirect } from '@/app/domainContextOfRequest'
import { appHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { omegaAuthLinks } from '@/app/(omegaweb)/(auth)/links'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSignOut } from '@fortawesome/free-solid-svg-icons'
import React from 'react'
import type { PageOperationArgs } from '@/app/ServerPage'

export type PropTypes = {
    params: Promise<{
        username: string
    }>,
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        if (params.username === 'me') {
            await siteRedirect(session.user ? omegaLinks.user(session.user) : omegaAuthLinks.login())
        }

        const profile = await userOperations.readProfile({ params: { username: params.username } })
        const flairs = await flairOperations.readUserFlairs({ params: { userId: profile.user.id } })
        const isOwnProfile = profile.user.id === session.user?.id
        const directMessage = isOwnProfile
            ? null
            : await chatUserOperations.readDirectMessage({ params: { userId: profile.user.id } })

        return {
            profile,
            isOwnProfile,
            directMessage,
            flairs: [...flairs].sort((flairOne, flairTwo) => flairOne.rank - flairTwo.rank),
        }
    },
    capabilities: ({ profile }) => ({
        canUpdateBio: userAuth.updateBioParagraphContent.data({ userId: profile.user.id }),
    }),
    metadata: () => ({ title: 'Profil' }),
    render: ({ data, capabilities }) => {
        const { profile, flairs, isOwnProfile, directMessage } = data

        const { committeeMemberships, activeInterestGroups } = profile.groups

        // Newest order first: the history reads from the most recent membership downwards.
        const committeeMembershipsByOrder = [...committeeMemberships.active, ...committeeMemberships.historical]
            .sort((membershipOne, membershipTwo) => membershipTwo.order - membershipOne.order)

        const flairColour = {
            '--flairColor': flairs.length > 0
                ? `rgb(${flairs[0].colorR}, ${flairs[0].colorG}, ${flairs[0].colorB})`
                : 'transparent'
        } as React.CSSProperties

        return (
            <div className="h-full">
                <div className="grid grid-rows-[1fr_auto] gap-2 h-full">
                    <div className="
                        relative h-full min-h-0 bg-base-100 rounded-round
                        before:content-[''] before:absolute before:inset-[calc(0.25rem*1.5)]
                        before:rounded-[calc(var(--rounding)-0.375rem)] before:border-4
                        before:border-[color:var(--flairColor,transparent)] before:pointer-events-none
                    " style={flairColour}>
                        <div className="absolute inset-[calc(0.25rem*1.5+4px)] overflow-y-auto p-8">
                            <UserProfile
                                profile={profile}
                                capabilities={capabilities}
                                highlights={
                                    <div className="flex flex-wrap gap-[0.5em]">
                                        {committeeMemberships.active.map(membership =>
                                            <div
                                                className="mt-[0.5em]"
                                                key={`${membership.committee.shortName}-${membership.order}`}
                                            >
                                                <SiteLink href={appHref(`/committees/${membership.committee.shortName}`)}>
                                                    <p className="
                                                        rounded-[0.3em] p-[0.5em] bg-primary text-primary-content
                                                        inline-block
                                                    ">
                                                        {membership.title} i {membership.committee.name}
                                                    </p>
                                                </SiteLink>
                                            </div>
                                        )}
                                    </div>
                                }
                                groups={<>
                                    {committeeMembershipsByOrder.length > 0 && (
                                        <section className={profileGroupSectionClassName}>
                                            <h2>Komitémedlemskap:</h2>
                                            {committeeMembershipsByOrder.map(membership =>
                                                <SiteLink
                                                    key={`${membership.committee.shortName}-${membership.order}`}
                                                    href={appHref(`/committees/${membership.committee.shortName}`)}
                                                    className="no-underline group"
                                                >
                                                    <p className="
                                                        text-primary
                                                        group-hover:underline
                                                    ">
                                                        {membership.title} uudaf {membership.order}´dis orden i{' '}
                                                        {membership.committee.name}
                                                    </p>
                                                </SiteLink>
                                            )}
                                        </section>
                                    )}

                                    {activeInterestGroups.length > 0 && (
                                        <section className={profileGroupSectionClassName}>
                                            <h2>Aktive interessegruppemedlemskap:</h2>
                                            {activeInterestGroups.map(membership =>
                                                <SiteLink
                                                    key={`${membership.interestGroup.id}-${membership.order}`}
                                                    href={appHref(`/interest-groups/${membership.interestGroup.id}`)}
                                                    className="no-underline group"
                                                >
                                                    <p className="
                                                        text-primary
                                                        group-hover:underline
                                                    ">
                                                        {membership.title} uudaf {membership.order}´dis orden i{' '}
                                                        {membership.interestGroup.name}
                                                    </p>
                                                </SiteLink>
                                            )}
                                        </section>
                                    )}
                                </>}
                                actions={<>
                                    {directMessage?.chatIsSetUp && (
                                        <DirectMessageButton
                                            url={directMessage.url}
                                            firstname={profile.user.firstname}
                                        />
                                    )}
                                    {isOwnProfile && (
                                        <SiteLink href={appHref('/logout')}>
                                            <Button color="secondary" className="flex! items-center! gap-[0.5em]!">
                                                <FontAwesomeIcon icon={faSignOut} />
                                                <p className="w-[8em]">Logg ut</p>
                                            </Button>
                                        </SiteLink>
                                    )}
                                    <UserSettingsNav username={profile.user.username} userId={profile.user.id} />
                                </>}
                                details={<>
                                    {(profile.user.relationshipStatus !== RelationshipStatus.NOT_SPECIFIED) &&
                                    <p>
                                        <span className={profileLabelClassName}>Sivilstatus: </span>
                                        {profile.user.relationshipStatusText ? profile.user.relationshipStatusText :
                                            profile.user.relationshipStatus === RelationshipStatus.SINGLE && 'Singel' ||
                                            profile.user.relationshipStatus === RelationshipStatus.ITS_COMPLICATED
                                                && 'Det er komplisert' ||
                                            profile.user.relationshipStatus === RelationshipStatus.TAKEN && 'I et forhold'
                                        }

                                    </p>
                                    }


                                    <p>
                                        <span className={profileLabelClassName}>E-post:</span>
                                        {profile.user.email}
                                    </p>
                                    <p>
                                        <span className={profileLabelClassName}>Brukernavn:</span>
                                        {profile.user.username}
                                    </p>
                                </>}
                            />
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

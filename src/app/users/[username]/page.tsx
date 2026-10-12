import styles from './page.module.scss'
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
import { serverPage } from '@/app/serverPage'
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
import type { PageOperationArgs } from '@/app/serverPage'

export type PropTypes = {
    params: Promise<{
        username: string
    }>,
}

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

        const relationshipColour = {
            [RelationshipStatus.SINGLE]: 'green',
            [RelationshipStatus.ITS_COMPLICATED]: 'yellow',
            [RelationshipStatus.TAKEN]: 'red',
            [RelationshipStatus.NOT_SPECIFIED]: 'white'
        }

        const borderColour = {
            '--border-colour': relationshipColour[profile.user.relationshipStatus]
        } as React.CSSProperties
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
            <div className={styles.wrapper}>
                <div className={styles.profile}>
                    <div className={styles.profileContent} style={{ ...borderColour, ...flairColour }}>
                        <div className={styles.profileContentInner}>
                            <ProfilePicture width={240} profileImage={profile.user.image} className={styles.profilePicture}/>
                            <div className={styles.header}>
                                <div className={styles.nameAndId}>
                                    <h1><UserDisplayName
                                        user={profile.user}
                                        width={40}
                                    /></h1>
                                </div>
                                <p className={styles.orderText}>
                                    { memberhipTitle() }
                                </p>

                                <div className={styles.committeesWrapper}>
                                    {committeeMemberships.active.map(membership =>
                                        <div
                                            className={styles.committee}
                                            key={`${membership.committee.shortName}-${membership.order}`}
                                        >
                                            <Link href={`/committees/${membership.committee.shortName}`}>
                                                <p>{membership.title} i {membership.committee.name}</p>
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <hr />

                                {committeeMembershipsByOrder.length > 0 && (
                                    <section className={styles.groupSection}>
                                        <h2>Komitémedlemskap:</h2>
                                        {committeeMembershipsByOrder.map(membership =>
                                            <Link
                                                key={`${membership.committee.shortName}-${membership.order}`}
                                                href={`/committees/${membership.committee.shortName}`}
                                            >
                                                <p className={styles.studyProgramme}>
                                                    {membership.title} udaf {membership.order}´dis orden i{' '}
                                                    {membership.committee.name}
                                                </p>
                                            </Link>
                                        )}
                                    </section>
                                )}

                                {activeInterestGroups.length > 0 && (
                                    <section className={styles.groupSection}>
                                        <h2>Aktive Interessegruppemedlemskap:</h2>
                                        {activeInterestGroups.map(membership =>
                                            <Link
                                                key={`${membership.interestGroup.id}-${membership.order}`}
                                                href={`/interest-groups/${membership.interestGroup.id}`}
                                            >
                                                <p className={styles.studyProgramme}>
                                                    {membership.title} udaf {membership.order}´dis orden i{' '}
                                                    {membership.interestGroup.name}
                                                </p>
                                            </Link>
                                        )}
                                    </section>
                                )}

                                {activeStudyProgrammes.length > 0 && (
                                    <section className={styles.groupSection}>
                                        <h2>Studier:</h2>
                                        {activeStudyProgrammes.map(({ studyProgramme }) =>
                                            <p key={studyProgramme.id} className={styles.studyProgramme}>
                                                {studyProgramme.name} {`(${studyProgramme.code})`}
                                            </p>
                                        )}
                                    </section>
                                )}
                            </div>
                            <div className={styles.leftSection}>
                                <div className={styles.buttons}>
                                    {isOwnProfile && (
                                        <>
                                            <Link href="/users/me/omegaid">
                                                <Button color="secondary" className={styles.actionButton}>
                                                    <FontAwesomeIcon icon={faQrcode} />
                                                    <p>Omega-ID</p>
                                                </Button>
                                            </Link>
                                            <Link href="/users/me/account">
                                                <Button color="secondary" className={styles.actionButton}>
                                                    <FontAwesomeIcon icon={faMoneyBill} />
                                                    <p>Konto</p>
                                                </Button>
                                            </Link>
                                            <Link href="/logout">
                                                <Button color="secondary" className={styles.actionButton}>
                                                    <FontAwesomeIcon icon={faSignOut} />
                                                    <p>Logg ut</p>
                                                </Button>
                                            </Link>
                                        </>
                                    )}
                                </div>

                            </div>
                            <div className={styles.profileMain}>


                                {/* An empty bio is only worth showing to someone who can write it, in edit mode. */}
                                {(profile.user.bioParagraph.contentHtml !== '' || capabilities.canUpdateBio.authorized) &&
                                    <div className={styles.bio}>
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
                                    <span className={styles.relationshipStatus}>Sivilstatus: </span>
                                    {profile.user.relationshipStatusText ? profile.user.relationshipStatusText :
                                        profile.user.relationshipStatus === RelationshipStatus.SINGLE && 'Singel' ||
                                        profile.user.relationshipStatus === RelationshipStatus.ITS_COMPLICATED
                                            && 'Det er komplisert' ||
                                        profile.user.relationshipStatus === RelationshipStatus.TAKEN && 'I et forhold'
                                    }

                                </p>
                                }


                                <p>
                                    <span className={styles.email}>E-post:</span>
                                    {profile.user.email}
                                </p>
                                <p>
                                    <span className={styles.username}>Brukernavn:</span>
                                    {profile.user.username}
                                </p>
                                <p>
                                    <span className={styles.username}>Klasse:</span>
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

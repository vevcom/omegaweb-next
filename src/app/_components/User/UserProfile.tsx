import ProfilePicture from '@/components/User/ProfilePicture'
import UserDisplayName from '@/components/User/UserDisplayName'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import { ClassLevelConfig } from '@/services/groups/constants'
import { updateUserBioParagraphContentAction } from '@/services/users/actions'
import { configureAction } from '@/services/configureAction'
import { sexConfig } from '@/services/users/constants'
import { RelationshipStatus } from '@/prisma-generated-pn-types'
import type { userOperations } from '@/services/users/operations'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { ReactNode } from 'react'

type PropTypes = {
    profile: Awaited<ReturnType<typeof userOperations.readProfile>>,
    capabilities: Capabilities<'canUpdateBio'>,
    /** Shown under the membership title. */
    highlights?: ReactNode,
    /** Shown under the line below the name, before the studies. */
    groups?: ReactNode,
    /** Shown under the picture. */
    actions?: ReactNode,
    /** Shown after the bio, before the class. */
    details?: ReactNode,
}

export const profileGroupSectionClassName = `
    mt-[1em]
    [&_h2]:text-[1.1em] [&_h2]:text-base-content
`
export const profileLabelClassName = 'w-[10em] inline-block font-medium text-primary'

/** A person as their profile shows them: picture, name with flairs, membership title, studies, bio and class. */
export default function UserProfile({ profile, capabilities, highlights, groups, actions, details }: PropTypes) {
    const { activeStudyProgrammes } = profile.groups
    const omegaMembership = profile.omegaMembership

    // NOT_SPECIFIED has no colour, so its profile picture gets no ring.
    const relationshipColour: Partial<Record<RelationshipStatus, string>> = {
        [RelationshipStatus.SINGLE]: 'green',
        [RelationshipStatus.ITS_COMPLICATED]: 'yellow',
        [RelationshipStatus.TAKEN]: 'red',
    }

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
        <div className="
            grid grid-cols-[250px_1fr] grid-rows-[auto] items-start content-start gap-[0.5em]
            max-mobile:block
        ">
            <ProfilePicture
                width={240}
                profileImage={profile.user.image}
                ringColor={relationshipColour[profile.user.relationshipStatus]}
            />
            <div
                className="
                    flex flex-col justify-center
                    max-mobile:text-center max-mobile:items-center max-mobile:my-[1em] max-mobile:mx-[2em]
                "
            >
                <div className="
                    flex flex-row flex-wrap items-center
                    max-mobile:justify-center
                ">
                    <h1 className="mr-[.2em] text-[3em]"><UserDisplayName
                        user={profile.user}
                        width={40}
                    /></h1>
                </div>
                <p className="text-base-content font-secondary font-light italic">
                    { memberhipTitle() }
                </p>

                {highlights}

                <hr className="
                    border-none h-px my-[0.5em] mr-[4em] ml-0 bg-base-300
                    max-mobile:w-4/5 max-mobile:mx-auto
                " />

                {groups}

                {activeStudyProgrammes.length > 0 && (
                    <section className={profileGroupSectionClassName}>
                        <h2>Studier:</h2>
                        {activeStudyProgrammes.map(({ studyProgramme }) =>
                            <p key={studyProgramme.id} className="text-base-content">
                                {studyProgramme.name} {`(${studyProgramme.code})`}
                            </p>
                        )}
                    </section>
                )}
            </div>
            <div className="flex flex-col items-center">
                <div className="flex flex-col items-center gap-2">
                    {actions}
                </div>

            </div>
            <div
                className="
                    max-mobile:my-[1em] max-mobile:mx-[2em]
                    [&_p]:font-light! [&_p]:mb-[0.5em]! [&_p]:text-base-content!
                "
            >


                {/* An empty bio is only worth showing to someone who can write it, in edit mode. */}
                {(profile.user.bioParagraph.contentHtml !== '' || capabilities.canUpdateBio.authorized) &&
                    <div className="mb-[2em] p-[1em] border-l-[3px] border-primary text-base-content/80 bg-base-200">
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

                {details}

                <p>
                    <span className={profileLabelClassName}>Klasse:</span>
                    {profile.class ? ClassLevelConfig[profile.class.level].name : 'Ingen klasse'}
                </p>
            </div>
        </div>
    )
}

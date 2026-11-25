import { revueLinks } from '@/app/(revue)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import UserProfile from '@/components/User/UserProfile'
import SiteLink from '@/components/SiteLink/SiteLink'
import { userOperations } from '@/services/users/operations'
import { userAuth } from '@/services/users/auth'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { groupTypesConfig } from '@/services/groups/constants'
import { serverPage } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faGear } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const profile = await userOperations.readProfile({ params: { username: params.username } })
        const revueGroups = await revueGroupOperations.readManyOfUser({ params: { userId: profile.user.id } })
        return { profile, revueGroups, isOwnProfile: profile.user.id === session.user?.id }
    },
    capabilities: ({ profile }) => ({
        canUpdateBio: userAuth.updateBioParagraphContent.data({ userId: profile.user.id }),
    }),
    metadata: ({ profile }) => ({ title: `${profile.user.firstname} ${profile.user.lastname}` }),
    render: ({ data: { profile, revueGroups, isOwnProfile }, capabilities }) => (
        <div className="flex flex-col gap-12">
            <UserProfile
                profile={profile}
                capabilities={capabilities}
                actions={isOwnProfile && (
                    <SiteLink
                        href={omegaLinks.userSettings(profile.user)}
                        toMainDomainServingSite
                        className="
                            inline-flex items-center gap-2 text-m
                            [&_svg]:size-[0.9em]!
                        "
                    >
                        <FontAwesomeIcon icon={faGear} />
                        Innstillinger på Omegaveven
                    </SiteLink>
                )}
            />
            <section className="flex flex-col gap-6">
                <h2 className="font-secondary text-xl">Revygrupper</h2>
                {revueGroups.length > 0 ? (
                    <ul className="flex flex-col gap-3 list-none">
                        {revueGroups.map(revueGroup => (
                            <li key={`${revueGroup.revue.year}-${revueGroup.name}`}>
                                <SiteLink
                                    href={revueLinks.revueGroup(revueGroup.revue, revueGroup)}
                                    className="
                                        group flex items-center gap-4 p-4 rounded-round border-l-4 border-accent
                                        bg-base-200 text-base-content no-underline transition-colors
                                        hover:bg-base-300 hover:no-underline
                                        focus-visible:outline-2 focus-visible:outline-offset-2
                                        focus-visible:outline-accent
                                    "
                                >
                                    <span className="font-secondary text-xl font-bold text-primary">
                                        {revueGroup.revue.year}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-secondary text-l font-bold wrap-anywhere">
                                            {revueGroup.name}
                                            <span className="text-s font-normal text-base-content/80">
                                                {' · '}{groupTypesConfig[revueGroup.type].name}
                                            </span>
                                        </span>
                                        <span className="block text-s text-base-content/80 wrap-anywhere">
                                            {revueGroup.title} i {revueGroup.revue.name} · {revueGroup.order}. orden
                                        </span>
                                    </span>
                                    <FontAwesomeIcon icon={faArrowRight} className="
                                        size-[1em]! text-primary transition-transform
                                        group-hover:translate-x-1
                                    " />
                                </SiteLink>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-base-content/80">Ingen revygrupper.</p>}
            </section>
        </div>
    ),
})

export default page
export { generateMetadata }

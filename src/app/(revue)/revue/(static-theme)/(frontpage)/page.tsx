import CreateRevue from './CreateRevue'
import { revueLinks } from '@/app/(revue)/links'
import {
    updateMainRevueInfoAction,
    updateMainRevueInfoAddSectionAction,
    updateMainRevueInfoCmsImageAction,
    updateMainRevueInfoCmsLinkAction,
    updateMainRevueInfoCmsParagraphAction,
    updateMainRevueInfoCoverImageAction,
    updateMainRevueInfoReorderSectionsAction,
    updateMainRevueInfoSectionAction,
    updateMainRevueInfoSectionsAddPartAction,
    updateMainRevueInfoSectionsRemovePartAction
} from '@/services/revue/frontpage/actions'
import { revueFrontpageOperations } from '@/services/revue/frontpage/operations'
import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import RevueCover from '@/app/(revue)/_components/RevueCover'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import SiteLink from '@/components/SiteLink/SiteLink'
import { revueFrontpageAuth } from '@/services/revue/frontpage/auth'
import { revueThemeOf } from '@/app/(revue)/_lib/revueTheme'
import { serverPage, withFallback } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'

const linkClassName = `
    group/cover block rounded-round no-underline
    hover:no-underline
    focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent
`

const { page, generateMetadata } = serverPage({
    operation: async () => ({
        article: await revueFrontpageOperations.mainRevueInfo.read({}),
        revues: await revueOperations.readMany({}),
        carryOver: await withFallback(
            revueGroupOperations.readToCarryOver({}),
            null,
            ['UNAUTHENTICATED', 'UNAUTHORIZED'],
        ),
    }),
    capabilities: () => ({
        canEdit: revueFrontpageAuth.mainRevueInfo.update,
    }),
    // Absolute: the frontpage is the site, so the layout's template would read "Omegarevyen | Omegarevyen".
    metadata: () => ({ title: { absolute: 'Omegarevyen' } }),
    render: ({ data: { article, revues: [currentRevue, ...earlierRevues], carryOver }, capabilities }) => (
        <div className="flex flex-col gap-12">
            <CreateRevue carryOver={carryOver} />
            {currentRevue && (
                <SiteLink
                    href={revueLinks.revue(currentRevue)}
                    className={linkClassName}
                >
                    <RevueCover
                        image={currentRevue.article.coverImage.image}
                        year={currentRevue.year}
                        label="Nyeste revy"
                        imageWidth={1100}
                        colors={revueThemeOf(currentRevue)}
                        insideLink
                        className="min-h-[clamp(22rem,55vw,32rem)]"
                    >
                        <span className="
                            font-secondary text-[clamp(2.25rem,7cqw,4.5rem)] font-bold leading-[1.05] text-balance
                        ">
                            {currentRevue.name}
                        </span>
                        <span className="
                            inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-accent text-m font-semibold
                            text-accent-content
                        ">
                            Til revyen
                            <FontAwesomeIcon icon={faArrowRight} className="
                                size-[0.9em]! transition-transform
                                group-hover/cover:translate-x-1
                            " />
                        </span>
                    </RevueCover>
                </SiteLink>
            )}
            <SpecialArticle
                article={article}
                capabilities={capabilities}
                coverImageClass="[&_h1]:normal-case"
                actions={{
                    update: updateMainRevueInfoAction,
                    addSection: updateMainRevueInfoAddSectionAction,
                    reorderSections: updateMainRevueInfoReorderSectionsAction,
                    coverImage: updateMainRevueInfoCoverImageAction,
                    articleSections: {
                        update: updateMainRevueInfoSectionAction,
                        addPart: updateMainRevueInfoSectionsAddPartAction,
                        removePart: updateMainRevueInfoSectionsRemovePartAction,
                        cmsImage: updateMainRevueInfoCmsImageAction,
                        cmsParagraph: updateMainRevueInfoCmsParagraphAction,
                        cmsLink: updateMainRevueInfoCmsLinkAction,
                    }
                }}
            />
            {earlierRevues.length > 0 && (
                <section className="flex flex-col gap-6">
                    <h2 className="font-secondary text-xl">Tidligere revyer</h2>
                    <ul className="
                        grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4 list-none
                        mobile:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] mobile:gap-6
                    ">
                        {earlierRevues.map(revue => (
                            <li key={revue.id}>
                                <SiteLink
                                    href={revueLinks.revue(revue)}
                                    className={linkClassName}
                                >
                                    <RevueCover
                                        image={revue.article.coverImage.image}
                                        year={revue.year}
                                        imageWidth={360}
                                        colors={revueThemeOf(revue)}
                                        insideLink
                                        className="
                                            aspect-[3/4] transition-transform duration-300
                                            group-hover/cover:-translate-y-1
                                        "
                                    >
                                        <span className="
                                            font-secondary text-[clamp(1.05rem,9cqw,1.6rem)] font-bold leading-tight
                                            text-balance
                                        ">
                                            {revue.name}
                                        </span>
                                    </RevueCover>
                                </SiteLink>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }

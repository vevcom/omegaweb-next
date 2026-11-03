import EditJobAd from '@/components/JobAds/EditJobAd'
import Article from '@/components/Cms/Article/Article'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import Company from '@/components/Company/Company'
import Date from '@/components/Date/Date'
import {
    updateJobAdArticleAction,
    updateJobAdArticleAddSectionAction,
    updateJobAdArticleCmsImageAction,
    updateJobAdArticleCmsLinkAction,
    updateJobAdArticleCmsParagraphAction,
    updateJobAdArticleCoverImageAction,
    updateJobAdArticleReorderSectionsAction,
    updateJobAdArticleSectionAction,
    updateJobAdArticleSectionsAddPartAction,
    updateJobAdArticleSectionsRemovePartAction
} from '@/services/careers/jobAds/actions'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { jobAdType } from '@/services/careers/jobAds/constants'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { configureAction } from '@/services/configureAction'
import { jobAdAuth } from '@/services/careers/jobAds/auth'
import { serverPage } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faCheckCircle,
    faClock,
    faLocationDot,
    faNewspaper,
    faSuitcase,
    faXmarkCircle
} from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

/** One job ad, rendered under `basePath` on both Omega's site and the career site. */
export const jobAdPage = (basePath: string) => serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) =>
        jobAdOperations.read({ params: { id: decodeVevenUriHandleError(params.nameAndId) } }),
    capabilities: () => ({
        canEdit: jobAdAuth.updateArticle,
    }),
    metadata: (jobAd) => ({ title: jobAd.article.name }),
    render: ({ data: jobAd, capabilities }) => (
        <div className="min-h-full flex flex-col">
            <main className="flex-[1_0_auto]">
                <Article
                    capabilities={capabilities}
                    article={jobAd.article}
                    coverImageClass="rounded-round overflow-hidden mb-2"
                    sideBarClassName="
                        p-2 rounded-round ml-2 bg-surface-base
                        max-mobile:ml-0 max-mobile:mt-2
                    "
                    articleClassName="bg-surface-base rounded-round"
                    addSectionClassName="mx-4 mb-0"
                    actions={{
                        updateArticleAction: configureAction(
                            updateJobAdArticleAction,
                            { implementationParams: { jobAdId: jobAd.id } }
                        ),
                        updateCoverImageAction: configureAction(
                            updateJobAdArticleCoverImageAction,
                            { implementationParams: { jobAdId: jobAd.id } }
                        ),
                        addSectionToArticleAction: configureAction(
                            updateJobAdArticleAddSectionAction,
                            { implementationParams: { jobAdId: jobAd.id } }
                        ),
                        reorderArticleSectionsAction: configureAction(
                            updateJobAdArticleReorderSectionsAction,
                            { implementationParams: { jobAdId: jobAd.id } }
                        ),
                        articleSections: {
                            updateCmsParagraph: configureAction(
                                updateJobAdArticleCmsParagraphAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            ),
                            updateCmsImage: configureAction(
                                updateJobAdArticleCmsImageAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            ),
                            updateCmsLink: configureAction(
                                updateJobAdArticleCmsLinkAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            ),
                            updateArticleSection: configureAction(
                                updateJobAdArticleSectionAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            ),
                            addPartToArticleSection: configureAction(
                                updateJobAdArticleSectionsAddPartAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            ),
                            removePartFromArticleSection: configureAction(
                                updateJobAdArticleSectionsRemovePartAction,
                                { implementationParams: { jobAdId: jobAd.id } }
                            )
                        }
                    }}
                    sideBarContent={
                        <>
                            <ul
                                className="
                                    flex flex-col gap-[1em]
                                    [&>li]:grid [&>li]:grid-cols-[40px_1fr] [&>li]:grid-rows-[auto_auto]
                                    [&>li_svg]:size-[20px]! [&>li_svg]:row-[1/3] [&>li_svg]:col-[1/2] [&>li_svg]:my-auto
                                    [&>li_svg]:ml-auto [&>li_svg]:mr-2
                                "
                            >
                                <li>
                                    <FontAwesomeIcon icon={faSuitcase} />
                                    <h3>Stillingstype</h3>
                                    <p>{jobAdType[jobAd.type].label}</p>
                                </li>
                                <li>
                                    <FontAwesomeIcon icon={jobAd.active ? faCheckCircle : faXmarkCircle} />
                                    <h3>Status</h3>
                                    <p>
                                        {jobAd.active
                                            ? 'Denne jobbannonsen er aktiv'
                                            : 'Denne jobbannonsen er arkivert'}
                                    </p>
                                </li>
                                <li>
                                    <FontAwesomeIcon icon={faClock} />
                                    <h3>Søknadsfrist</h3>
                                    {jobAd.rollingDueDate
                                        ?
                                        <p>Løpende frist</p>
                                        :
                                        <p>
                                            {jobAd.applicationDeadline ?
                                                <Date date={jobAd.applicationDeadline} /> :
                                                'Ingen søknadsfrist satt'
                                            }
                                        </p>
                                    }
                                </li>
                                <li>
                                    <FontAwesomeIcon icon={faNewspaper} />
                                    <h3>Publisert</h3>
                                    <p>
                                        <Date date={jobAd.createdAt} />
                                    </p>
                                </li>
                                <li>
                                    <FontAwesomeIcon icon={faLocationDot} />
                                    <h3>Sted</h3>
                                    <p>{jobAd.location}</p>
                                </li>
                            </ul>
                            <div className="
                                mt-[2em]
                                [&>h2]:text-xl [&>h2]:mb-[1em]
                            ">
                                <h2>Arbeidsgiver</h2>
                                <Company
                                    disableEdit
                                    squareLogo={false}
                                    company={jobAd.company}
                                />
                            </div>
                        </>
                    } />
            </main>
            <CompanyPagingProvider
                serverRenderedData={[]}
                startPage={{
                    page: 0,
                    pageSize: 10
                }}
                details={{ name: undefined }}
            >
                <CompanySelectionProvider company={jobAd.company}>
                    <EditJobAd jobAd={jobAd} basePath={basePath} />
                </CompanySelectionProvider>
            </CompanyPagingProvider>
        </div>

    ),
})

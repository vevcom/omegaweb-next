import styles from './page.module.scss'
import EditJobAd from './EditJobAd'
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
} from '@/services/career/jobAds/actions'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { jobAdType } from '@/services/career/jobAds/constants'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { configureAction } from '@/services/configureAction'
import { jobAdAuth } from '@/services/career/jobAds/auth'
import { serverPage } from '@/app/serverPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faCheckCircle,
    faClock,
    faLocationDot,
    faNewspaper,
    faSuitcase,
    faXmarkCircle
} from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) =>
        jobAdOperations.read({ params: { id: decodeVevenUriHandleError(params.nameAndId) } }),
    capabilities: () => ({
        canEdit: jobAdAuth.updateArticle,
    }),
    metadata: (jobAd) => ({ title: jobAd.article.name }),
    render: ({ data: jobAd, capabilities }) => (
        <div className={styles.wrapper}>
            <main className={styles.main}>
                <Article
                    capabilities={capabilities}
                    article={jobAd.article}
                    coverImageClass={styles.coverImage}
                    sideBarClassName={styles.sideBar}
                    articleClassName={styles.articleZone}
                    addSectionClassName={styles.addSectionZone}
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
                            <ul className={styles.metInfo}>
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
                                            ? 'Denne jobbanonsen er aktiv'
                                            : 'Denne jobbanonsen er arkivert'}
                                    </p>
                                </li>
                                <li>
                                    <FontAwesomeIcon icon={faClock} />
                                    <h3>Søknadsfrist</h3>
                                    <p>
                                        { jobAd.applicationDeadline ?
                                            <Date date={jobAd.applicationDeadline} /> :
                                            'Ingen søknadsfrist satt'
                                        }
                                    </p>
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
                            <div className={styles.company}>
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
                    <EditJobAd jobAd={jobAd}/>
                </CompanySelectionProvider>
            </CompanyPagingProvider>
        </div>

    ),
})

export default page
export { generateMetadata }

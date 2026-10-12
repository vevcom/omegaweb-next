import styles from './page.module.scss'
import MembershipStatusUserSearch from './MembershipStatusUserSearch'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { admissionDisplayNames, allAdmissions } from '@/services/admission/constants'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { userAuth } from '@/services/users/auth'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faScroll } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('admission', session),
    capabilities: () => ({
        canSearchUsers: userAuth.readPage,
    }),
    metadata: () => ({ title: 'Opptak' }),
    render: ({ capabilities }) => (
        <PageWrapper>
            <div className={styles.wrapper}>
                <section className={styles.section}>
                    <h2>Registrer opptaksprøve</h2>
                    <p className={styles.lead}>
                        Velg prøven som skal registreres, og les av Omega-ID eller søk opp soellen.
                    </p>
                    <div className={styles.trials}>
                        {allAdmissions.map(admission => (
                            <Link
                                key={admission}
                                href={`/admin/admission/${admission}`}
                                className={styles.trial}
                            >
                                <FontAwesomeIcon icon={faScroll} className={styles.trialIcon} />
                                <span className={styles.trialName}>{admissionDisplayNames[admission]}</span>
                                <FontAwesomeIcon icon={faChevronRight} className={styles.trialArrow} />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className={styles.section}>
                    <h2>Medlemsstatus</h2>
                    <p className={styles.lead}>
                        Søk opp en bruker for å se hvilke prøver de har tatt, og for å endre medlemskapet deres.
                    </p>
                    {capabilities.canSearchUsers.authorized ? (
                        <UserPagingProvider
                            startPage={{ page: 0, pageSize: 50 }}
                            serverRenderedData={[]}
                            details={{ partOfName: '', groups: [] }}
                        >
                            <MembershipStatusUserSearch />
                        </UserPagingProvider>
                    ) : (
                        <p className={styles.lead}>
                            Du mangler tilgangen «Les bruker», og kan derfor ikke søke opp brukere her.
                        </p>
                    )}
                </section>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

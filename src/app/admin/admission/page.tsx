import MembershipStatusUserSearch from './MembershipStatusUserSearch'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { admissionDisplayNames, allAdmissions } from '@/services/admission/constants'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { userAuth } from '@/services/users/auth'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faScroll } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => authorizeAdminPage('admission', session),
    capabilities: () => ({
        canSearchUsers: userAuth.readPage,
    }),
    metadata: () => ({ title: 'Opptak' }),
    render: ({ capabilities }) => (
        <PageWrapper>
            <div className="flex flex-col gap-4">
                <section className="[&_h2]:m-0">
                    <h2>Registrer opptaksprøve</h2>
                    <p className="mx-0 my-2 text-text-muted">
                        Velg prøven som skal registreres, og les av Omega-ID eller søk opp soellen.
                    </p>
                    <div className="flex flex-row flex-wrap gap-2">
                        {allAdmissions.map(admission => (
                            <Link
                                key={admission}
                                href={`/admin/admission/${admission}`}
                                className={[
                                    'flex items-center gap-2 flex-[1_1_14rem] max-mobile:basis-full',
                                    'p-(--card-padding) rounded-round bg-surface-raised text-text',
                                    'transition-[background-color] duration-300 hover:bg-surface-hover',
                                    'hover:text-ink-strong',
                                ].join(' ')}
                            >
                                <FontAwesomeIcon icon={faScroll} className="text-accent-blue text-xl" />
                                <span className="flex-1 font-light">{admissionDisplayNames[admission]}</span>
                                <FontAwesomeIcon icon={faChevronRight} className="text-text-muted" />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="[&_h2]:m-0">
                    <h2>Medlemsstatus</h2>
                    <p className="mx-0 my-2 text-text-muted">
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
                        <p className="mx-0 my-2 text-text-muted">
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

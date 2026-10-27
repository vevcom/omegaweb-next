import CommitteeCard from '@/components/Committee/CommitteeCard/CommitteeCard'
import { committeeOperations } from '@/services/groups/committees/operations'
import SearchBar from '@/UI/SearchBar'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const search = QueryParams.search.decode(searchParams) ?? ''
        return {
            search,
            committees: (await committeeOperations.search({ params: { query: search } })).rows,
        }
    },
    metadata: () => ({ title: 'Komitéer' }),
    render: ({ data: { search, committees } }) => {
        // A pensioned committee is part of Omega's history rather than of it now, so it is listed
        // below the ones that still run rather than mixed in among them.
        const active = committees.filter(committee => !committee.group.pensioned)
        const pensioned = committees.filter(committee => committee.group.pensioned)

        const committeeCards = (toShow: typeof committees) => (
            <div className="
                grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2 overflow-visible
                max-mobile:grid-cols-1
            ">
                {toShow.map(committee => (
                    <CommitteeCard
                        key={committee.id}
                        title={committee.name}
                        href={`/committees/${committee.shortName}`}
                        image={committee.logoImage}
                    />
                ))}
            </div>
        )

        return (
            <div className="w-full h-full text-text self-start">
                <div className="mb-2">
                    <SearchBar defaultValue={search} label="Søk etter komité" />
                </div>
                {
                    committees.length ? (
                        <>
                            {committeeCards(active)}
                            {pensioned.length > 0 && (
                                <>
                                    <h2 className="mt-8 text-text-muted">Pensjonerte</h2>
                                    {committeeCards(pensioned)}
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3 mt-12 text-text-muted">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-4xl" />
                            <i>{search ? 'Ingen komitéer matcher søket' : 'Ingen komitéer å vise'}</i>
                        </div>
                    )
                }
            </div>
        )
    },
})

export default page
export { generateMetadata }

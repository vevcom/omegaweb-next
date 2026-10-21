import CommitteeCard from '@/components/Committee/CommitteeCard/CommitteeCard'
import { committeeOperations } from '@/services/groups/committees/operations'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async () => committeeOperations.readAll({}),
    metadata: () => ({ title: 'Komiteer' }),
    render: ({ data: committees }) => {
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
                        <i>
                            Ingen komiteer å vise
                        </i>
                    )
                }
            </div>
        )
    },
})

export default page
export { generateMetadata }

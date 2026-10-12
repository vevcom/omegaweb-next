import styles from './page.module.scss'
import CommitteeCard from '@/components/Committee/CommitteeCard/CommitteeCard'
import { committeeOperations } from '@/services/groups/committees/operations'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => committeeOperations.readAll({}),
    metadata: () => ({ title: 'Komiteer' }),
    render: ({ data: committees }) => {
        // A pensioned committee is part of Omega's history rather than of it now, so it is listed
        // below the ones that still run rather than mixed in among them.
        const active = committees.filter(committee => !committee.pensioned)
        const pensioned = committees.filter(committee => committee.pensioned)

        const committeeCards = (toShow: typeof committees) => (
            <div className={styles.committeeList}>
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
            <div className={styles.wrapper}>
                {
                    committees.length ? (
                        <>
                            {committeeCards(active)}
                            {pensioned.length > 0 && (
                                <>
                                    <h2 className={styles.pensionedHeading}>Pensjonerte</h2>
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

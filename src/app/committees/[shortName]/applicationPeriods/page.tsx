import styles from './page.module.scss'
import { PeriodSection } from './periodTableSection'
import getCommittee from '@/app/committees/[shortName]/getCommittee'
import { committeeParticipationOperations } from '@/services/applications/committeeParticipation/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const committeePeriodes = await committeeParticipationOperations.readAll({
            params: { committeeId: committee.id },
        })
        return {
            shortName: params.shortName,
            committeePeriodes: [...committeePeriodes].sort(
                (periodOne, periodTwo) => periodTwo.startDate.getTime() - periodOne.startDate.getTime()
            ),
        }
    },
    render: ({ data }) => {
        if (data.committeePeriodes.length === 0) { return 'ingen søknadsperioder funnet' }

        return (
            <table className={styles.periodTable}>
                <thead>
                    <tr className={styles.periodHeading}>
                        <th className={styles.tableEntry}>Start dato</th>
                        <th className={styles.tableEntry}>Slutt dato</th>
                        <th className={styles.tableEntry}>Omprioritering slutt dato</th>
                        <th className={styles.tableEntry}>Søknader</th>
                        <th className={styles.tableEntry}>Søknadstall</th>
                    </tr>
                </thead>
                <tbody>
                    {data.committeePeriodes.map((period, index) => (
                        <PeriodSection shortName={data.shortName} key={index} period={period}></PeriodSection>
                    ))
                    }
                </tbody>
            </table >
        )
    },
})

export default page
export { generateMetadata }

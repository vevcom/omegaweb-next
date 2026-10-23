import { PeriodSection } from './PeriodSection'
import getCommittee from '@/app/(omegaweb)/committees/[shortName]/getCommittee'
import { committeeParticipationOperations } from '@/services/applications/committeeParticipation/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const tableEntryClassName = 'border-2 border-[hsla(0,0%,70%,0.507)] p-[1em]'

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
            <table className="border-2 border-[hsla(0,0%,70%,0.507)] border-collapse text-center round">
                <thead>
                    <tr>
                        <th className={tableEntryClassName}>Start dato</th>
                        <th className={tableEntryClassName}>Slutt dato</th>
                        <th className={tableEntryClassName}>Omprioritering slutt dato</th>
                        <th className={tableEntryClassName}>Søknader</th>
                        <th className={tableEntryClassName}>Søknadstall</th>
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

import CreateOmbul from './CreateOmbul'
import OmbulCover from './OmbulCover'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { ombulOperations } from '@/services/ombul/operations'
import { ombulAuth } from '@/services/ombul/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { ExpandedOmbul } from '@/services/ombul/types'

const { page, generateMetadata } = serverPage({
    operation: async () => {
        const [latestOmbul, ombuls] = await Promise.all([
            withFallback(ombulOperations.readLatest({}), null),
            ombulOperations.readAll({}),
        ])
        return { latestOmbul, ombuls }
    },
    capabilities: () => ({
        canCreate: ombulAuth.create,
    }),
    metadata: () => ({ title: 'Ombul' }),
    render: ({ data, capabilities }) => {
        const yearsWithOmbul = Object.entries(data.ombuls.reduce((groups, ombul) => {
            const year = ombul.year
            if (!groups[year]) {
                groups[year] = []
            }
            groups[year].push(ombul)
            return groups
        }, {} as Record<number, ExpandedOmbul[]>)).toSorted(
            ([yearOne], [yearTwo]) => parseInt(yearTwo, 10) - parseInt(yearOne, 10)
        )

        return (
            <PageWrapper
                headerItem={
                    capabilities.canCreate.authorized && (
                        <AddHeaderItemPopUp popUpKey="create ombul">
                            <CreateOmbul latestOmbul={data.latestOmbul} />
                        </AddHeaderItemPopUp>
                    )
                }
            >
                <div className="mt-4 flex flex-col">
                    {
                        yearsWithOmbul.map(([year, ombulsInYear]) => (
                            <div key={year}>
                                <h1>{year}</h1>
                                <div className="
                                    w-full image-card-list
                                    [&>*]:w-full
                                ">
                                    {
                                        ombulsInYear.map(ombul => (
                                            <OmbulCover key={ombul.id} ombul={ombul} />
                                        ))
                                    }
                                </div>
                            </div>
                        ))
                    }
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }

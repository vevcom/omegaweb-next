import PageStateWrapper from './PageStateWrapper'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('cabin-periods', session)
        const [releasePeriods, pricePeriods] = await Promise.all([
            cabinReleasePeriodOperations.readMany({}),
            cabinPricePeriodOperations.readMany({}),
        ])
        return { releasePeriods, pricePeriods }
    },
    metadata: () => ({ title: 'Heutteperioder' }),
    render: ({ data }) => (
        <PageWrapper>
            <PageStateWrapper
                releasePeriods={data.releasePeriods}
                pricePeriods={data.pricePeriods}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

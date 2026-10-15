import CreateUpdateApplicationPeriodForm from './CreateUpdateApplicationPeriodForm'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { applicationPeriodAuth } from '@/services/applications/periods/auth'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import Date from '@/components/Date/Date'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'

const { page, generateMetadata } = serverPage({
    operation: async () => {
        const [periods, committees] = await Promise.all([
            applicationPeriodOperations.readAll({}),
            committeeOperations.readAll({}),
        ])
        return { periods, committees }
    },
    capabilities: () => ({
        canCreatePeriod: applicationPeriodAuth.create,
    }),
    metadata: () => ({ title: 'Søknadsperioder' }),
    render: ({ data, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canCreatePeriod.authorized && (
                <AddHeaderItemPopUp popUpKey="addApplicationPeriod">
                    <CreateUpdateApplicationPeriodForm
                        committees={data.committees}
                        closePopUpOnSuccess="addApplicationPeriod"
                    />
                </AddHeaderItemPopUp>
            )
        }>
            <ol className={[
                'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 mt-2 p-0 list-none',
                '[&>li]:layer [&>li]:bg-surface-raised [&>li]:p-2 [&>li]:rounded-[0.8em] [&>li]:flex [&>li]:flex-col',
                '[&>li]:gap-[0.5em] [&_a]:font-bold [&_a]:text-accent-blue [&_a]:no-underline',
                '[&_time]:text-text [&_time]:text-s',
            ].join(' ')}>
                {data.periods.map((period) => (
                    <li key={period.name}>
                        <a href={`/applications/${period.name}`}>{period.name}</a>
                        <Date date={period.endDate} includeTime />
                    </li>
                ))}
            </ol>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

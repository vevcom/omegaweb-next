import styles from './page.module.scss'
import CreateUpdateApplicationPeriodForm from './CreateUpdateApplicationPeriodForm'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { serverPage } from '@/app/serverPage'
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
    metadata: () => ({ title: 'Søknadsperioder' }),
    render: ({ data }) => (
        <PageWrapper headerItem={
            <AddHeaderItemPopUp popUpKey="addApplicationPeriod">
                <CreateUpdateApplicationPeriodForm
                    committees={data.committees}
                    closePopUpOnSuccess="addApplicationPeriod"
                />
            </AddHeaderItemPopUp>
        }>
            <ol className={styles.periods}>
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

import styles from './page.module.scss'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp, SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Form from '@/components/Form/Form'
import DateDisplay from '@/components/Date/Date'
import DateInput from '@/UI/DateInput'
import TextInput from '@/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import {
    createDotFreezePeriodAction,
    destroyDotFreezePeriodAction,
    updateDotFreezePeriodAction,
} from '@/services/dots/freezePeriods/actions'
import { dotFreezePeriodOperations } from '@/services/dots/freezePeriods/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const createPopUpKey = 'createDotFreezePeriod'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('dots-freeze-periods', session)
        return dotFreezePeriodOperations.readAll({})
    },
    metadata: () => ({ title: 'Frysperioder for prikker' }),
    render: ({ data: freezePeriods }) => {
        const now = new Date()

        return (
            <PageWrapper headerItem={
                <AddHeaderItemPopUp popUpKey={createPopUpKey}>
                    <Form
                        action={createDotFreezePeriodAction}
                        title="Ny frysperiode"
                        submitText="Lag frysperiode"
                        closePopUpOnSuccess={createPopUpKey}
                        refreshOnSuccess
                    >
                        <DateInput name="start" label="Start" />
                        <DateInput name="end" label="Slutt" />
                        <TextInput name="reason" label="Grunn" />
                    </Form>
                </AddHeaderItemPopUp>
            }>
                <div className={styles.wrapper}>
                    <i>Dette er perioder der prikker ikke fjernes</i>
                    <p>
                        Tid inne i en frysperiode teller ikke mot hvor lenge en prikk varer. Utløpstider regnes ut
                        på nytt hver gang prikker leses, så en frysperiode som legges til eller endres her påvirker
                        også prikker som allerede er delt ut.
                    </p>
                    {
                        freezePeriods.length === 0 ?
                            <i>Ingen frysperioder er lagt inn</i> :
                            <table className={styles.freezePeriods}>
                                <thead>
                                    <tr>
                                        <th>Start</th>
                                        <th>Slutt</th>
                                        <th>Grunn</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {freezePeriods.map(freezePeriod => {
                                        const status = statusOf(freezePeriod, now)

                                        return (
                                            <tr key={freezePeriod.id}>
                                                <td><DateDisplay date={freezePeriod.start} includeTime={false} /></td>
                                                <td><DateDisplay date={freezePeriod.end} includeTime={false} /></td>
                                                <td>{freezePeriod.reason}</td>
                                                <td>
                                                    <span className={styles[status.style]}>{status.text}</span>
                                                </td>
                                                <td>
                                                    <SettingsHeaderItemPopUp
                                                        popUpKey={`dotFreezePeriodSettings ${freezePeriod.id}`}
                                                    >
                                                        <Form
                                                            action={configureAction(updateDotFreezePeriodAction, {
                                                                params: { id: freezePeriod.id },
                                                            })}
                                                            title="Endre frysperiode"
                                                            submitText="Endre"
                                                            refreshOnSuccess
                                                        >
                                                            <DateInput
                                                                name="start"
                                                                label="Start"
                                                                defaultValue={freezePeriod.start}
                                                            />
                                                            <DateInput
                                                                name="end"
                                                                label="Slutt"
                                                                defaultValue={freezePeriod.end}
                                                            />
                                                            <TextInput
                                                                name="reason"
                                                                label="Grunn"
                                                                defaultValue={freezePeriod.reason}
                                                            />
                                                        </Form>

                                                        <Form
                                                            action={configureAction(destroyDotFreezePeriodAction, {
                                                                params: { id: freezePeriod.id },
                                                            })}
                                                            submitText="Slett"
                                                            submitColor="red"
                                                            confirmation={{
                                                                confirm: true,
                                                                text: 'Er du sikker på at du vil slette denne ' +
                                                                    'frysperioden?'
                                                            }}
                                                            refreshOnSuccess
                                                        />
                                                    </SettingsHeaderItemPopUp>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                    }
                </div>
            </PageWrapper>
        )
    },
})

type FreezePeriodStatus = {
    text: string
    style: 'upcoming' | 'active' | 'finished'
}

function statusOf(freezePeriod: { start: Date, end: Date }, now: Date): FreezePeriodStatus {
    if (now < freezePeriod.start) return { text: 'Kommende', style: 'upcoming' }
    if (now < freezePeriod.end) return { text: 'Aktiv', style: 'active' }
    return { text: 'Ferdig', style: 'finished' }
}

export default page
export { generateMetadata }

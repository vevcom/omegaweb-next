import {
    CreateFreezePeriodField,
    CreateFreezePeriodSubmitter,
    DestroyFreezePeriodSubmitter,
    UpdateFreezePeriodField,
    UpdateFreezePeriodSubmitter,
} from './freezePeriodSubmitters'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp, SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import DateDisplay from '@/components/Date/Date'
import { dotFreezePeriodOperations } from '@/services/dots/freezePeriods/operations'
import { dotFreezePeriodCapabilities } from '@/capabilities/dots/freezePeriods/capabilities'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const statusBadge = 'py-[0.2em] px-[0.6em] rounded-[0.4em] whitespace-nowrap'

const statusClass: Record<FreezePeriodStatus['style'], string> = {
    upcoming: `
        ${statusBadge}
        bg-[color-mix(in_srgb,var(--color-primary),white_50%)] text-primary
    `,
    active: `
        ${statusBadge}
        bg-[color-mix(in_srgb,var(--color-success),white_50%)] text-success
    `,
    finished: `
        ${statusBadge}
        bg-base-300 text-base-content/80
    `,
}

const createPopUpKey = 'createDotFreezePeriod'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await authorizeAdminPage('dots-freeze-periods', session)
        return dotFreezePeriodOperations.readAll({})
    },
    capabilities: () => ({
        canCreateFreezePeriod: dotFreezePeriodCapabilities.create.authorizer,
        canUpdateFreezePeriod: dotFreezePeriodCapabilities.update.authorizer,
        canDestroyFreezePeriod: dotFreezePeriodCapabilities.destroy.authorizer,
    }),
    metadata: () => ({ title: 'Frysperioder for prikker' }),
    render: ({ data: freezePeriods, capabilities }) => {
        const now = new Date()

        return (
            <PageWrapper headerItem={capabilities.canCreateFreezePeriod.authorized &&
                <AddHeaderItemPopUp popUpKey={createPopUpKey}>
                    <CreateFreezePeriodSubmitter
                        title="Ny frysperiode"
                        submitText="Lag frysperiode"
                        closePopUpOnSuccess={createPopUpKey}
                        refreshOnSuccess
                    >
                        <CreateFreezePeriodField kind="date" name="start" label="Start" />
                        <CreateFreezePeriodField kind="date" name="end" label="Slutt" />
                        <CreateFreezePeriodField kind="string" name="reason" label="Grunn" />
                    </CreateFreezePeriodSubmitter>
                </AddHeaderItemPopUp>
            }>
                <div className="p-[1em]">
                    <i>Dette er perioder der prikker ikke fjernes</i>
                    <p>
                        Tid inne i en frysperiode teller ikke mot hvor lenge en prikk varer. Utløpstider regnes ut
                        på nytt hver gang prikker leses, så en frysperiode som legges til eller endres her påvirker
                        også prikker som allerede er delt ut.
                    </p>
                    {
                        freezePeriods.length === 0 ?
                            <i>Ingen frysperioder er lagt inn</i> :
                            <table className="ohma-table">
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
                                                    <span className={statusClass[status.style]}>{status.text}</span>
                                                </td>
                                                <td>
                                                    <SettingsHeaderItemPopUp
                                                        popUpKey={`dotFreezePeriodSettings ${freezePeriod.id}`}
                                                    >
                                                        {capabilities.canUpdateFreezePeriod.authorized &&
                                                        <UpdateFreezePeriodSubmitter
                                                            params={{ id: freezePeriod.id }}
                                                            defaultValues={{
                                                                start: freezePeriod.start,
                                                                end: freezePeriod.end,
                                                                reason: freezePeriod.reason,
                                                            }}
                                                            title="Endre frysperiode"
                                                            submitText="Endre"
                                                            refreshOnSuccess
                                                        >
                                                            <UpdateFreezePeriodField
                                                                kind="date"
                                                                name="start"
                                                                label="Start"
                                                            />
                                                            <UpdateFreezePeriodField
                                                                kind="date"
                                                                name="end"
                                                                label="Slutt"
                                                            />
                                                            <UpdateFreezePeriodField
                                                                kind="string"
                                                                name="reason"
                                                                label="Grunn"
                                                            />
                                                        </UpdateFreezePeriodSubmitter>
                                                        }

                                                        {capabilities.canDestroyFreezePeriod.authorized &&
                                                        <DestroyFreezePeriodSubmitter
                                                            params={{ id: freezePeriod.id }}
                                                            submitText="Slett"
                                                            submitColor="error"
                                                            confirmation={{
                                                                confirm: true,
                                                                text: 'Er du sikker på at du vil slette denne ' +
                                                                    'frysperioden?'
                                                            }}
                                                            refreshOnSuccess
                                                        />
                                                        }
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

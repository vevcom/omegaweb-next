import EventInfoRow from './EventInfoRow'
import DateDisplay from '@/components/Date/Date'
import { displayAmount } from '@/lib/currency/convert'
import type { EventQuotaSummary } from '@/services/events/types'

type PropTypes = {
    /** The quotas of the event in fill order. */
    quotas: EventQuotaSummary[],
    /** The quotas the viewer passes the visibility of, or null for a visitor who is not logged in. */
    eligibleQuotaIds: number[] | null,
    takesPayment: boolean,
}

/**
 * The quotas of an event as the sidebar shows them. One quota reads as a plain registration; several
 * are listed in the order they fill, marking the ones open to the viewer.
 */
export default function EventQuotaList({ quotas, eligibleQuotaIds, takesPayment }: PropTypes) {
    if (quotas.length === 1) {
        const [quota] = quotas
        return <>
            <EventInfoRow label="Plasser">{quota.numOfRegistrations} / {quota.places}</EventInfoRow>
            <EventInfoRow label="Påmeldingsstart"><DateDisplay date={quota.registrationStart} includeTime /></EventInfoRow>
            <EventInfoRow label="Påmeldingsslutt"><DateDisplay date={quota.registrationEnd} includeTime /></EventInfoRow>
        </>
    }

    return <>
        <p className="m-0 text-s text-text-muted">
            Kvotene fylles ovenfra: du får plass i den første du kan melde deg på som har ledig.
        </p>
        <ol className="
            m-0 p-0 list-none flex flex-col gap-2
            [&>li]:p-2 [&>li]:rounded-inner [&>li]:bg-surface-raised
        ">
            {quotas.map((quota, index) => {
                const eligible = eligibleQuotaIds?.includes(quota.id)
                return <li key={quota.id} className={eligible === false ? 'opacity-60' : ''}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-medium">
                            {quota.name}
                            {index === 0 && <span className="ml-2 text-xs uppercase text-text-muted">Fylles først</span>}
                        </span>
                        <span>{quota.numOfRegistrations} / {quota.places}</span>
                    </div>
                    <div className="text-s text-text-muted">
                        <DateDisplay date={quota.registrationStart} includeTime />
                        {' – '}
                        <DateDisplay date={quota.registrationEnd} includeTime />
                        {takesPayment && quota.price !== null && <> · {displayAmount(quota.price, false)}</>}
                    </div>
                    {eligibleQuotaIds && (
                        <div className={eligible ? 'text-s text-accent-green' : 'text-s text-text-muted'}>
                            {eligible ? 'Åpen for deg' : 'Ikke for deg'}
                        </div>
                    )}
                </li>
            })}
        </ol>
    </>
}

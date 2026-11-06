import EventInfoRow from './EventInfoRow'
import type { EventQuotaSummary } from '@/services/events/types'

type PropTypes = {
    quotas: EventQuotaSummary[],
    /** The quotas the viewer passes the visibility of, or null for a visitor who is not logged in. */
    eligibleQuotaIds: number[] | null,
}

/** One quota reads as plain places; several are listed in fill order, marking the ones open to the viewer. */
export default function EventQuotaList({ quotas, eligibleQuotaIds }: PropTypes) {
    if (quotas.length === 0) return null
    if (quotas.length === 1) {
        const [quota] = quotas
        return <EventInfoRow label="Plasser">{quota.numOfRegistrations} / {quota.places}</EventInfoRow>
    }

    return <>
        <p className="m-0 text-s text-base-content/80">
            Kvotene fylles ovenfra: du får plass i den første du kan melde deg på som har ledig.
        </p>
        <ol className="
            m-0 p-0 list-none flex flex-col gap-1
            [&>li]:px-2 [&>li]:py-1 [&>li]:rounded-inner [&>li]:bg-surface-raised
        ">
            {quotas.map((quota, index) => {
                const eligible = eligibleQuotaIds?.includes(quota.id)
                return <li key={quota.id} className={eligible === false ? 'opacity-60' : ''}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-medium">
                            {quota.name}
                            {index === 0 && <span className="ml-2 text-xs uppercase text-base-content/80">Fylles først</span>}
                        </span>
                        <span>{quota.numOfRegistrations} / {quota.places}</span>
                    </div>
                    {eligibleQuotaIds && (
                        <div className={eligible ? 'text-s text-accent-green' : 'text-s text-base-content/80'}>
                            {eligible ? 'Åpen for deg' : 'Ikke for deg'}
                        </div>
                    )}
                </li>
            })}
        </ol>
    </>
}

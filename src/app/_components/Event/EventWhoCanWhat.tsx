'use client'
import { describeAudience } from '@/auth/visibility/describeVisibility'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { whoCanWhat } from '@/services/events/whoCanWhat'
import type { VariantDraft } from './eventSetupDraft'
import type { EventAccess } from '@/services/events/types'
import type { Registers, WhoCanWhatRow } from '@/services/events/whoCanWhat'

const labels: Record<NonNullable<WhoCanWhatRow['label']>, string> = {
    loggedOut: 'Ikke innlogget',
    loggedIn: 'Innlogget',
    eventAdmin: 'Har EVENT_ADMIN',
}
const registersText: Record<Registers, string> = { yes: 'Ja', no: 'Nei', login: 'Må logge inn' }

function Answer({ text, yes }: { text: string, yes: boolean }) {
    return <td className={`
        px-2 py-1
        ${yes ? 'font-medium' : 'text-text-muted'}
    `}>{text}</td>
}

/** Who may register, quota by quota, as the Påmelding tab has it. */
export function EventQuotaAudiences({ variants }: { variants: VariantDraft[] }) {
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null
    const quotas = variants.flatMap(variant => variant.quotas.map(quota => ({ variant, quota })))

    if (quotas.length === 0) return <p className="m-0 text-text-muted">Arrangementet har ikke påmelding.</p>
    return <>
        <ul className="m-0 pl-5">
            {quotas.map(({ variant, quota }) => <li key={quota.key}>
                {quotas.length > 1 && <span className="text-text-muted">
                    {variants.length > 1 ? `${variant.name}, ${quota.name}` : quota.name}:{' '}
                </span>}
                {quota.visibilityRequirements.length > 0
                    ? describeAudience({ requirements: quota.visibilityRequirements }, groups)
                    : 'Alle som er logget inn'}
            </li>)}
        </ul>
        <p className="m-0 text-s text-text-muted">Dette endres under Påmelding.</p>
    </>
}

/** How the event will turn out for those it names, as the form stands now. */
export default function EventWhoCanWhat({ access }: { access: EventAccess }) {
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null

    return <div className="flex flex-col gap-2 pb-4">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-s">
                <thead>
                    <tr>
                        <th scope="col" className="px-2 py-1">Hvem</th>
                        <th scope="col" className="px-2 py-1">Ser det</th>
                        <th scope="col" className="px-2 py-1">Kan melde seg på</th>
                        <th scope="col" className="px-2 py-1">Administrerer</th>
                    </tr>
                </thead>
                <tbody>
                    {whoCanWhat(access).map(row => {
                        const audience = row.audience ?? { requirements: [] }
                        const name = row.label ? labels[row.label] : describeAudience(audience, groups)
                        return <tr key={name} className="border-t border-surface-subtle">
                            <th scope="row" className="px-2 py-1 font-medium">{name}</th>
                            <Answer text={row.sees ? 'Ja' : 'Nei'} yes={row.sees} />
                            <Answer text={registersText[row.registers]} yes={row.registers === 'yes'} />
                            <Answer text={row.administers ? 'Ja' : 'Nei'} yes={row.administers} />
                        </tr>
                    })}
                </tbody>
            </table>
        </div>
        {!access.published && <p className="m-0 text-s text-text-muted">
            Arrangementet er et utkast, så foreløpig ser bare de som administrerer det. Den som opprettet utkastet
            administrerer det også.
        </p>}
    </div>
}

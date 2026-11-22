'use client'
import { eventQuotaVisibility } from './eventVisibility'
import { describeVisibility } from '@/components/Visibility/describeVisibility'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import { Session } from '@/auth/session/Session'
import useAuthorizer from '@/hooks/useAuthorizer'
import useFlatGroups from '@/hooks/useFlatGroups'
import { creatorHoldsDraft, eventAuth, visibilitiesShowingEvent } from '@/services/events/auth'
import { canRegisterSelf } from '@/services/events/registration/auth'
import type { AuthResultAny } from '@/auth/authorizer/AuthResult'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { VariantDraft } from '@/services/events/setupDraft'
import type { EventAccess } from '@/services/events/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

const noteClassName = 'm-0 text-s text-base-content/80'

const passesEveryone = (visibility: VisibilityMatrix) => visibility.requirements.length === 0
const passesNoOne = (visibility: VisibilityMatrix) => (
    visibility.requirements.some(requirement => requirement.conditions.length === 0)
)

/** Who sees the event, as its setup stands. */
export function EventSeenBy({ access }: { access: EventAccess }) {
    const groups = useFlatGroups()
    const showing = visibilitiesShowingEvent(access)
    const described = Array.from(new Set(
        showing.filter(visibility => !passesNoOne(visibility)).map(visibility => describeVisibility(visibility, groups))
    ))

    return <div className="flex flex-col gap-1">
        {showing.some(passesEveryone)
            ? <p className="m-0">Alle, også de som ikke er logget inn.</p>
            : <ul className="m-0 pl-5">
                {described.map(who => <li key={who}>{who}</li>)}
                {creatorHoldsDraft(access) && <li>Den som opprettet utkastet, til noen administrerer det</li>}
                {access.companyId !== null && <li>Bedriftens brukere</li>}
                <li>De med rettigheten EVENT_ADMIN</li>
            </ul>}
        {!access.published && <p className={noteClassName}>
            Arrangementet er et utkast, så bare de som administrerer det
            {access.companyId !== null && ' og bedriftens brukere'} ser det ennå.
        </p>}
    </div>
}

/** Who may register, quota by quota, as the Påmelding tab has it. */
export function EventQuotaVisibilities({ variants }: { variants: VariantDraft[] }) {
    const quotas = variants.flatMap(variant => variant.quotas.map(quota => ({ variant, quota })))

    if (quotas.length === 0) return <p className="m-0 text-base-content/80">Arrangementet har ikke påmelding.</p>
    return <>
        <ul className="m-0 pl-5">
            {quotas.map(({ variant, quota }) => <li key={quota.key}>
                {quotas.length > 1 && <span className="text-base-content/80">
                    {variants.length > 1 ? `${variant.name}, ${quota.name}` : quota.name}:{' '}
                </span>}
                <eventQuotaVisibility.Description visibility={{ requirements: quota.visibilityRequirements }} />
            </li>)}
        </ul>
        <p className={noteClassName}>Dette endres under Påmelding.</p>
    </>
}

type AccessCapabilities = Capabilities<'canSee' | 'canRegister' | 'canAdminister'>

/** `whenLoggedIn` is for what a visitor who is not logged in is sent to the login for. */
function Answer({ capability, whenLoggedIn = false }: { capability: AuthResultAny, whenLoggedIn?: boolean }) {
    const no = whenLoggedIn && capability.status === 'UNAUTHENTICATED' ? 'Må logge inn' : 'Nei'
    return <td className={`
        px-2 py-1
        ${capability.authorized ? 'font-medium' : 'text-base-content/80'}
    `}>{capability.authorized ? 'Ja' : no}</td>
}

/**
 * What the event's setup gives a visitor who is not logged in and the one editing it, asked of the
 * rules that decide it on the site. So someone about to set administrators they are not among sees
 * it before saving.
 */
export function EventAccessOfSessions({ access }: { access: EventAccess }) {
    const authorizers = {
        canSee: eventAuth.read.data(access),
        canRegister: canRegisterSelf.data(access),
        canAdminister: eventAuth.saveSetup.data({ ...access, setsCompany: false, linksPresentation: null }),
    }
    const rows: { who: string, capabilities: AccessCapabilities }[] = [
        { who: 'Ikke innlogget', capabilities: runCapabilities(Session.empty(), authorizers) },
        {
            who: 'Deg',
            capabilities: {
                canSee: useAuthorizer({ authorizer: authorizers.canSee }),
                canRegister: useAuthorizer({ authorizer: authorizers.canRegister }),
                canAdminister: useAuthorizer({ authorizer: authorizers.canAdminister }),
            },
        },
    ]
    const takesRegistration = access.quotaVisibilities.length > 0

    return <div className="overflow-x-auto">
        <table className="w-full text-left text-s">
            <thead>
                <tr>
                    <th scope="col" className="px-2 py-1">Hvem</th>
                    <th scope="col" className="px-2 py-1">Ser det</th>
                    {takesRegistration && <th scope="col" className="px-2 py-1">Kan melde seg på</th>}
                    <th scope="col" className="px-2 py-1">Administrerer</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(({ who, capabilities }) => <tr key={who} className="border-t border-base-300">
                    <th scope="row" className="px-2 py-1 font-medium">{who}</th>
                    <Answer capability={capabilities.canSee} />
                    {takesRegistration && <Answer
                        capability={capabilities.canRegister}
                        whenLoggedIn={capabilities.canSee.authorized}
                    />}
                    <Answer capability={capabilities.canAdminister} />
                </tr>)}
            </tbody>
        </table>
    </div>
}

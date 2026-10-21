'use client'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import type { PensionGroupAction } from '@/services/groups/types'

type PropTypes = {
    groupId: number,
    groupName: string,
    /**
     * Whether the group is pensioned now. The control is a toggle either way: a live group can be
     * retired, and a retired one is the only thing a pensioned group still offers.
     */
    pensioned: boolean,
    currentOmegaOrder: number,
    /**
     * The pension action of the group type in question. All three types that are migrated by hand
     * expose the same shape, which is what this component is written against.
     */
    pensionGroupAction: PensionGroupAction,
}

/**
 * Retires a group rather than migrating it on, or brings a retired one back.
 *
 * Pensioning is the way out for a group that has run its course: it ends every active membership and
 * stops the group holding omega back from incrementing. Nothing about a pensioned group can be
 * changed afterwards, which is why the wording spells out what is about to happen.
 */
export default function PensionGroup({
    groupId,
    groupName,
    pensioned,
    currentOmegaOrder,
    pensionGroupAction,
}: PropTypes) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-text-muted max-w-[70ch]">
                {pensioned
                    ? `${groupName} er pensjonert. Gruppen har ingen aktive medlemmer, kan ikke endres, `
                        + 'og holder ikke igjen inkrementering av Omega.'
                    : 'En gruppe som har gått ut av tiden kan pensjoneres i stedet for å migreres videre. '
                        + 'Alle aktive medlemskap blir satt inaktive, gruppen kan ikke lenger endres, og den '
                        + 'teller ikke lenger med i kravene for å inkrementere Omega.'}
            </p>

            <Form
                action={() => configureAction(
                    pensionGroupAction, { params: { groupId } }
                )({ data: { pensioned: !pensioned } })}
                refreshOnSuccess
                submitText={pensioned ? 'Gjenopprett gruppen' : 'Pensjoner gruppen'}
                submitColor={pensioned ? 'primary' : 'red'}
                confirmation={{
                    confirm: true,
                    text: pensioned
                        ? `Gjenopprette ${groupName}? Gruppen blir satt i orden ${currentOmegaOrder}, `
                            + 'men får ingen medlemmer tilbake.'
                        : `Pensjonere ${groupName}? Alle aktive medlemskap blir satt inaktive, og `
                            + 'gruppen kan ikke endres før den eventuelt gjenopprettes.',
                }}
            />
        </div>
    )
}

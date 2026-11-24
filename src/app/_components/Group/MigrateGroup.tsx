'use client'
import MigrateGroupFields from './MigrateGroupFields'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { MigrateGroupCandidate } from './MigrateGroupFields'
import type { MigrateGroupAction } from '@/services/groups/types'

type PropTypes = {
    groupId: number,
    /**
     * The order the group itself is in. When it is behind the current omega order the group needs
     * migrating; when it has caught up there is nothing to do.
     */
    groupOrder: number,
    currentOmegaOrder: number,
    /**
     * The active members of the group's current order - the people who may be carried over.
     */
    candidates: MigrateGroupCandidate[],
    /**
     * The migration action of the group type in question. Every group type that migrates one group
     * at a time exposes the same action shape, which is what this component is written against.
     */
    migrateGroupAction: MigrateGroupAction,
}

/**
 * Migrates one group up to the current omega order, carrying over the members that are ticked and
 * making the ones ticked as admin administer it in the new order.
 *
 * Everyone's membership of the old order is deactivated either way; the ticked members additionally
 * get a fresh active membership of the new order. The group type decides who is allowed to do this
 * through the action it injects.
 */
export default function MigrateGroup({
    groupId,
    groupOrder,
    currentOmegaOrder,
    candidates,
    migrateGroupAction,
}: PropTypes) {
    // Keyed by user: present means kept, and the value is whether they administer the new order.
    const [keep, setKeep] = useState<Map<number, boolean>>(new Map())

    if (groupOrder >= currentOmegaOrder) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-success">Gruppen er i orden {groupOrder} og trenger ingen migrering.</p>
            </div>
        )
    }

    const kept = Array.from(keep, ([userId, admin]) => ({ userId, admin }))
    const admins = kept.filter(member => member.admin)

    return (
        <div className="flex flex-col gap-2">
            <p className="text-base-content/80 max-w-[70ch]">
                Gruppen står i orden {groupOrder}, mens Omega er i orden {currentOmegaOrder}. Velg
                hvem som skal være med videre, og hvem av dem som skal være admin i den nye ordenen.
                De som ikke velges beholder medlemskapet sitt i orden {groupOrder}, men det blir satt
                inaktivt.
            </p>

            <MigrateGroupFields
                groupId={groupId}
                groupOrder={groupOrder}
                newOrder={currentOmegaOrder}
                candidates={candidates}
                keep={keep}
                onKeepChange={setKeep}
            />

            <Form
                action={() => configureAction(
                    migrateGroupAction, { params: { groupId } }
                )({ data: { keep: kept } })}
                refreshOnSuccess
                submitText={`Migrer til orden ${currentOmegaOrder}`}
                confirmation={{
                    confirm: true,
                    text: `Migrere gruppen til orden ${currentOmegaOrder} med ${kept.length} medlem(mer), `
                        + `hvorav ${admins.length} admin? `
                        + 'Medlemskapene i forrige orden blir satt inaktive.'
                }}
            />
        </div>
    )
}

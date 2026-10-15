'use client'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { MigrateGroupAction } from '@/services/groups/types'

export type MigrateGroupCandidate = {
    userId: number,
    name: string,
    title: string,
    /**
     * Whether the member administers the group in the order it is leaving. It seeds the admin tick
     * for the new order, so keeping everyone as they are is the default.
     */
    admin: boolean,
}

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
                <p className="text-accent-green">Gruppen er i orden {groupOrder} og trenger ingen migrering.</p>
            </div>
        )
    }

    const toggleKeep = (candidate: MigrateGroupCandidate) => setKeep(current => {
        const next = new Map(current)
        if (next.has(candidate.userId)) {
            next.delete(candidate.userId)
        } else {
            next.set(candidate.userId, candidate.admin)
        }
        return next
    })

    const toggleAdmin = (userId: number) => setKeep(current => {
        if (!current.has(userId)) return current
        const next = new Map(current)
        next.set(userId, !next.get(userId))
        return next
    })

    const kept = Array.from(keep, ([userId, admin]) => ({ userId, admin }))
    const admins = kept.filter(member => member.admin)
    // The group needs someone to administer it in the new order. A group whose old order has no
    // members cannot provide one, so there the rule does not apply - the service agrees.
    const missingAdmin = candidates.length > 0 && admins.length === 0

    return (
        <div className="flex flex-col gap-2">
            <p className="text-text-muted max-w-[70ch]">
                Gruppen står i orden {groupOrder}, mens Omega er i orden {currentOmegaOrder}. Velg
                hvem som skal være med videre, og hvem av dem som skal være admin i den nye ordenen.
                De som ikke velges beholder medlemskapet sitt i orden {groupOrder}, men det blir satt
                inaktivt.
            </p>

            {candidates.length === 0 ? (
                <p className="text-text-muted italic">Gruppen har ingen aktive medlemmer i orden {groupOrder}.</p>
            ) : (
                <div className="flex flex-col gap-1 max-h-[24em] overflow-y-auto p-2 rounded-round layer">
                    {candidates.map(candidate => (
                        <div className="grid grid-cols-[1fr_auto] items-center gap-4" key={candidate.userId}>
                            <Checkbox
                                name={`keep-${candidate.userId}`}
                                label={`${candidate.name} — ${candidate.title}`}
                                checked={keep.has(candidate.userId)}
                                onChange={() => toggleKeep(candidate)}
                            />
                            {/* Checkbox spreads className onto the input, so the column it sits in
                                is what gets positioned. */}
                            <span>
                                <Checkbox
                                    name={`admin-${candidate.userId}`}
                                    label="Admin"
                                    checked={keep.get(candidate.userId) ?? false}
                                    disabled={!keep.has(candidate.userId)}
                                    onChange={() => toggleAdmin(candidate.userId)}
                                />
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <span className="text-text-muted text-s">
                {kept.length} av {candidates.length} blir med videre til orden {currentOmegaOrder}
                {kept.length > 0 && `, ${admins.length} som admin`}
            </span>

            {missingAdmin && (
                <p className="text-accent-red text-s">
                    Minst ett medlem må være admin i orden {currentOmegaOrder}.
                </p>
            )}

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

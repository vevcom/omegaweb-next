'use client'
import Checkbox from '@/components/UI/Checkbox'

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
    groupOrder: number,
    newOrder: number,
    /** The active members of the group's own order, who may be carried over. */
    candidates: MigrateGroupCandidate[],
    /** Keyed by user: present means kept, and the value is whether they administer the new order. */
    keep: Map<number, boolean>,
    onKeepChange: (keep: Map<number, boolean>) => void,
}

/**
 * Who of a group's members are carried into the new order, and who of them administer it there, for
 * the form that migrates the group.
 */
export default function MigrateGroupFields({ groupId, groupOrder, newOrder, candidates, keep, onKeepChange }: PropTypes) {
    const toggleKeep = (candidate: MigrateGroupCandidate) => {
        const next = new Map(keep)
        if (next.has(candidate.userId)) {
            next.delete(candidate.userId)
        } else {
            next.set(candidate.userId, candidate.admin)
        }
        onKeepChange(next)
    }

    const toggleAdmin = (userId: number) => {
        if (!keep.has(userId)) return
        const next = new Map(keep)
        next.set(userId, !next.get(userId))
        onKeepChange(next)
    }

    const kept = Array.from(keep.values())
    const admins = kept.filter(admin => admin)
    // The group needs someone to administer it in the new order. A group whose old order has no
    // members cannot provide one, so there the rule does not apply - the service agrees.
    const missingAdmin = candidates.length > 0 && admins.length === 0

    return (
        <div className="flex flex-col gap-2">
            {candidates.length === 0 ? (
                <p className="text-base-content/80 italic">Gruppen har ingen aktive medlemmer i orden {groupOrder}.</p>
            ) : (
                <div className="flex flex-col gap-1 max-h-[24em] overflow-y-auto p-2 rounded-round layer">
                    {candidates.map(candidate => (
                        <div className="grid grid-cols-[1fr_auto] items-center gap-4" key={candidate.userId}>
                            <Checkbox
                                name={`keep-${groupId}-${candidate.userId}`}
                                label={`${candidate.name} — ${candidate.title}`}
                                checked={keep.has(candidate.userId)}
                                onChange={() => toggleKeep(candidate)}
                            />
                            {/* Checkbox spreads className onto the input, so the column it sits in
                                is what gets positioned. */}
                            <span>
                                <Checkbox
                                    name={`admin-${groupId}-${candidate.userId}`}
                                    label="Administrator"
                                    checked={keep.get(candidate.userId) ?? false}
                                    disabled={!keep.has(candidate.userId)}
                                    onChange={() => toggleAdmin(candidate.userId)}
                                />
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <span className="text-base-content/80 text-s">
                {kept.length} av {candidates.length} blir med videre til orden {newOrder}
                {kept.length > 0 && `, ${admins.length} som admin`}
            </span>

            {missingAdmin && (
                <p className="text-error text-s">
                    Minst ett medlem må være admin i orden {newOrder}.
                </p>
            )}
        </div>
    )
}

'use client'
import Button from '@/components/UI/Button'
import NumberInput from '@/components/UI/NumberInput'
import {
    createSeatingPlan,
    exampleWishes,
    fulfilledWishes,
    moveGuest,
    seatingSummary,
    swapGuests,
} from '@/services/events/seating'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons'
import { MotionConfig, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import type { SeatingGuest, SeatingPlan } from '@/services/events/seating'

const DEFAULT_SEATS_PER_TABLE = 8

function Stat({ label, value }: { label: string, value: ReactNode }) {
    return <div className="flex flex-col p-3 rounded-inner bg-surface-raised">
        <strong className="text-l">{value}</strong>
        <span className="text-s text-text-muted">{label}</span>
    </div>
}

/**
 * Demo of table seating from wishes and committees. Nothing here is stored, so a reload starts over.
 * ponytail: the plan lives in this component until wishes and tables get a migration.
 */
export default function EventSeating({ guests }: { guests: SeatingGuest[] }) {
    const emptyPlan = (tableCount: number): SeatingPlan => ({
        tables: Array.from({ length: tableCount }, () => []),
        unseated: guests.map(guest => guest.id),
    })
    const firstTableCount = Math.max(1, Math.ceil(guests.length / DEFAULT_SEATS_PER_TABLE))

    const [seatsPerTable, setSeatsPerTable] = useState(DEFAULT_SEATS_PER_TABLE)
    const [plan, setPlan] = useState(emptyPlan(firstTableCount))
    const [locked, setLocked] = useState<number[]>([])
    const [selected, setSelected] = useState<number | null>(null)
    const [dragged, setDragged] = useState<number | null>(null)
    const [drafts, setDrafts] = useState(0)

    const wishes = useMemo(() => exampleWishes(guests), [guests])
    const summary = seatingSummary(plan, guests, wishes)
    const nameOf = (id: number) => guests.find(guest => guest.id === id)?.name ?? 'Ukjent'
    const places = plan.tables.length * seatsPerTable
    const selectedGuest = guests.find(guest => guest.id === selected)
    const tableIsFull = (index: number) => plan.tables[index].length >= seatsPerTable

    const resize = (tableCount: number, seats: number) => {
        setSeatsPerTable(seats)
        setPlan(emptyPlan(tableCount))
        setLocked([])
    }

    const draft = () => {
        const lockedTables = Object.fromEntries(locked.map(id => [
            id,
            plan.tables.findIndex(members => members.includes(id)),
        ]))
        setPlan(createSeatingPlan({
            guests,
            wishes,
            seats: plan.tables.map(() => seatsPerTable),
            locked: lockedTables,
            seed: drafts + 1,
        }))
        setDrafts(drafts + 1)
        setSelected(null)
    }

    // What was placed by hand stays put when a new draft is made.
    const moveTo = (guestId: number, tableIndex: number | null) => {
        if (tableIndex !== null && tableIsFull(tableIndex)) return
        setPlan(moveGuest(plan, guestId, tableIndex))
        setLocked([...locked.filter(id => id !== guestId), ...tableIndex === null ? [] : [guestId]])
        setSelected(null)
    }

    const swapWith = (guestId: number) => {
        if (dragged === null || dragged === guestId) return
        setPlan(swapGuests(plan, dragged, guestId))
        const seated = [dragged, guestId].filter(id => !plan.unseated.includes(id))
        setLocked([...locked.filter(id => id !== dragged && id !== guestId), ...seated])
    }

    const dropZone = (tableIndex: number | null) => ({
        onDragOver: (event: DragEvent) => event.preventDefault(),
        onDrop: () => {
            if (dragged !== null) moveTo(dragged, tableIndex)
        },
    })

    const renderGuest = (guestId: number, seated: boolean) => {
        const wishCount = wishes[guestId]?.length ?? 0
        const isSelected = guestId === selected
        const isWished = selected !== null && wishes[selected]?.includes(guestId)
        const isLocked = locked.includes(guestId)
        const committees = guests.find(guest => guest.id === guestId)?.committees ?? []
        return <motion.li
            key={guestId}
            layout="position"
            layoutId={`seating-guest-${guestId}`}
            className="list-none"
        >
            <div
                draggable
                onDragStart={() => setDragged(guestId)}
                onDragEnd={() => setDragged(null)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                    if (dragged === null || dragged === guestId) return
                    event.stopPropagation()
                    swapWith(guestId)
                }}
                className={`
                    flex items-center gap-1 pr-1 rounded-inner cursor-grab
                    ${isSelected ? 'bg-accent-blue text-white' : 'hover:bg-surface-hover'}
                    ${isWished ? 'outline-2 outline-accent-yellow' : ''}
                `}
            >
                <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(isSelected ? null : guestId)}
                    title={committees.join(', ') || undefined}
                    className="
                        flex-1 min-w-0 px-2 py-1 border-none bg-transparent text-inherit text-s text-left truncate
                        cursor-pointer
                    "
                >
                    {nameOf(guestId)}
                </button>
                {seated && <>
                    <span
                        title="Antall ønsker som er oppfylt"
                        className={`
                            text-s
                            ${isSelected ? '' : 'text-text-muted'}
                        `}
                    >
                        {fulfilledWishes(guestId, plan, wishes).length}/{wishCount}
                    </span>
                    <button
                        type="button"
                        aria-pressed={isLocked}
                        aria-label={`${isLocked ? 'Lås opp' : 'Lås'} ${nameOf(guestId)} til bordet`}
                        title={isLocked ? 'Beholder bordet i neste utkast' : 'Lås til bordet'}
                        onClick={() => setLocked(isLocked
                            ? locked.filter(id => id !== guestId)
                            : [...locked, guestId])}
                        className={`
                            p-1 border-none bg-transparent text-inherit text-s cursor-pointer
                            ${isLocked ? '' : 'opacity-30'}
                        `}
                    >
                        <FontAwesomeIcon icon={isLocked ? faLock : faLockOpen} />
                    </button>
                </>}
            </div>
        </motion.li>
    }

    const moveHereButton = (tableIndex: number | null) => selected !== null && <button
        type="button"
        disabled={tableIndex !== null && tableIsFull(tableIndex)}
        onClick={() => moveTo(selected, tableIndex)}
        className="
            border-none bg-transparent text-s text-accent-blue underline cursor-pointer
            disabled:text-text-muted disabled:no-underline disabled:cursor-default
        "
    >
        Flytt hit
    </button>

    if (guests.length === 0) return <p className="m-0 text-text-muted">Ingen er påmeldt ennå.</p>

    return <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-3">
            <p className="m-0 text-s text-text-muted">
                Gjestene og komiteene er ekte, men ønskene er oppdiktet i denne demoen, og ingenting lagres ennå.
            </p>

            <div className="flex flex-wrap items-end gap-3">
                <NumberInput
                    name="tables"
                    label="Antall bord"
                    min={1}
                    value={plan.tables.length}
                    onChange={event => resize(Math.max(1, Number(event.target.value)), seatsPerTable)}
                    className="w-32!"
                />
                <NumberInput
                    name="seats"
                    label="Plasser per bord"
                    min={1}
                    value={seatsPerTable}
                    onChange={event => resize(plan.tables.length, Math.max(1, Number(event.target.value)))}
                    className="w-40!"
                />
                <Button type="button" onClick={draft} className="m-0!">
                    {drafts === 0 ? 'Lag utkast' : 'Lag nytt utkast'}
                </Button>
                <span className="pb-2 text-s text-text-muted">{guests.length} gjester, {places} plasser</span>
            </div>

            {drafts > 0 && <div className="
                grid grid-cols-3 gap-2
                max-mobile:grid-cols-1
            ">
                <Stat label="fikk minst ett ønske" value={`${summary.gotAWish} av ${summary.wishing}`} />
                <Stat label="fikk alle ønskene" value={`${summary.gotAllWishes} av ${summary.wishing}`} />
                <Stat
                    label="sitter med noen fra komiteen"
                    value={`${summary.withCommittee} av ${summary.committeeMembers}`}
                />
            </div>}

            <p aria-live="polite" className="m-0 min-h-6 text-s">
                {selectedGuest
                    ? `${selectedGuest.name} ønsket seg ${(wishes[selectedGuest.id] ?? []).map(nameOf).join(', ')}.`
                    : 'Velg noen for å se ønskene, og dra dem til et annet bord eller oppå en de skal bytte med.'}
            </p>

            <section
                {...dropZone(null)}
                className="p-3 rounded-inner bg-surface-raised"
            >
                <div className="flex justify-between gap-2 mb-1">
                    <h3 className="m-0 text-m">Uten bord ({plan.unseated.length})</h3>
                    {moveHereButton(null)}
                </div>
                <ul className="
                    grid grid-cols-3 gap-x-2 m-0 p-0
                    max-mobile:grid-cols-2
                ">
                    {plan.unseated.map(guestId => renderGuest(guestId, false))}
                </ul>
            </section>

            <div className="
                grid grid-cols-3 gap-2
                max-mobile:grid-cols-1
            ">
                {plan.tables.map((members, index) => <section
                    key={index}
                    {...dropZone(index)}
                    className="min-h-24 p-3 rounded-inner bg-surface-raised"
                >
                    <div className="flex justify-between gap-2 mb-1">
                        <h3 className="m-0 text-m">Bord {index + 1}</h3>
                        {moveHereButton(index) || <span className="text-s text-text-muted">
                            {members.length}/{seatsPerTable}
                        </span>}
                    </div>
                    <ul className="m-0 p-0">{members.map(guestId => renderGuest(guestId, true))}</ul>
                </section>)}
            </div>
        </div>
    </MotionConfig>
}

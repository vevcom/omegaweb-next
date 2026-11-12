'use client'
import Form from '@/components/Form/Form'
import JsonFieldInput from '@/components/Form/JsonFieldInput'
import Button from '@/components/UI/Button'
import DateInput from '@/components/UI/DateInput'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import {
    openEventSeatingWishesAction,
    saveEventSeatingPlanAction,
    setEventSeatingPublishedAction,
} from '@/services/events/seating/actions'
import {
    createSeatingPlan,
    displaySeats,
    fulfilledWishes,
    moveGuest,
    parseSeats,
    reconcilePlan,
    resizePlan,
    seatingSummary,
    swapGuests,
} from '@/services/events/seating/plan'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons'
import { MotionConfig, motion } from 'framer-motion'
import { useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import type { SeatingPlan } from '@/services/events/seating/plan'
import type { SeatingBoard } from '@/services/events/seating/types'

const DEFAULT_SEATS_PER_TABLE = 8

const sectionClassName = `
    flex flex-col gap-2 p-3 rounded-inner bg-base-200
    [&>h3]:m-0 [&>h3]:text-m
    [&>p]:m-0 [&>p]:text-s
`

function Stat({ label, value }: { label: string, value: ReactNode }) {
    return <div className="flex flex-col p-3 rounded-inner bg-base-200">
        <strong className="text-l">{value}</strong>
        <span className="text-s text-base-content/80">{label}</span>
    </div>
}

/** Sorted, so a plan saved and read back compares equal to what was saved. */
function placementsOf(plan: SeatingPlan, locked: number[]) {
    return plan.tables
        .flatMap((members, table) => members.map(registrationId => ({
            registrationId,
            table,
            locked: locked.includes(registrationId),
        })))
        .sort((first, second) => first.registrationId - second.registrationId)
}

function SeatingEditor({ eventId, board, onDiscard }: { eventId: number, board: SeatingBoard, onDiscard: () => void }) {
    const { guests, wishes } = board
    const guestIds = guests.map(guest => guest.id)
    const firstSeats = board.seats.length > 0
        ? board.seats
        : Array<number>(Math.max(1, Math.ceil(guests.length / DEFAULT_SEATS_PER_TABLE))).fill(DEFAULT_SEATS_PER_TABLE)

    const [seats, setSeats] = useState(firstSeats)
    const [seatsText, setSeatsText] = useState(displaySeats(firstSeats))
    const [workingPlan, setPlan] = useState(resizePlan(board.plan, firstSeats))
    const [workingLocked, setLocked] = useState(board.locked)
    const [selected, setSelected] = useState<number | null>(null)
    const [dragged, setDragged] = useState<number | null>(null)
    const [drafts, setDrafts] = useState(0)

    // Registrations can change behind an open plan, which must not throw away the work on it.
    const plan = reconcilePlan(workingPlan, guestIds)
    const locked = workingLocked.filter(id => guestIds.includes(id) && !plan.unseated.includes(id))

    const summary = seatingSummary(plan, guests, wishes)
    const nameOf = (id: number) => guests.find(guest => guest.id === id)?.name ?? 'Ukjent'
    const places = seats.reduce((sum, count) => sum + count, 0)
    const selectedGuest = guests.find(guest => guest.id === selected)
    const wishNames = selectedGuest && (wishes[selectedGuest.id] ?? []).map(nameOf).join(', ')
    const tableIsFull = (index: number) => plan.tables[index].length >= seats[index]
    const wishing = guests.filter(guest => wishes[guest.id]?.length).length

    const placements = placementsOf(plan, locked)
    const hasUnsavedPlan = JSON.stringify([seats, placements]) !== JSON.stringify([
        board.seats,
        placementsOf(reconcilePlan(board.plan, guestIds), board.locked),
    ])

    const changeSeats = (text: string) => {
        setSeatsText(text)
        const parsed = parseSeats(text)
        if (!parsed) return
        setSeats(parsed)
        setPlan(resizePlan(plan, parsed))
    }

    const draft = () => {
        const lockedTables = Object.fromEntries(locked.map(id => [
            id,
            plan.tables.findIndex(members => members.includes(id)),
        ]))
        setPlan(createSeatingPlan({ guests, wishes, seats, locked: lockedTables, seed: drafts + 1 }))
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
        const swapped = swapGuests(plan, dragged, guestId)
        setPlan(swapped)
        const seated = [dragged, guestId].filter(id => !swapped.unseated.includes(id))
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
        const fulfilled = fulfilledWishes(guestId, plan, wishes).length
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
                    ${isSelected ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}
                    ${isWished ? 'outline-2 outline-warning' : ''}
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
                            ${fulfilled === 0 && wishCount > 0 ? 'text-error font-bold' : ''}
                            ${isSelected ? '' : 'text-base-content/80'}
                        `}
                    >
                        {fulfilled}/{wishCount}
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
            border-none bg-transparent text-s text-primary underline cursor-pointer
            disabled:text-base-content/80 disabled:no-underline disabled:cursor-default
        "
    >
        Flytt hit
    </button>

    if (guests.length === 0) return <p className="m-0 text-base-content/80">Ingen har fått plass ennå.</p>

    return <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-3">
            <div className="
                grid grid-cols-2 gap-2
                max-mobile:grid-cols-1
            ">
                <section className={sectionClassName}>
                    <h3>Ønsker</h3>
                    <p>
                        {board.wishesEnd
                            ? `${wishing} av ${guests.length} har sendt ønsker.`
                            : 'Gjestene får beskjed når du åpner, og kan velge hvem de vil sitte med.'}
                    </p>
                    <Form
                        action={configureAction(openEventSeatingWishesAction, { params: { id: eventId } })}
                        submitText={board.wishesEnd ? 'Endre fristen' : 'Åpne for ønsker'}
                        refreshOnSuccess
                    >
                        <DateInput
                            name="wishesEnd"
                            label="Frist for ønsker"
                            includeTime
                            defaultValue={board.wishesEnd ?? undefined}
                        />
                    </Form>
                </section>
                <section className={sectionClassName}>
                    <h3>Publisering</h3>
                    <p>
                        {board.publishedAt
                            ? 'Gjestene ser bordet sitt. Det du lagrer vises for dem med en gang.'
                            : 'Gjestene ser ikke bordene før du publiserer, og får beskjed når du gjør det.'}
                    </p>
                    {hasUnsavedPlan && <p className="text-base-content/80">Lagre plasseringen før du publiserer.</p>}
                    <Form
                        action={() => configureAction(setEventSeatingPublishedAction, { params: { id: eventId } })({
                            data: { published: !board.publishedAt },
                        })}
                        submitText={board.publishedAt ? 'Skjul bordene' : 'Publiser bordene'}
                        submitColor={board.publishedAt ? 'red' : 'green'}
                        disabled={!board.publishedAt && hasUnsavedPlan}
                        refreshOnSuccess
                    />
                </section>
            </div>

            <Form
                action={configureAction(saveEventSeatingPlanAction, { params: { id: eventId } })}
                saveBar
                submitText="Lagre"
                refreshOnSuccess
            >
                {/* The plan is held in state, so discarding starts the editor over from what is saved. */}
                <JsonFieldInput name="seats" value={seats} onReset={onDiscard} />
                <JsonFieldInput name="placements" value={placements} />
                <input type="hidden" name="version" value={board.version} />
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <TextInput
                            name="seatsText"
                            label="Bord og plasser"
                            value={seatsText}
                            onChange={event => changeSeats(event.target.value)}
                            className="w-56!"
                        />
                        <Button type="button" onClick={draft} className="m-0!">
                            {plan.tables.flat().length === 0 ? 'Lag utkast' : 'Lag nytt utkast'}
                        </Button>
                        <span className="pb-2 text-s text-base-content/80">{guests.length} gjester, {places} plasser</span>
                    </div>
                    {!parseSeats(seatsText) && <p className="m-0 text-s text-error">
                        Skriv bordene som 5x8, eller hvert bord for seg som 10, 10, 8, 8.
                    </p>}

                    {plan.tables.flat().length > 0 && <div className="
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
                            ? `${selectedGuest.name} ønsket seg ${wishNames || 'ingen'}.`
                            : 'Velg noen for å se ønskene, og dra dem til et annet bord eller oppå en de skal bytte med.'}
                    </p>

                    <section {...dropZone(null)} className="p-3 rounded-inner bg-base-200">
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
                            className="min-h-24 p-3 rounded-inner bg-base-200"
                        >
                            <div className="flex justify-between gap-2 mb-1">
                                <h3 className="m-0 text-m">Bord {index + 1}</h3>
                                {moveHereButton(index) || <span className="text-s text-base-content/80">
                                    {members.length}/{seats[index]}
                                </span>}
                            </div>
                            <ul className="m-0 p-0">{members.map(guestId => renderGuest(guestId, true))}</ul>
                        </section>)}
                    </div>
                </div>
            </Form>
        </div>
    </MotionConfig>
}

/** Collecting wishes, placing the guests at tables, and publishing the result to them. */
export default function EventSeating({ eventId, board }: { eventId: number, board: SeatingBoard }) {
    const [discards, setDiscards] = useState(0)
    return <SeatingEditor key={discards} eventId={eventId} board={board} onDiscard={() => setDiscards(discards + 1)} />
}

'use client'
import AdminSection from './AdminSection'
import Form from '@/components/Form/Form'
import JsonFieldInput from '@/components/Form/JsonFieldInput'
import Button from '@/components/UI/Button'
import DateInput from '@/components/UI/DateInput'
import NumberInput from '@/components/UI/NumberInput'
import StatTile from '@/components/UI/StatTile'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import {
    openEventSeatingWishesAction,
    saveEventSeatingPlanAction,
    setEventSeatingPublishedAction,
} from '@/services/events/seating/actions'
import { DEFAULT_SEATING_POINTS, NEARNESSES } from '@/services/events/seating/constants'
import {
    createSeatingPlan,
    displaySeats,
    firstEmptySeat,
    fulfilledWishes,
    moveGuest,
    parseSeats,
    placesOf,
    reconcilePlan,
    resizePlan,
    seatingSummary,
    sidesOf,
    swapGuests,
} from '@/services/events/seating/plan'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons'
import { MotionConfig, motion } from 'framer-motion'
import { Fragment, useState } from 'react'
import type { DragEvent } from 'react'
import type { Nearness, SeatPlace, SeatingPlan, SeatingPoints } from '@/services/events/seating/plan'
import type { SeatingBoard } from '@/services/events/seating/types'

const DEFAULT_SEATS_PER_TABLE = 8


const WISH_ORDINALS = ['Første', 'Andre', 'Tredje']
const NEARNESS_LABELS: Record<Nearness, string> = {
    beside: 'Ved siden av',
    across: 'Rett overfor',
    diagonal: 'Diagonalt overfor',
    table: 'Ellers ved bordet',
}

/** The points a draft tries to get the most of, so the organizers can weigh wishes against committees. */
function PointsEditor({ points, onChange }: { points: SeatingPoints, onChange: (points: SeatingPoints) => void }) {
    const field = (label: string, value: number, change: (value: number) => SeatingPoints) => <NumberInput
        key={label}
        label={label}
        value={value}
        min={0}
        onChange={event => onChange(change(Math.max(0, Number(event.target.value) || 0)))}
        className="w-48!"
    />
    return <details className="text-s">
        <summary className="cursor-pointer">Vekting</summary>
        <p className="m-0 mt-1 text-base-content/80">
            Utkastet prøver å få flest mulig poeng. Endringer brukes neste gang du lager et utkast.
        </p>
        <p className="m-0 mt-2 font-bold">Poeng for ønsker, det nærmeste først</p>
        <div className="flex flex-wrap items-end gap-2">
            {points.wishes.map((value, rank) => field(
                `${WISH_ORDINALS[rank]} oppfylte ønske`,
                value,
                changed => ({ ...points, wishes: points.wishes.map((old, index) => (index === rank ? changed : old)) }),
            ))}
            {field('Gjensidig ønske', points.mutual, mutual => ({ ...points, mutual }))}
        </div>
        <p className="m-0 mt-2 font-bold">Prosent av poengene etter hvor nær de sitter</p>
        <div className="flex flex-wrap items-end gap-2">
            {NEARNESSES.map(nearness => field(
                NEARNESS_LABELS[nearness],
                points.nearness[nearness],
                changed => ({ ...points, nearness: { ...points.nearness, [nearness]: changed } }),
            ))}
        </div>
        <p className="m-0 mt-2 font-bold">Trekk</p>
        <div className="flex flex-wrap items-end gap-2">
            {field(
                'Per ekstra bord en komité deles på',
                points.committeeSplit,
                committeeSplit => ({ ...points, committeeSplit }),
            )}
            {field('For tomme plasser', points.emptySeat, emptySeat => ({ ...points, emptySeat }))}
            <Button type="button" onClick={() => onChange(DEFAULT_SEATING_POINTS)} className="m-0!">
                Tilbakestill
            </Button>
        </div>
    </details>
}

/** Sorted, so a plan saved and read back compares equal to what was saved. */
function placementsOf(plan: SeatingPlan, locked: number[]) {
    return plan.tables
        .flatMap((members, table) => members.flatMap((registrationId, seat) => (registrationId === null ? [] : [{
            registrationId,
            table,
            seat,
            locked: locked.includes(registrationId),
        }])))
        .sort((first, second) => first.registrationId - second.registrationId)
}

function SeatingEditor({ eventId, board, onDiscard, points, setPoints }: {
    eventId: number,
    board: SeatingBoard,
    onDiscard: () => void,
    points: SeatingPoints,
    setPoints: (points: SeatingPoints) => void,
}) {
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
    const tableIsFull = (index: number) => firstEmptySeat(plan, index) === null
    // An unreadable text leaves the tables as they were, which must not be saved or drafted from as if it said so.
    const seatsAreValid = parseSeats(seatsText) !== null
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
        const placesNow = placesOf(plan)
        const lockedPlaces = Object.fromEntries(locked.flatMap(id => {
            const place = placesNow.get(id)
            return place ? [[id, place]] : []
        }))
        setPlan(createSeatingPlan({ guests, wishes, seats, locked: lockedPlaces, seed: drafts + 1, points }))
        setDrafts(drafts + 1)
        setSelected(null)
    }

    // What was placed by hand stays put when a new draft is made.
    const moveTo = (guestId: number, place: SeatPlace | null) => {
        const there = place === null ? null : plan.tables[place.table][place.seat]
        const moved = moveGuest(plan, guestId, place)
        setPlan(moved)
        const involved = there === null ? [guestId] : [guestId, there]
        setLocked([
            ...locked.filter(id => !involved.includes(id)),
            ...involved.filter(id => !moved.unseated.includes(id)),
        ])
        setSelected(null)
    }

    const moveToTable = (guestId: number, tableIndex: number | null) => {
        const place = tableIndex === null ? null : firstEmptySeat(plan, tableIndex)
        if (tableIndex === null || place) moveTo(guestId, place)
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
            if (dragged !== null) moveToTable(dragged, tableIndex)
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
                        aria-label={`${isLocked ? 'Lås opp' : 'Lås'} ${nameOf(guestId)} til plassen`}
                        title={isLocked ? 'Beholder plassen i neste utkast' : 'Lås til plassen'}
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

    const moveHereButton = (tableIndex: number | null) => selected !== null && <Button
        type="button"
        variant="text"
        disabled={tableIndex !== null && tableIsFull(tableIndex)}
        onClick={() => moveToTable(selected, tableIndex)}
    >
        Flytt hit
    </Button>

    const renderSeat = (tableIndex: number, seat: number) => {
        const guestId = plan.tables[tableIndex][seat]
        if (guestId !== null) return renderGuest(guestId, true)
        const place = { table: tableIndex, seat }
        return <li
            key={`empty-${seat}`}
            className="list-none"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
                if (dragged === null) return
                event.stopPropagation()
                moveTo(dragged, place)
            }}
        >
            <button
                type="button"
                disabled={selected === null}
                onClick={() => {
                    if (selected !== null) moveTo(selected, place)
                }}
                aria-label={`Ledig plass ${seat + 1}`}
                className="
                    w-full px-2 py-1 border border-dashed border-base-300 rounded-inner bg-transparent text-s
                    text-base-content/80
                    enabled:cursor-pointer
                    enabled:hover:bg-base-300
                "
            >
                Ledig
            </button>
        </li>
    }

    if (guests.length === 0) return <p className="m-0 text-base-content/80">Ingen har fått plass ennå.</p>

    return <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-3">
            <div className="
                grid grid-cols-2 gap-2
                max-mobile:grid-cols-1
            ">
                <AdminSection title="Ønsker">
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
                </AdminSection>
                <AdminSection title="Publisering">
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
                </AdminSection>
            </div>

            <Form
                action={configureAction(saveEventSeatingPlanAction, { params: { id: eventId } })}
                saveBar
                submitText="Lagre"
                disabled={!seatsAreValid}
                refreshOnSuccess
            >
                {/* The plan is held in state, so discarding starts the editor over from what is saved. */}
                <JsonFieldInput name="seats" value={seats} onReset={onDiscard} />
                <JsonFieldInput name="placements" value={placements} />
                <input type="hidden" name="version" value={board.version} />
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <TextInput
                            label="Bord og plasser"
                            value={seatsText}
                            onChange={event => changeSeats(event.target.value)}
                            className="w-56!"
                        />
                        <Button type="button" onClick={draft} disabled={!seatsAreValid} className="m-0!">
                            {plan.tables.flat().length === 0 ? 'Lag utkast' : 'Lag nytt utkast'}
                        </Button>
                        <span className="pb-2 text-s text-base-content/80">{guests.length} gjester, {places} plasser</span>
                    </div>
                    {!seatsAreValid && <p className="m-0 text-s text-error">
                        Skriv bordene som 5x8, eller hvert bord for seg som 10, 10, 8, 8.
                    </p>}
                    <PointsEditor points={points} onChange={setPoints} />

                    {plan.tables.flat().length > 0 && <div className="
                        grid grid-cols-3 gap-2
                        max-mobile:grid-cols-1
                    ">
                        <StatTile label="fikk minst ett ønske" value={`${summary.gotAWish} av ${summary.wishing}`} />
                        <StatTile label="fikk alle ønskene" value={`${summary.gotAllWishes} av ${summary.wishing}`} />
                        <StatTile
                            label="komiteer samlet ved ett bord"
                            value={`${summary.committeesTogether} av ${summary.committees}`}
                        />
                    </div>}

                    <p aria-live="polite" className="m-0 min-h-6 text-s">
                        {selectedGuest
                            ? `${selectedGuest.name} ønsket seg ${wishNames || 'ingen'}.`
                            : 'Velg noen for å se ønskene, og dra dem til en ledig plass eller oppå en de skal bytte med.'}
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
                        grid grid-cols-2 gap-2
                        max-mobile:grid-cols-1
                    ">
                        {plan.tables.map((table, index) => <section
                            key={index}
                            {...dropZone(index)}
                            className="min-w-0 p-3 rounded-inner bg-base-200"
                        >
                            <div className="flex justify-between gap-2 mb-1">
                                <h3 className="m-0 text-m">Bord {index + 1}</h3>
                                {moveHereButton(index) || <span className="text-s text-base-content/80">
                                    {table.filter(guestId => guestId !== null).length}/{seats[index]}
                                </span>}
                            </div>
                            <div className="overflow-x-auto">
                                <div className="flex flex-col gap-1 w-max">
                                    {sidesOf(table.length).map((side, sideIndex) => <Fragment key={sideIndex}>
                                        {sideIndex === 1 && <div aria-hidden className="h-2 rounded-inner bg-base-300" />}
                                        <ul
                                            aria-label={`Side ${sideIndex + 1}`}
                                            className="grid grid-flow-col auto-cols-[8rem] gap-1 m-0 p-0"
                                        >
                                            {side.map(seat => renderSeat(index, seat))}
                                        </ul>
                                    </Fragment>)}
                                </div>
                            </div>
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
    const [points, setPoints] = useState(DEFAULT_SEATING_POINTS)
    // The plan is state, so the editor starts over with every saved version, or it would save an old plan as the newest.
    return <SeatingEditor
        key={`${board.version}-${discards}`}
        eventId={eventId}
        board={board}
        onDiscard={() => setDiscards(discards + 1)}
        points={points}
        setPoints={setPoints}
    />
}

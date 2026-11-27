import { eventCanBeViewedByOptions } from './constants'
import { slotsOrProblem } from './slots/schedule'
import { dateFromUtcInputValue } from '@/lib/dates/dateInputValue'
import type { EventSetup } from './publishProblems'
import type { FirstVariantSetup } from './firstSetup'
import type { Slot, SlotOnBoard, SlotSchedule, SlotScheduleDraft } from './slots/types'
import type { eventVariantSetupFormSchema } from './variants/schemas'
import type { EventVariantExpanded } from './variants/types'
import type { VisibilityRequirement } from '@/services/visibility/types'
import type { EventRegistrationType } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

/** A quota as the form holds it. `variantsToPost` leaves out what is not a field of the save. */
export type QuotaDraft = {
    /** Tells drafts apart before they have an id. */
    key: number,
    id?: number,
    name: string,
    /** None when the field was emptied in the form, which the save refuses. */
    places?: number,
    visibilityRequirements: VisibilityRequirement[],
    numOfRegistrations: number,
}

export type VariantDraft = {
    key: number,
    id?: number,
    name: string,
    description?: string,
    registrationType: EventRegistrationType,
    /** Null for a date that was emptied in the form, which the save refuses. */
    registrationStart: Date | null,
    registrationEnd: Date | null,
    takesPayment: boolean,
    /** In kroner, as it is typed. */
    price?: number,
    paymentStart?: Date | null,
    paymentEnd?: Date | null,
    requeueUnpaidRegistrations: boolean,
    /** Kept while the variant is a list, so it is there again if it is made slotted again. */
    slotSchedule: SlotScheduleDraft | null,
    /** The schedule as it is saved, which the save keeps the slots of. Null for a new variant and a list. */
    savedSchedule: SlotSchedule | null,
    /** The slots as they are saved, with who holds each. Empty for a new variant and a list. */
    savedSlots: SlotOnBoard[],
    /** Those who wait for a slot as saved, which with the holders are all a removal of everyone removes. */
    savedWaiting: number[],
    /**
     * Where those who hold a saved slot go if the schedule gives other slots: removed, all of them,
     * or each where it was chosen, the start of a new slot or null for the waiting list. Whoever is
     * not chosen for is placed by `placementsOfDraft`.
     */
    slotPlacing: { removeEveryone: boolean, chosen: Record<number, number | null> },
    numOfRegistrations: number,
    numOnWaitingList: number,
    quotas: QuotaDraft[],
}

const noPlacingChosen = { removeEveryone: false, chosen: {} }

/** The drafts of the variants as they are saved, with the slots of each slotted one and who holds them when known. */
export function toVariantDrafts(
    variants: EventVariantExpanded[],
    savedSlots: Record<number, SlotOnBoard[]> = {},
    savedWaiting: Record<number, number[]> = {},
): VariantDraft[] {
    return variants.map(variant => ({
        key: variant.id,
        id: variant.id,
        name: variant.name,
        description: variant.description ?? undefined,
        registrationType: variant.registrationType,
        registrationStart: variant.registrationStart,
        registrationEnd: variant.registrationEnd,
        takesPayment: variant.takesPayment,
        price: variant.price === null ? undefined : variant.price / 100,
        paymentStart: variant.paymentStart ?? undefined,
        paymentEnd: variant.paymentEnd ?? undefined,
        requeueUnpaidRegistrations: variant.requeueUnpaidRegistrations,
        slotSchedule: variant.slotSchedule,
        savedSchedule: variant.slotSchedule,
        savedSlots: savedSlots[variant.id] ?? [],
        savedWaiting: savedWaiting[variant.id] ?? [],
        slotPlacing: noPlacingChosen,
        numOfRegistrations: variant.numOfRegistrations,
        numOnWaitingList: variant.numOnWaitingList,
        quotas: variant.quotas.map(quota => ({
            key: quota.id,
            id: quota.id,
            name: quota.name,
            places: quota.places,
            visibilityRequirements: quota.visibility.requirements,
            numOfRegistrations: quota.numOfRegistrations,
        })),
    }))
}

type PostedVariant = z.input<typeof eventVariantSetupFormSchema>[number]

/**
 * A date as it is posted. One that was emptied is posted as an empty one, which the save refuses
 * as no date. Left out, the save would keep the old date and say all is well.
 */
const postedDate = (date: Date | null) => date ?? ''

/** The drafts as the save takes them: the fields of its schema and nothing the form holds for itself. */
export function variantsToPost(variants: VariantDraft[]): PostedVariant[] {
    return variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        description: variant.description,
        registrationType: variant.registrationType,
        registrationStart: postedDate(variant.registrationStart),
        registrationEnd: postedDate(variant.registrationEnd),
        takesPayment: variant.takesPayment,
        // A price that was emptied is posted as none, which the save refuses for a variant that takes
        // payment. Left out, the save would keep the old price and say all is well.
        price: variant.price ?? (variant.takesPayment ? 0 : undefined),
        paymentStart: variant.paymentStart === undefined ? undefined : postedDate(variant.paymentStart),
        paymentEnd: variant.paymentEnd === undefined ? undefined : postedDate(variant.paymentEnd),
        requeueUnpaidRegistrations: variant.requeueUnpaidRegistrations,
        slotSchedule: variant.registrationType === 'SLOTTED' && variant.slotSchedule
            ? { ...variant.slotSchedule, start: postedDate(variant.slotSchedule.start) }
            : null,
        slotPlacing: placingToPost(variant),
        quotas: variant.quotas.map(quota => ({
            id: quota.id,
            name: quota.name,
            places: quota.places,
            visibilityRequirements: quota.visibilityRequirements,
        })),
    }))
}

const postedDates = ['registrationStart', 'registrationEnd', 'paymentStart', 'paymentEnd', 'start']

/** A field posted as JSON. Null when the form has no such field. */
function jsonField(values: FormData, name: string, reviver?: (key: string, value: unknown) => unknown): unknown {
    const field = values.get(name)
    return typeof field === 'string' ? JSON.parse(field, reviver) : null
}

/** A variant read back from what the form posts: what the setup checks take, with the names errors are told by. */
type ReadVariant = Omit<EventSetup['variants'][number], 'quotas'> & { quotas: { name: string, places?: number }[] }

/** The variants the form would post, with their dates as dates again. None when the form has no such field. */
export function variantsFromForm(values: FormData): ReadVariant[] {
    // Written by the variants field of this form, so it has the shape `variantsToPost` gives.
    const variants = jsonField(values, 'variants', (key, value) => {
        if (!postedDates.includes(key) || typeof value !== 'string') return value
        return value === '' ? null : new Date(value)
    }) as ReadVariant[] | null
    return variants ?? []
}

/**
 * What the setup checks take, read from what the form would post. This is the one place that
 * knows how the fields of the form are posted. `saved` is the event as it is saved, for what the
 * form has no field for.
 */
export function eventSetupFromForm(
    values: FormData,
    saved: Pick<EventSetup,
        'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'ledgerAccount' | 'adminVisibility' | 'companyPresentation'
        | 'requiresPresentationSeat'
    >,
): EventSetup {
    const location = values.get('location')
    const eventStart = values.get('eventStart')
    const eventEnd = values.get('eventEnd')
    const canBeViewedBy = values.get('canBeViewedBy')
    const account = values.get('ledgerAccountSelection')
    // Written by the visibility editor of this form, so it has the shape that posts.
    const adminRequirements = jsonField(values, 'adminRequirements') as VisibilityRequirement[] | null

    return {
        location: typeof location === 'string' ? location : null,
        eventStart: typeof eventStart === 'string' ? dateFromUtcInputValue(eventStart) : saved.eventStart,
        eventEnd: typeof eventEnd === 'string' ? dateFromUtcInputValue(eventEnd) : saved.eventEnd,
        canBeViewedBy: eventCanBeViewedByOptions.find(option => option.value === canBeViewedBy)?.value
            ?? saved.canBeViewedBy,
        // An account left unpicked keeps the one the event has, as the save does.
        ledgerAccount: saved.ledgerAccount
            ?? (typeof account === 'string' && account !== 'NULL' ? { id: Number(account) } : null),
        variants: variantsFromForm(values),
        // Not a field of the form when who administrates the event could not be read.
        adminVisibility: adminRequirements ? { requirements: adminRequirements } : saved.adminVisibility,
        // The presentation as it is saved, since the form holds only the name of one picked.
        companyPresentation: saved.companyPresentation,
        // Not a field of the form while no presentation is shown in it.
        requiresPresentationSeat: values.has('requiresPresentationSeat')
            ? values.getAll('requiresPresentationSeat').includes('on')
            : saved.requiresPresentationSeat,
    }
}

/**
 * A key for a new draft among the ones it joins: below theirs, and below zero, so that it can
 * never meet the id of something saved.
 */
function nextDraftKey(siblings: { key: number }[]) {
    return Math.min(0, ...siblings.map(sibling => sibling.key)) - 1
}

/** The slots of a variant as the form holds it. Null for a list, and for a schedule that gives none. */
export function slotsOfDraft(variant: VariantDraft): Slot[] | null {
    if (variant.registrationType !== 'SLOTTED' || !variant.slotSchedule) return null
    return slotsOrProblem(variant.slotSchedule).slots
}

/** Those who hold a saved slot of the variant, in the order of their slots. */
export function slotHolders(variant: VariantDraft) {
    return variant.savedSlots.flatMap(({ holder, ...slot }) => (holder ? [{ ...holder, slot }] : []))
}

const sameSchedule = (draft: SlotScheduleDraft, saved: SlotSchedule) => (
    draft.start?.getTime() === saved.start.getTime() && draft.slotMinutes === saved.slotMinutes
    && draft.breakMinutes === saved.breakMinutes && draft.totalMinutes === saved.totalMinutes
    && draft.longBreakEveryMinutes === saved.longBreakEveryMinutes && draft.longBreakMinutes === saved.longBreakMinutes
)

/**
 * The slots of the variant as the form holds it when the save would replace the saved ones while
 * someone holds one of those, so that they must be placed in the new ones: the schedule is changed,
 * and gives other slots. Null otherwise.
 */
export function slotsToPlaceIn(variant: VariantDraft): Slot[] | null {
    const slots = slotsOfDraft(variant)
    if (!slots || !variant.slotSchedule || slotHolders(variant).length === 0) return null
    if (variant.savedSchedule && sameSchedule(variant.slotSchedule, variant.savedSchedule)) return null
    const same = slots.length === variant.savedSlots.length && slots.every((slot, index) => (
        slot.start.getTime() === variant.savedSlots[index].start.getTime()
        && slot.end.getTime() === variant.savedSlots[index].end.getTime()
    ))
    return same ? null : slots
}

/**
 * Where each who holds a saved slot is placed among the slots given: where it was chosen, while
 * that is the waiting list or one of the slots, and otherwise in the slot that starts when theirs
 * did, or else the earliest one left, in the order of their slots. Whoever is left without one waits.
 */
export function placementsOfDraft(variant: VariantDraft, slots: Slot[]) {
    const holders = slotHolders(variant)
    const { chosen } = variant.slotPlacing
    const isChosen = (registrationId: number) => registrationId in chosen && (
        chosen[registrationId] === null || slots.some(slot => slot.start.getTime() === chosen[registrationId])
    )
    const taken = new Set(holders.flatMap(holder => {
        const start = chosen[holder.registrationId]
        return isChosen(holder.registrationId) && start !== null ? [start] : []
    }))
    const free = (slot: Slot) => !taken.has(slot.start.getTime())
    const starts = new Map<number, number | null>()
    for (const holder of holders) {
        if (isChosen(holder.registrationId)) {
            starts.set(holder.registrationId, chosen[holder.registrationId])
            continue
        }
        const same = slots.find(slot => free(slot) && slot.start.getTime() === holder.slot.start.getTime())
        if (same) {
            starts.set(holder.registrationId, same.start.getTime())
            taken.add(same.start.getTime())
        }
    }
    for (const holder of holders) {
        if (starts.has(holder.registrationId)) continue
        const earliest = slots.find(free)
        starts.set(holder.registrationId, earliest?.start.getTime() ?? null)
        if (earliest) taken.add(earliest.start.getTime())
    }
    return holders.map(holder => {
        const start = starts.get(holder.registrationId) ?? null
        return { ...holder, slotStart: start === null ? null : new Date(start) }
    })
}

/** The placing the save takes for the variant, which is none while no one has to be placed. */
function placingToPost(variant: VariantDraft): PostedVariant['slotPlacing'] {
    const slots = slotsToPlaceIn(variant)
    if (!slots) return null
    if (variant.slotPlacing.removeEveryone) {
        return {
            removeEveryone: true,
            registrationIds: [...slotHolders(variant).map(holder => holder.registrationId), ...variant.savedWaiting],
        }
    }
    return {
        removeEveryone: false,
        placements: placementsOfDraft(variant, slots)
            .map(({ registrationId, slotStart }) => ({ registrationId, slotStart })),
    }
}

/** A slotted variant with one quota has a place in it for each slot, and with several they are shared out by hand. */
export function withPlacesOfSlots(variant: VariantDraft): VariantDraft {
    const slots = slotsOfDraft(variant)
    if (!slots || variant.quotas.length !== 1) return variant
    return { ...variant, quotas: [{ ...variant.quotas[0], places: slots.length }] }
}

/** A new quota for the variant that has `siblings`. */
export function newQuotaDraft(
    name: string,
    siblings: QuotaDraft[],
    visibilityRequirements: VisibilityRequirement[] = [],
): QuotaDraft {
    return { key: nextDraftKey(siblings), name, places: 0, visibilityRequirements, numOfRegistrations: 0 }
}

/**
 * A new variant for the event that has `siblings`. It starts out like the one given, if any, and
 * otherwise open until the event starts.
 */
export function newVariantDraft(
    name: string,
    eventStart: Date,
    siblings: VariantDraft[],
    like?: VariantDraft,
): VariantDraft {
    return withPlacesOfSlots({
        key: nextDraftKey(siblings),
        name,
        registrationType: like?.registrationType ?? 'LIST',
        registrationStart: like?.registrationStart ?? new Date(),
        registrationEnd: like?.registrationEnd ?? eventStart,
        takesPayment: false,
        requeueUnpaidRegistrations: false,
        slotSchedule: like?.slotSchedule ?? null,
        savedSchedule: null,
        savedSlots: [],
        savedWaiting: [],
        slotPlacing: noPlacingChosen,
        numOfRegistrations: 0,
        numOnWaitingList: 0,
        quotas: [newQuotaDraft('Påmelding', [], like?.quotas[0]?.visibilityRequirements)],
    })
}

/** The first variant of an event, which starts out as the event's kind gives. */
export function firstVariantDraft(name: string, eventStart: Date, ofKind: FirstVariantSetup): VariantDraft {
    return withPlacesOfSlots({
        ...newVariantDraft(name, eventStart, []),
        registrationType: ofKind.registrationType,
        slotSchedule: ofKind.slotSchedule,
        ...ofKind.registrationPeriod,
    })
}

export const hasRegistrants = (variant: VariantDraft) => variant.numOfRegistrations + variant.numOnWaitingList > 0

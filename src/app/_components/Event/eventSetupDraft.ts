import { dateFromUtcInputValue } from '@/lib/dates/dateInputValue'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import type { EventSetup } from '@/services/events/publishProblems'
import type { eventVariantSetupFormSchema } from '@/services/events/variants/schemas'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { VisibilityRequirement } from '@/services/visibility/types'
import type { z } from 'zod'

/** A quota as the form holds it. `variantsToPost` leaves out what is not a field of the save. */
export type QuotaDraft = {
    /** Tells drafts apart before they have an id. */
    key: number,
    id?: number,
    name: string,
    places: number,
    visibilityRequirements: VisibilityRequirement[],
    numOfRegistrations: number,
}

export type VariantDraft = {
    key: number,
    id?: number,
    name: string,
    registrationStart: Date,
    registrationEnd: Date,
    takesPayment: boolean,
    /** In kroner, as it is typed. */
    price?: number,
    paymentStart?: Date,
    paymentEnd?: Date,
    requeueUnpaidRegistrations: boolean,
    numOfRegistrations: number,
    numOnWaitingList: number,
    quotas: QuotaDraft[],
}

export function toVariantDrafts(variants: EventVariantExpanded[]): VariantDraft[] {
    return variants.map(variant => ({
        key: variant.id,
        id: variant.id,
        name: variant.name,
        registrationStart: variant.registrationStart,
        registrationEnd: variant.registrationEnd,
        takesPayment: variant.takesPayment,
        price: variant.price === null ? undefined : variant.price / 100,
        paymentStart: variant.paymentStart ?? undefined,
        paymentEnd: variant.paymentEnd ?? undefined,
        requeueUnpaidRegistrations: variant.requeueUnpaidRegistrations,
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

/** The drafts as the save takes them: the fields of its schema and nothing the form holds for itself. */
export function variantsToPost(variants: VariantDraft[]): PostedVariant[] {
    return variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        registrationStart: variant.registrationStart,
        registrationEnd: variant.registrationEnd,
        takesPayment: variant.takesPayment,
        price: variant.price,
        paymentStart: variant.paymentStart,
        paymentEnd: variant.paymentEnd,
        requeueUnpaidRegistrations: variant.requeueUnpaidRegistrations,
        quotas: variant.quotas.map(quota => ({
            id: quota.id,
            name: quota.name,
            places: quota.places,
            visibilityRequirements: quota.visibilityRequirements,
        })),
    }))
}

const postedDates = ['registrationStart', 'registrationEnd', 'paymentStart', 'paymentEnd']

/** A field posted as JSON. Null when the form has no such field. */
function jsonField(values: FormData, name: string, reviver?: (key: string, value: unknown) => unknown): unknown {
    const field = values.get(name)
    return typeof field === 'string' ? JSON.parse(field, reviver) : null
}

/** A variant read back from what the form posts: what the setup checks take, with the names errors are told by. */
type ReadVariant = Omit<EventSetup['variants'][number], 'quotas'> & { quotas: { name: string, places: number }[] }

/** The variants the form would post, with their dates as dates again. None when the form has no such field. */
export function variantsFromForm(values: FormData): ReadVariant[] {
    // Written by the variants field of this form, so it has the shape `variantsToPost` gives.
    const variants = jsonField(values, 'variants', (key, value) => (
        postedDates.includes(key) && typeof value === 'string' ? new Date(value) : value
    )) as ReadVariant[] | null
    return variants ?? []
}

/**
 * What the setup checks take, read from what the form would post. This is the one place that
 * knows how the fields of the form are posted. `saved` is the event as it is saved, for what the
 * form has no field for.
 */
export function eventSetupFromForm(
    values: FormData,
    saved: Pick<EventSetup, 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'ledgerAccount' | 'adminVisibility'>,
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
    }
}

/**
 * A key for a new draft among the ones it joins: below theirs, and below zero, so that it can
 * never meet the id of something saved.
 */
function nextDraftKey(siblings: { key: number }[]) {
    return Math.min(0, ...siblings.map(sibling => sibling.key)) - 1
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
    return {
        key: nextDraftKey(siblings),
        name,
        registrationStart: like?.registrationStart ?? new Date(),
        registrationEnd: like?.registrationEnd ?? eventStart,
        takesPayment: false,
        requeueUnpaidRegistrations: false,
        numOfRegistrations: 0,
        numOnWaitingList: 0,
        quotas: [newQuotaDraft('Påmelding', [], like?.quotas[0]?.visibilityRequirements)],
    }
}

export const hasRegistrants = (variant: VariantDraft) => variant.numOfRegistrations + variant.numOnWaitingList > 0

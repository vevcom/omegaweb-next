import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

/** A quota as the form holds it. What is not a field of the save goes unread by the server. */
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

/** The drafts as the field of the form that posts them holds them. */
export const variantDraftsToField = (variants: VariantDraft[]) => JSON.stringify(variants)

const draftDates = ['registrationStart', 'registrationEnd', 'paymentStart', 'paymentEnd']

/** The drafts back from the field, with their dates as dates again. Without the field there are none. */
export function variantDraftsFromField(field: FormDataEntryValue | null): VariantDraft[] {
    if (typeof field !== 'string') return []
    return JSON.parse(field, (key, value: unknown) => (
        draftDates.includes(key) && typeof value === 'string' ? new Date(value) : value
    )) as VariantDraft[]
}

let lastDraftKey = 0

/** Below zero, so a key can never meet the id of something saved. */
function nextDraftKey() {
    lastDraftKey -= 1
    return lastDraftKey
}

export function newQuotaDraft(name: string, visibilityRequirements: VisibilityRequirement[] = []): QuotaDraft {
    return { key: nextDraftKey(), name, places: 0, visibilityRequirements, numOfRegistrations: 0 }
}

/** A new variant starts out like the one given, if any, and otherwise open until the event starts. */
export function newVariantDraft(name: string, eventStart: Date, like?: VariantDraft): VariantDraft {
    return {
        key: nextDraftKey(),
        name,
        registrationStart: like?.registrationStart ?? new Date(),
        registrationEnd: like?.registrationEnd ?? eventStart,
        takesPayment: false,
        requeueUnpaidRegistrations: false,
        numOfRegistrations: 0,
        numOnWaitingList: 0,
        quotas: [newQuotaDraft('Påmelding', like?.quotas[0]?.visibilityRequirements)],
    }
}

export const hasRegistrants = (variant: VariantDraft) => variant.numOfRegistrations + variant.numOnWaitingList > 0

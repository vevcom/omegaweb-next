import {
    eventSetupFromForm,
    newQuotaDraft,
    newVariantDraft,
    placementsOfDraft,
    slotsOfDraft,
    slotsToPlaceIn,
    toVariantDrafts,
    variantsFromForm,
    variantsToPost,
    withPlacesOfSlots,
} from '@/services/events/setupDraft'
import { eventSetupChecks } from '@/services/events/publishProblems'
import { defaultSlotSchedule } from '@/services/events/slots/schedule'
import { eventVariantSetupFormSchema } from '@/services/events/variants/schemas'
import { activeMembersOf } from 'tests/utils'
import { describe, expect, test } from '@jest/globals'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { SlotOnBoard } from '@/services/events/slots/types'

const opens = new Date('2026-11-20T10:00:00.000Z')
const closes = new Date('2026-11-25T10:00:00.000Z')

/** A saved variant as the event's page reads it, in what the drafts take from it. */
const saved = (id: number, quotaIds: number[]): EventVariantExpanded => ({
    id,
    order: 0,
    name: `Variant ${id}`,
    description: null,
    registrationType: 'LIST',
    registrationStart: opens,
    registrationEnd: closes,
    takesPayment: true,
    price: 15000,
    paymentStart: opens,
    paymentEnd: null,
    requeueUnpaidRegistrations: false,
    slotSchedule: null,
    takesRegistration: true,
    places: 5 * quotaIds.length,
    numOfRegistrations: 1,
    numOnWaitingList: 0,
    quotas: quotaIds.map((quotaId, order) => ({
        id: quotaId,
        order,
        name: `Kvote ${quotaId}`,
        places: 5,
        visibilityId: quotaId,
        numOfRegistrations: 1,
        visibility: { requirements: [{ conditions: [activeMembersOf(4)] }] },
    })),
})

const formOf = (fields: Record<string, string>) => {
    const values = new FormData()
    Object.entries(fields).forEach(([name, value]) => values.set(name, value))
    return values
}

const asSaved = {
    eventStart: new Date(0),
    eventEnd: new Date(0),
    canBeViewedBy: 'ALL' as const,
    ledgerAccount: null,
    adminVisibility: { requirements: [] },
}

describe('the drafts of the setup form', () => {
    test('are posted as the fields the save takes, with the price in kroner', () => {
        const [posted] = variantsToPost(toVariantDrafts([saved(7, [3])]))

        expect(Object.keys(posted)).toEqual([
            'id', 'name', 'description', 'registrationType', 'registrationStart', 'registrationEnd', 'takesPayment',
            'price', 'paymentStart', 'paymentEnd', 'requeueUnpaidRegistrations', 'slotSchedule', 'slotPlacing', 'quotas',
        ])
        expect(Object.keys(posted.quotas[0])).toEqual(['id', 'name', 'places', 'visibilityRequirements'])
        expect(posted.price).toBe(150)
    })

    test('are taken by the schema of the save once they have been through the form', () => {
        const posted: unknown = JSON.parse(JSON.stringify(variantsToPost(toVariantDrafts([saved(7, [3, 4])]))))

        const parsed = eventVariantSetupFormSchema.parse(posted)
        expect(parsed[0]).toMatchObject({ id: 7, price: 15000, registrationStart: opens })
        expect(parsed[0].quotas.map(quota => quota.id)).toEqual([3, 4])
    })

    test('post an emptied date as an empty one, which the save refuses and the checks ask for', () => {
        const [draft] = toVariantDrafts([saved(7, [3])])
        const [posted] = variantsToPost([{ ...draft, registrationEnd: null, paymentStart: null }])
        expect(posted).toMatchObject({ registrationEnd: '', paymentStart: '' })

        const result = eventVariantSetupFormSchema.safeParse(JSON.parse(JSON.stringify([posted])))
        expect(result.success).toBe(false)
        expect(result.error?.issues.map(issue => issue.path.join('.'))).toEqual(['0.registrationEnd', '0.paymentStart'])

        const values = new FormData()
        values.set('variants', JSON.stringify([posted]))
        expect(variantsFromForm(values)[0]).toMatchObject({
            registrationStart: opens, registrationEnd: null, paymentStart: null,
        })
    })

    test('post emptied places as none, which the save refuses and the checks count as no places', () => {
        const [draft] = toVariantDrafts([saved(7, [3])])
        const posted = variantsToPost([{ ...draft, quotas: [{ ...draft.quotas[0], places: undefined }] }])
        const values = formOf({ variants: JSON.stringify(posted) })

        const result = eventVariantSetupFormSchema.safeParse(JSON.parse(JSON.stringify(posted)))
        expect(result.error?.issues.map(issue => issue.path.join('.'))).toEqual(['0.quotas.0.places'])
        expect(result.error?.issues[0].message).toBe('Antall plasser må fylles ut')

        expect(eventSetupChecks(eventSetupFromForm(values, asSaved)).map(check => check.message))
            .toContain('Ingen plasser er satt.')
    })

    test('get keys of their own, below those of their siblings and of anything saved', () => {
        const drafts = toVariantDrafts([saved(7, [3])])
        const first = newVariantDraft('Ny', closes, drafts)
        const second = newVariantDraft('Enda en', closes, [...drafts, first], first)

        expect([drafts[0].key, first.key, second.key]).toEqual([7, -1, -2])
        expect(newQuotaDraft('Ny kvote', drafts[0].quotas).key).toBe(-1)
        expect(second.registrationStart).toEqual(first.registrationStart)
    })
})

describe('the setup read from what the form would post', () => {
    const variants = JSON.stringify(variantsToPost(toVariantDrafts([saved(7, [3])])))

    test('has the variants with their dates as dates', () => {
        const [variant] = variantsFromForm(formOf({ variants }))

        expect(variant.registrationStart).toEqual(opens)
        expect(variant.paymentStart).toEqual(opens)
        expect(variant.quotas).toMatchObject([{ name: 'Kvote 3', places: 5 }])
        expect(variantsFromForm(new FormData())).toEqual([])
    })

    test('reads each field the way it is posted', () => {
        const setup = eventSetupFromForm(formOf({
            location: 'Lophtet',
            eventStart: '2026-11-24T10:00',
            eventEnd: '2026-11-24T12:00',
            canBeViewedBy: 'CAN_REGISTER',
            ledgerAccountSelection: '12',
            adminRequirements: JSON.stringify([{ conditions: [activeMembersOf(1)] }]),
            variants,
        }), asSaved)

        expect(setup).toMatchObject({
            location: 'Lophtet',
            eventStart: new Date('2026-11-24T10:00:00.000Z'),
            eventEnd: new Date('2026-11-24T12:00:00.000Z'),
            canBeViewedBy: 'CAN_REGISTER',
            ledgerAccount: { id: 12 },
            adminVisibility: { requirements: [{ conditions: [activeMembersOf(1)] }] },
        })
        expect(setup.variants).toHaveLength(1)
    })

    test('falls back on the event as it is saved for what the form has no field for', () => {
        expect(eventSetupFromForm(new FormData(), asSaved)).toEqual({ ...asSaved, location: null, variants: [] })
        expect(eventSetupFromForm(formOf({ canBeViewedBy: 'NOE ANNET', ledgerAccountSelection: 'NULL' }), asSaved))
            .toMatchObject({ canBeViewedBy: 'ALL', ledgerAccount: null })
        expect(eventSetupFromForm(formOf({ ledgerAccountSelection: '12' }), { ...asSaved, ledgerAccount: { id: 5 } }))
            .toMatchObject({ ledgerAccount: { id: 5 } })
    })
})

describe('the drafts of a slotted variant', () => {
    const schedule = defaultSlotSchedule(opens)
    const slottedDraft = (quotaIds: number[]) => ({
        ...toVariantDrafts([saved(7, quotaIds)])[0],
        registrationType: 'SLOTTED' as const,
        slotSchedule: schedule,
    })

    test('post the schedule, which is read back with its start as a date, and the schema of the save takes', () => {
        const variants = JSON.stringify(variantsToPost([slottedDraft([3])]))

        expect(variantsFromForm(formOf({ variants }))[0].slotSchedule).toEqual(schedule)
        expect(eventVariantSetupFormSchema.parse(JSON.parse(variants))[0].slotSchedule).toEqual(schedule)
    })

    test('post no schedule once made a list, while the draft keeps it for being made slotted again', () => {
        const madeList = { ...slottedDraft([3]), registrationType: 'LIST' as const }

        expect(variantsToPost([madeList])[0].slotSchedule).toBeNull()
        expect(madeList.slotSchedule).toEqual(schedule)
    })

    test('post an emptied start as an empty one, which the save refuses', () => {
        const emptied = variantsToPost([{ ...slottedDraft([3]), slotSchedule: { ...schedule, start: null } }])

        expect(variantsFromForm(formOf({ variants: JSON.stringify(emptied) }))[0].slotSchedule?.start).toBeNull()
        expect(eventVariantSetupFormSchema.safeParse(emptied).success).toBe(false)
    })

    test('have a place in their one quota for each slot, and leave places shared out over several to be typed', () => {
        expect(slotsOfDraft(slottedDraft([3]))).toHaveLength(8)
        expect(withPlacesOfSlots(slottedDraft([3])).quotas.map(quota => quota.places)).toEqual([8])
        expect(withPlacesOfSlots(slottedDraft([3, 4])).quotas.map(quota => quota.places)).toEqual([5, 5])
        expect(withPlacesOfSlots(toVariantDrafts([saved(7, [3])])[0]).quotas.map(quota => quota.places)).toEqual([5])
    })

    test('copied into a new variant keep the schedule and its places', () => {
        const copy = newVariantDraft('Variant 2', closes, [slottedDraft([3])], slottedDraft([3]))

        expect(copy).toMatchObject({ registrationType: 'SLOTTED', slotSchedule: schedule })
        expect(copy.quotas.map(quota => quota.places)).toEqual([8])
    })
})

describe('the placing of those who hold a slot of a slotted variant', () => {
    const minutes = (count: number) => new Date(opens.getTime() + count * 60 * 1000)
    // Three saved slots, as the default schedule gives them, held by 1 and 2, and the second free.
    const savedSlots: SlotOnBoard[] = [0, 15, 30].map((start, index) => ({
        id: index + 1,
        start: minutes(start),
        end: minutes(start + 10),
        holder: index === 1 ? null : { registrationId: index + 1, name: `Påmeldt ${index + 1}`, paid: false },
    }))
    const draftOf = (totalMinutes: number, slotPlacing = { removeEveryone: false, chosen: {} }) => ({
        ...toVariantDrafts([saved(7, [3])], { 7: savedSlots })[0],
        registrationType: 'SLOTTED' as const,
        slotSchedule: { ...defaultSlotSchedule(opens), totalMinutes },
        slotPlacing,
    })
    const startsOf = (draft: ReturnType<typeof draftOf>) => placementsOfDraft(draft, slotsToPlaceIn(draft)!)
        .map(placement => placement.slotStart && (placement.slotStart.getTime() - opens.getTime()) / 60000)

    test('is posted only when the slots are not the saved ones and someone holds one of those', () => {
        expect(slotsToPlaceIn(draftOf(40))).toBeNull()
        expect(variantsToPost([draftOf(40)])[0].slotPlacing).toBeNull()
        expect(slotsToPlaceIn({ ...draftOf(25), savedSlots: savedSlots.map(slot => ({ ...slot, holder: null })) }))
            .toBeNull()
        // Saved under a rule that gave other slots than it does now, which the save keeps.
        const savedSchedule = { ...defaultSlotSchedule(opens), start: opens, totalMinutes: 25 }
        expect(slotsToPlaceIn({ ...draftOf(25), savedSchedule })).toBeNull()
        expect(variantsToPost([draftOf(25)])[0].slotPlacing).toEqual({
            removeEveryone: false,
            placements: [{ registrationId: 1, slotStart: minutes(0) }, { registrationId: 3, slotStart: minutes(15) }],
        })
    })

    test('keeps each in the slot that starts when theirs did, and puts the rest in the earliest left, in order', () => {
        expect(startsOf(draftOf(55))).toEqual([0, 30])
        expect(startsOf(draftOf(25))).toEqual([0, 15])
        expect(startsOf(draftOf(10))).toEqual([0, null])
    })

    test('puts each where it was chosen, while that is one of the slots or the waiting list', () => {
        expect(startsOf(draftOf(55, { removeEveryone: false, chosen: { 3: minutes(0).getTime() } }))).toEqual([15, 0])
        expect(startsOf(draftOf(55, { removeEveryone: false, chosen: { 1: null } }))).toEqual([null, 30])
        expect(startsOf(draftOf(55, { removeEveryone: false, chosen: { 1: minutes(5).getTime() } }))).toEqual([0, 30])
        // Those it knew to remove, holders and those waiting, so that no one who came since is removed.
        expect(variantsToPost([{ ...draftOf(25, { removeEveryone: true, chosen: {} }), savedWaiting: [9] }])[0].slotPlacing)
            .toEqual({ removeEveryone: true, registrationIds: [1, 3, 9] })
    })
})

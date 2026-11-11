import {
    eventSetupFromForm,
    newQuotaDraft,
    newVariantDraft,
    toVariantDrafts,
    variantsFromForm,
    variantsToPost,
} from '@/services/events/setupDraft'
import { eventVariantSetupFormSchema } from '@/services/events/variants/schemas'
import { describe, expect, test } from '@jest/globals'
import type { EventVariantExpanded } from '@/services/events/variants/types'

const opens = new Date('2026-11-20T10:00:00.000Z')
const closes = new Date('2026-11-25T10:00:00.000Z')

/** A saved variant as the event's page reads it, in what the drafts take from it. */
const saved = (id: number, quotaIds: number[]): EventVariantExpanded => ({
    id,
    order: 0,
    name: `Variant ${id}`,
    registrationStart: opens,
    registrationEnd: closes,
    takesPayment: true,
    price: 15000,
    paymentStart: opens,
    paymentEnd: null,
    requeueUnpaidRegistrations: false,
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
        visibility: { requirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId: 4 }] }] },
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
            'id', 'name', 'registrationStart', 'registrationEnd', 'takesPayment', 'price', 'paymentStart', 'paymentEnd',
            'requeueUnpaidRegistrations', 'quotas',
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
            adminRequirements: JSON.stringify([{ conditions: [{ type: 'ACTIVE', groupId: 1 }] }]),
            variants,
        }), asSaved)

        expect(setup).toMatchObject({
            location: 'Lophtet',
            eventStart: new Date('2026-11-24T10:00:00.000Z'),
            eventEnd: new Date('2026-11-24T12:00:00.000Z'),
            canBeViewedBy: 'CAN_REGISTER',
            ledgerAccount: { id: 12 },
            adminVisibility: { requirements: [{ conditions: [{ type: 'ACTIVE', groupId: 1 }] }] },
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

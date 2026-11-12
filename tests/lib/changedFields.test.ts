import { changedFields } from '@/lib/changedFields'
import { describe, expect, test } from '@jest/globals'

describe('the fields that changed', () => {
    const current = { name: 'Alle', places: 5, opens: new Date('2026-11-20T10:00:00Z'), price: null }

    test('are the ones given with another value', () => {
        expect(changedFields(current, { name: 'Alle', places: 6 })).toEqual({ places: 6 })
        expect(changedFields(current, { name: 'Alle', places: 5 })).toEqual({})
    })

    test('do not include a date at the same instant', () => {
        expect(changedFields(current, { opens: new Date('2026-11-20T10:00:00Z') })).toEqual({})
        expect(changedFields(current, { opens: new Date('2026-11-20T11:00:00Z') }))
            .toEqual({ opens: new Date('2026-11-20T11:00:00Z') })
    })

    test('do not include what is given as undefined, and do include a value where there was none', () => {
        expect(changedFields(current, { price: undefined, name: undefined })).toEqual({})
        expect(changedFields(current, { price: 100 })).toEqual({ price: 100 })
    })
})

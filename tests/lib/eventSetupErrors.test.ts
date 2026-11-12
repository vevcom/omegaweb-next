import { nameVariantInErrors } from '@/services/events/setupErrors'
import { describe, expect, test } from '@jest/globals'

describe('errors about the posted variants', () => {
    const variants = [
        { name: 'Vanlig', quotas: [{ name: 'Styret' }, { name: 'Alle' }] },
        { name: 'VIP', quotas: [{ name: 'Påmelding' }] },
    ]
    const messageOf = (path: (string | number)[], among = variants) => (
        nameVariantInErrors([{ path, message: 'Prisen kan ikke være negativ' }], among)[0].message
    )

    test('name the variant when there are several', () => {
        expect(messageOf(['variants', 1, 'price'])).toBe('VIP: Prisen kan ikke være negativ')
        expect(messageOf(['variants', 0, 'price'], [variants[0]])).toBe('Prisen kan ikke være negativ')
    })

    test('name the quota when its variant has several', () => {
        expect(messageOf(['variants', 0, 'quotas', 1, 'places'])).toBe('Vanlig, kvoten Alle: Prisen kan ikke være negativ')
        expect(messageOf(['variants', 1, 'quotas', 0, 'places'])).toBe('VIP: Prisen kan ikke være negativ')
        expect(messageOf(['variants', 0, 'quotas', 0, 'places'], [variants[0]]))
            .toBe('kvoten Styret: Prisen kan ikke være negativ')
    })

    test('leave other errors, and ones that point at nothing, as they are', () => {
        const errors = [
            { path: ['name'], message: 'Navnet må være minst 5 tegn' },
            { message: 'Noe gikk galt' },
            { path: ['variants', 7, 'price'], message: 'Prisen kan ikke være negativ' },
        ]
        expect(nameVariantInErrors(errors, variants)).toEqual(errors)
    })
})

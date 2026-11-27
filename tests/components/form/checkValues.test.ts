import { checkValues } from '@/components/Form/Declared/checkValues'
import { describe, expect, test } from '@jest/globals'
import { z } from 'zod'

const schema = z.object({ quote: z.string().min(1, 'Sitatet kan ikke være tomt'), author: z.string().optional() })

describe('checking the values of a declared form', () => {
    test('a field the schema does not know is an issue at that field in development', () => {
        expect(checkValues(schema, { quote: 'Det ordner seg', auhtor: 'Kongen' })).toEqual([
            { path: ['auhtor'], message: expect.stringContaining('auhtor') },
        ])
    })

    test('a field the schema knows and a field with no value are not', () => {
        expect(checkValues(schema, { quote: 'Det ordner seg', author: 'Kongen', auhtor: undefined })).toEqual([])
    })

    test('no field is, when what the schema gives back is not an object with the fields', () => {
        const toText = schema.transform(({ quote }) => quote)

        expect(checkValues(toText, { quote: 'Det ordner seg', author: 'Kongen' })).toEqual([])
    })
})

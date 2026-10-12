import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { maxPageSize } from '@/lib/paging/constants'
import { describe, expect, test } from '@jest/globals'
import { z } from 'zod'

const schema = readPageInputSchemaObject(
    z.object({ id: z.number() }),
    z.undefined(),
)

function parsePage(page: unknown) {
    return schema.safeParse({ paging: { page, details: undefined } })
}

describe('readPageInputSchemaObject', () => {
    test.each([1, 50, maxPageSize])('accepts page size %d', pageSize => {
        expect(parsePage({ pageSize, page: 0, cursor: null }).success).toBe(true)
        expect(parsePage({ pageSize, page: 3, cursor: { id: 1 } }).success).toBe(true)
    })

    test.each([0, -1, 1.5, maxPageSize + 1, 1_000_000])('rejects page size %d', pageSize => {
        expect(parsePage({ pageSize, page: 0, cursor: null }).success).toBe(false)
        expect(parsePage({ pageSize, page: 3, cursor: { id: 1 } }).success).toBe(false)
    })

    test.each([-1, 1.5])('rejects page %d', page => {
        expect(parsePage({ pageSize: 10, page, cursor: { id: 1 } }).success).toBe(false)
    })

    test('rejects a null cursor past the first page', () => {
        expect(parsePage({ pageSize: 10, page: 2, cursor: null }).success).toBe(false)
    })
})

import { pagingStateAfterFetch } from '@/lib/paging/pagingStateAfterFetch'
import { describe, expect, test } from '@jest/globals'
import type { PagingState } from '@/lib/paging/types'

type Row = { id: number }

const firstPage: PagingState<Row, { id: number }, 2> = {
    data: [{ id: 1 }, { id: 2 }],
    page: { page: 1, pageSize: 2, cursor: { id: 2 } },
    allLoaded: false,
    errorCode: null,
}

function cursorAfter(rows: Row[]) {
    return rows.length ? { id: rows[rows.length - 1].id } : null
}

describe('pagingStateAfterFetch', () => {
    test('appends a fetched page and moves the cursor past it', () => {
        const state = pagingStateAfterFetch(firstPage, { success: true, data: [{ id: 3 }, { id: 4 }] }, cursorAfter)

        expect(state).toEqual({
            data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            page: { page: 2, pageSize: 2, cursor: { id: 4 } },
            allLoaded: false,
            errorCode: null,
        })
    })

    test('is all loaded after a page shorter than the page size', () => {
        const state = pagingStateAfterFetch(firstPage, { success: true, data: [{ id: 3 }] }, cursorAfter)

        expect(state.allLoaded).toBe(true)
    })

    test('keeps the error of a failed page and the data before it', () => {
        const state = pagingStateAfterFetch(
            firstPage,
            { success: false, errorCode: 'UNAUTHORIZED', httpCode: 403 },
            cursorAfter,
        )

        expect(state).toEqual({ ...firstPage, errorCode: 'UNAUTHORIZED' })
    })
})

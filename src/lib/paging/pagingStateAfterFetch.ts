import type { ActionReturn } from '@/services/actionTypes'
import type { PagingState } from '@/lib/paging/types'

export function pagingStateAfterFetch<Data, Cursor, PageSize extends number>(
    state: PagingState<Data, Cursor, PageSize>,
    result: ActionReturn<Data[]>,
    getCursorAfterFetch: (data: Data[]) => Cursor | null,
): PagingState<Data, Cursor, PageSize> {
    if (!result.success) return { ...state, errorCode: result.errorCode }
    const newCursor = getCursorAfterFetch(result.data)
    return {
        data: [...state.data, ...result.data],
        page: newCursor ? {
            page: state.page.page + 1,
            cursor: newCursor,
            pageSize: state.page.pageSize,
        } : state.page,
        allLoaded: result.data.length < state.page.pageSize,
        errorCode: null,
    }
}

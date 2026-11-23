import type { ErrorCode } from '@/services/error'

export type Page<PageSize extends number, Cursor> = {
    readonly pageSize: PageSize,
} &
({
    page: number,
    cursor: Cursor
} | {
    page: 0,
    cursor: null
})

export type PagingState<Data, Cursor, PageSize extends number> = {
    page: Page<PageSize, Cursor>,
    data: Data[],
    allLoaded: boolean,
    errorCode: ErrorCode | null,
}

export type ReadPageInput<PageSize extends number, Cursor, InputDetails = undefined> = {
    page: Page<PageSize, Cursor>,
    details: InputDetails,
}

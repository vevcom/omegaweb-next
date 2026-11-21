'use client'

import React, { createContext, useState, useEffect, useCallback, useEffectEvent, useRef } from 'react'
import type { ActionReturn } from '@/services/actionTypes'
import type { ReadPageInput, Page } from '@/lib/paging/types'
import type { Context as ReactContextType } from 'react'

export type PagingState<Data, Cursor, PageSize extends number> = {
    page: Page<PageSize, Cursor>,
    data: Data[],
    allLoaded: boolean,
}

export type PagingData<Data, Cursor, PageSize extends number, FetcherDetails> = {
    state: PagingState<Data, Cursor, PageSize>,
    loadMore: () => Promise<Data[]>,
    refetch: () => Promise<Data[]>,
    setDetails: (details: FetcherDetails, withFetch?: boolean) => void,
    serverRenderedData: Data[],
    startPage: Omit<Page<PageSize, Cursor>, 'cursor'>,
    loading: boolean,
    details: FetcherDetails,
}

export type PagingContext<Data, Cursor, PageSize extends number, FetcherDetails> =
    ReactContextType<PagingData<Data, Cursor, PageSize, FetcherDetails> | null>

export type PagingProviderProps<Data, Cursor, PageSize extends number, FetcherDetails> = {
    startPage: Omit<Page<PageSize, Cursor>, 'cursor'>,
    children: React.ReactNode,
    details: FetcherDetails,
    serverRenderedData: Data[],
}

export type GeneratePagingProviderProps<Data, Cursor, PageSize extends number, FetcherDetails> = {
    fetcher: ({ paging }: { paging: ReadPageInput<PageSize, Cursor, FetcherDetails> }) => Promise<ActionReturn<Data[]>>,
    getCursor: ({ lastElement, fetchedCount }: { lastElement: Data, fetchedCount: number }) => Cursor,
}

/**
 * Generates a paging provider. Should be used in conjunction with generatePagingContext.
 *
 * Example usage:
 * ```
 * import { generatePaging } from './PagingGenerator'
 * import { readItemsPageAction } from '@/services/items/actions'
 * import type { Item, ItemCursor } from '@/services/items/types'
 *
 * export type PageSizeItems = 20
 *
 * export const [ItemPagingContext, ItemPagingProvider] = generatePaging<
 *     Item,
 *     ItemCursor,
 *     PageSizeItems
 * >({
 *     fetcher: async ({ paging }) => await readItemsPageAction(paging),
 *     getCursor: ({ lastElement }) => ({ id: lastElement.id }),
 * })
 * ```
 *
 * @param fetcher The function that fetches the data.
 * @param getCursor A function that returns the cursor after fetching data.
 * It is provided the last element fetched and the number of elements fetched.
 * In the case no data is fetched the function will not be called and the cursor will be unchanged.
 * @returns A tuple containing the paging context and a react component that provides the paging context.
 */
export function generatePaging<Data, Cursor, PageSize extends number = number, FetcherDetails = undefined>({
    fetcher,
    getCursor,
}: GeneratePagingProviderProps<Data, Cursor, PageSize, FetcherDetails>
) {
    const getCursorAfterFetch = (data: Data[]) => {
        if (!data.length) return null
        return getCursor({ lastElement: data[data.length - 1], fetchedCount: data.length })
    }

    const Context = createContext<PagingData<Data, Cursor, PageSize, FetcherDetails> | null>(null)

    function Provider({
        serverRenderedData,
        startPage,
        children,
        details: startDetails,
    }: PagingProviderProps<Data, Cursor, PageSize, FetcherDetails>) {
        const generateStartState = useCallback((): PagingState<Data, Cursor, PageSize> => {
            const cursor = getCursorAfterFetch(serverRenderedData)
            const page: Page<PageSize, Cursor> = cursor ? {
                ...startPage,
                cursor,
            } : {
                ...startPage,
                page: 0,
                cursor: null,
            }
            return {
                data: serverRenderedData,
                page,
                allLoaded: false
            }
        }, [serverRenderedData, startPage])

        const [state, setState] = useState<PagingState<Data, Cursor, PageSize>>(generateStartState())
        const [details, setDetails] = useState<FetcherDetails>(startDetails)
        const [loading, setLoading] = useState<boolean>(false)
        // Bumped on every reset, so a page asked for before it is not added to the list after it.
        const resets = useRef(0)

        const resetState = useCallback(() => {
            resets.current += 1
            setState(generateStartState())
        }, [generateStartState])

        const handleDetailsChange = useEffectEvent(resetState)

        useEffect(() => {
            handleDetailsChange()
        }, [details])

        useEffect(() => {
            setDetails(startDetails)
        }, [startDetails])

        const loadMore = useCallback(async () => {
            if (state.allLoaded) return []
            if (loading) return []
            setLoading(true)
            const resetsWhenAsked = resets.current
            const data = await fetcher({
                paging: {
                    details,
                    page: state.page,
                }
            })
            setLoading(false)
            const nextPageNumber = state.page.page + 1
            if (!data.success || resets.current !== resetsWhenAsked) {
                return []
            }
            const newData = data.data
            const newCursor = getCursorAfterFetch(newData)
            setState((prevState) => ({
                data: [...prevState.data, ...newData],
                page: newCursor ? {
                    page: nextPageNumber,
                    cursor: newCursor,
                    pageSize: prevState.page.pageSize,
                } : {
                    ...prevState.page,
                },
                allLoaded: newData.length < prevState.page.pageSize,
            }))
            return newData
        }, [details, state, loading])

        const refetch = useCallback(async () => {
            const toPage = state.page.page
            resetState()
            let data: Data[] = []
            for (let pageNumber = 1; pageNumber <= toPage; pageNumber++) {
                data = [...data, ...(await loadMore())]
            }
            return data
        }, [loadMore, state, resetState])

        return (
            <Context.Provider value={{
                state,
                loadMore,
                refetch,
                serverRenderedData,
                startPage,
                setDetails,
                loading,
                details,
            }}>
                {children}
            </Context.Provider>
        )
    }

    return [Context, Provider] as const
}

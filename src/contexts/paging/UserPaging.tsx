'use client'
import { generatePaging } from './PagingGenerator'
import {
    readArchivedUserPageAction,
    readUnarchivedUserPageAction,
    readUserPageAction,
} from '@/services/users/actions'
import type { UserDetails, UserPagingReturn, UserCursor, UserPartition } from '@/services/users/types'

export type PageSizeUsers = 50;

const readPageActions = {
    activeOmegaStudents: readUserPageAction,
    unarchived: readUnarchivedUserPageAction,
    archived: readArchivedUserPageAction,
} as const satisfies Record<UserPartition, unknown>

export const [UserPagingContext, UserPagingProvider] = generatePaging<
    UserPagingReturn,
    UserCursor,
    PageSizeUsers,
    UserDetails
>({
    fetcher: async ({ paging }) => {
        const { partition, readPage, ...details } = paging.details
        const read = readPage ?? readPageActions[partition ?? 'activeOmegaStudents']
        return await read({ params: { paging: { ...paging, details } } })
    },
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})

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
        const { partition, ...details } = paging.details
        return await readPageActions[partition ?? 'activeOmegaStudents']({ params: { paging: { ...paging, details } } })
    },
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})

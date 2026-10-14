'use client'
import { generatePaging } from './PagingGenerator'
import { readExpandedSchoolsPageAction } from '@/education/schools/actions'
import type { ExpandedSchool, SchoolCursor } from '@/services/education/schools/types'

export type PageSizeSchool = 8

export const [SchoolPagingContext, SchoolPagingProvider] = generatePaging<
    ExpandedSchool,
    SchoolCursor,
    PageSizeSchool
>({
    fetcher: async ({ paging }) => await readExpandedSchoolsPageAction({ params: { paging } }),
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})

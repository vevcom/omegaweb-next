import yearFromParam from './yearFromParam'
import { revueOperations } from '@/services/revue/operations'
import { cache } from 'react'

/**
 * The revue of a page under /revue/[year], read once per request however many of the layout and the
 * page ask. Meant to be called from a serverPage or serverLayout operation, which supplies the service
 * context. A year that is no revue throws NOT FOUND.
 */
export const getRevue = cache(async (year: string) => revueOperations.read({ params: { year: yearFromParam(year) } }))

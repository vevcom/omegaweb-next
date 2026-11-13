import { companyOperations } from '@/services/careers/companies/operations'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { cache } from 'react'

/**
 * The company of a page under /companies/[nameAndId], read once per request however many of the
 * layout and the page ask. Meant to be called from a serverPage or serverLayout operation, which
 * supplies the service context: a missing company throws NOT FOUND, which they render as the
 * not-found page.
 */
export const getCompany = cache((nameAndId: string) =>
    companyOperations.read({ params: { id: decodeVevenUriHandleError(nameAndId) } }))

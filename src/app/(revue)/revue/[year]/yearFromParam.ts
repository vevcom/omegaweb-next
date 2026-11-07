import { ServiceError } from '@/services/error'

/** The year of a url under /revue/[year]. A segment that is no year is a page that does not exist. */
export default function yearFromParam(year: string) {
    if (!/^\d{4}$/.test(year)) throw new ServiceError('NOT FOUND', 'Fant ikke revyen')
    return Number(year)
}

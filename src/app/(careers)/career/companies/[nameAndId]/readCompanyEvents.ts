import { careerPages } from '@/app/(careers)/config'
import { eventHomePages } from '@/pageKits/events/homePages'
import { eventOperations } from '@/services/events/operations'
import { EventKind } from '@/prisma-generated-pn-types'
import type { PageSizeEventArchive } from '@/contexts/paging/EventArchivePaging'
import type { EventArchiveDetails } from '@/services/events/types'

export const earlierEventsPageSize: PageSizeEventArchive = 12

const isCareerKind = (kind: EventKind) => eventHomePages[kind].site === careerPages.site

/**
 * The company's events of each kind it has any of, the kinds at home on the career site first: the
 * coming ones, and the first page of the earlier ones with the details that read the next.
 */
export async function readCompanyEvents(companyId: number) {
    const kinds = Object.values(EventKind)
    const ordered = [...kinds.filter(isCareerKind), ...kinds.filter(kind => !isCareerKind(kind))]
    const earlierDetailsOf = (kind: EventKind): EventArchiveDetails => ({ tags: null, kinds: [kind], companyId })
    const [coming, earlierOfKinds] = await Promise.all([
        eventOperations.readManyCurrent({ params: { tags: null, companyId } }),
        Promise.all(ordered.map(kind => eventOperations.readManyArchivedPage({
            params: {
                paging: {
                    page: { page: 0, pageSize: earlierEventsPageSize, cursor: null },
                    details: earlierDetailsOf(kind),
                },
            },
        }))),
    ])
    return ordered.map((kind, index) => ({
        kind,
        coming: coming.filter(event => event.kind === kind),
        earlier: earlierOfKinds[index],
        earlierDetails: earlierDetailsOf(kind),
    })).filter(ofKind => ofKind.coming.length > 0 || ofKind.earlier.length > 0)
}

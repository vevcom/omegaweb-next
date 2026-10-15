import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma, ScreenPageType } from '@/prisma-generated-pn-types'

export const screenPageIncluder = {
    cmsImage: {
        include: {
            image: { include: expandedImageIncluder },
        },
    },
    cmsParagraph: true,
    // Event tags are public. The job ad and the event are read through their own services by
    // whoever shows the page, so their access rules apply.
    eventTag: true,
} as const satisfies Prisma.ScreenPageInclude

export const screenPageTypeLabels = {
    IMAGE: 'Bilde',
    TEXT_AND_IMAGE: 'Tekst og bilde',
    JOBAD: 'Stillingsannonse',
    EVENT: 'Arrangement',
    EVENT_TAG: 'Kommende arrangementer med tagg',
} as const satisfies Record<ScreenPageType, string>

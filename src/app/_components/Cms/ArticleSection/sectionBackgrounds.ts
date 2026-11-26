import { cardClassNames } from '@/components/UI/Card'
import type { SectionBackground } from '@/prisma-generated-pn-types'

/** The surfaces a section can be laid on, with the class that draws each. */
export const sectionBackgrounds: Record<SectionBackground, { label: string, className: string }> = {
    NONE: { label: 'Ingen bakgrunn', className: '' },
    BASE_100: { label: 'Lys flate', className: cardClassNames.base100 },
    BASE_200: { label: 'Mellomlys flate', className: cardClassNames.base200 },
    BASE_300: { label: 'Mørk flate', className: cardClassNames.base300 },
}

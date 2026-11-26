import type { SectionBackground } from '@/prisma-generated-pn-types'

/** The surfaces a section can be laid on, with the class that draws each. */
export const sectionBackgrounds: Record<SectionBackground, { label: string, className: string }> = {
    NONE: { label: 'Ingen bakgrunn', className: '' },
    BASE_100: { label: 'Lys flate', className: 'bg-base-100 rounded-round p-(--card-padding)' },
    BASE_200: { label: 'Mellomlys flate', className: 'bg-base-200 rounded-round p-(--card-padding)' },
    BASE_300: { label: 'Mørk flate', className: 'bg-base-300 rounded-round p-(--card-padding)' },
}

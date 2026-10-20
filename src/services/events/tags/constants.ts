import type { SpecialEventTags } from '@/prisma-generated-pn-types'

export const specialEventTags = {
    COMPANY_PRESENTATION: {
        name: 'Bedpress',
        description: 'Bedriftspresentasjon',
        colorR: 255,
        colorG: 0,
        colorB: 0
    }
} satisfies Record<SpecialEventTags, {
    name: string;
    description: string;
    colorR: number;
    colorG: number;
    colorB: number;
}>

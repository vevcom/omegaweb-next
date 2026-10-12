import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { Prisma } from '@/prisma-generated-pn-types'

export const logoIncluder = {
    logo: {
        include: {
            image: { include: expandedImageIncluder }
        }
    }
} as const satisfies Prisma.CompanyInclude

export const companySponsorTierDetails = {
    MAIN: {
        label: 'Hovedsamarbeidspartner',
        description: 'Ligger øverst i alle lister. Kun én bedrift kan ha denne plassen.',
    },
    SPONSOR: {
        label: 'Samarbeidspartner',
        description: 'Ligger over vanlige bedrifter, i vilkårlig rekkefølge seg imellom.',
    },
    NONE: {
        label: 'Vanlig bedrift',
        description: 'Ingen prioritering i listene.',
    },
} satisfies Record<CompanySponsorTier, { label: string, description: string }>

export const companySponsorTierOptions = Object.values(CompanySponsorTier).map(
    (tier): { value: CompanySponsorTier, label: string, key: string } => ({
        value: tier,
        label: companySponsorTierDetails[tier].label,
        key: tier,
    })
)

export const companySponsorOrdering = [
    { sponsorTier: 'asc' },
    { id: 'asc' },
] as const satisfies Prisma.CompanyOrderByWithRelationInput[]

export const sponsorSelection = {
    id: true,
    name: true,
    website: true,
    sponsorTier: true,
    logo: {
        include: {
            image: { include: expandedImageIncluder }
        }
    },
} as const satisfies Prisma.CompanySelect

export const companySponsorTierLockKey = 581_000_001

import type { Prisma } from '@/prisma-generated-pn-types'

/** What is read of a company user: everything but what only signing in needs. */
export const companyUserSelection = {
    id: true,
    companyId: true,
    email: true,
    firstname: true,
    lastname: true,
    admin: true,
    active: true,
    emailVerified: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.CompanyUserSelect

export const companyUserWithCompanySelection = {
    ...companyUserSelection,
    company: { select: { id: true, name: true } },
    // Only whether there is a password, never the hash.
    credentials: { select: { credentialsUpdatedAt: true } },
} as const satisfies Prisma.CompanyUserSelect

// Admins first, then by name.
export const companyUserOrdering = [
    { admin: 'desc' },
    { firstname: 'asc' },
    { lastname: 'asc' },
    { id: 'asc' },
] as const satisfies Prisma.CompanyUserOrderByWithRelationInput[]

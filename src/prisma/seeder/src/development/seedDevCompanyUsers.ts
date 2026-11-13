import { devCompanyName } from './seedDevCompanies'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/** The company the development company users act for. */
const DEV_COMPANY_INDEX = 0

/**
 * The company users of development, both with the password `password`, as the development users
 * have. They sign in at /career/company-login with their email.
 */
export const devCompanyUsers = [
    { email: 'bedrift-admin@example.com', firstname: 'Berit', lastname: 'Bedriftsadmin', admin: true },
    { email: 'bedrift@example.com', firstname: 'Bjarne', lastname: 'Bedriftsbruker', admin: false },
] as const

/**
 * Gives one of the development companies an admin and an ordinary user, so the company pages and
 * the company login can be tried without registering anyone and following a mail first. An
 * existing company user is left as it is.
 */
export const seedDevCompanyUsers = defineSeedOperation(async (prisma: PrismaClient) => {
    const company = await prisma.company.findUniqueOrThrow({
        where: { name: devCompanyName(DEV_COMPANY_INDEX) },
        select: { id: true },
    })
    const passwordHash = await hashAndEncryptPassword('password')

    await Promise.all(devCompanyUsers.map(companyUser => upsert({
        checkExistence: () => prisma.companyUser.findUnique({
            where: { email: companyUser.email },
            select: { id: true },
        }),
        create: () => prisma.companyUser.create({
            data: {
                ...companyUser,
                companyId: company.id,
                emailVerified: new Date(),
                credentials: { create: { passwordHash } },
            },
        }),
        update: () => {},
    })))
})

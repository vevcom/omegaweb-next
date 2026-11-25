import { seedDevCompanies } from '@/prisma/seeder/src/development/seedDevCompanies'
import { devCompanyUsers, seedDevCompanyUsers } from '@/prisma/seeder/src/development/seedDevCompanyUsers'
import { companyUserIdOfCredentials } from '@/services/careers/companies/users/auth/credentials'
import { prisma } from '@/prisma-pn-client-instance'
import { beforeAll, describe, expect, test } from '@jest/globals'

describe('seedDevCompanyUsers', () => {
    beforeAll(async () => {
        await seedDevCompanies()
        // Twice, since a re-seed must leave the company users as they were.
        await seedDevCompanyUsers()
        await seedDevCompanyUsers()
    }, 120 * 1000)

    test('one development company gets an admin and an ordinary user, once', async () => {
        const companyUsers = await prisma.companyUser.findMany({
            where: { email: { in: devCompanyUsers.map(companyUser => companyUser.email) } },
            select: { email: true, admin: true, company: { select: { name: true } } },
            orderBy: { admin: 'desc' },
        })
        expect(companyUsers).toEqual([
            { email: 'bedrift-admin@example.com', admin: true, company: { name: 'dev_companies_0' } },
            { email: 'bedrift@example.com', admin: false, company: { name: 'dev_companies_0' } },
        ])
    })

    test('they sign in with the password of the development users', async () => {
        for (const { email } of devCompanyUsers) {
            expect(await companyUserIdOfCredentials(email, 'password')).not.toBeNull()
        }
    })
})

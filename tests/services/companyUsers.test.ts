import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { companyUserOperations } from '@/services/careers/companies/users/operations'
import { recordSentMail, waitUntil } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'

const companyAdmin = Session.fromJsObject({ user: null, permissions: ['COMPANY_ADMIN'], memberships: [] })

let companyId: number
let otherCompanyId: number
let sentMail: ReturnType<typeof recordSentMail>

async function register(email: string, admin = false) {
    return await companyUserOperations.create({
        params: { companyId },
        data: { email, firstname: 'Kari', lastname: 'Nordmann', admin },
        session: companyAdmin,
    })
}

beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: 'Brukertest AS', description: '' } })
    const otherCompany = await prisma.company.create({ data: { name: 'Brukertest To AS', description: '' } })
    companyId = company.id
    otherCompanyId = otherCompany.id
    sentMail = recordSentMail()
})

describe('company users', () => {
    test('registering a company user is not open to just anyone', async () => {
        await expect(companyUserOperations.create({
            params: { companyId },
            data: { email: 'stengt@example.com', firstname: 'Kari', lastname: 'Nordmann', admin: false },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect(await prisma.companyUser.count({ where: { email: 'stengt@example.com' } })).toBe(0)
    })

    test('a registered company user is active, has no password and an email stored in lower case', async () => {
        const companyUser = await register('Kari.Nordmann@Example.com')
        expect(companyUser).toMatchObject({
            companyId,
            email: 'kari.nordmann@example.com',
            admin: false,
            active: true,
            emailVerified: null,
        })

        const read = await companyUserOperations.read({ params: { id: companyUser.id }, session: companyAdmin })
        expect(read.credentials).toBeNull()
        expect(read.company.name).toBe('Brukertest AS')
    })

    test('a registered company user is mailed the link to choose a password by', async () => {
        await register('ny-lenke@example.com')

        // The mail is sent without being awaited.
        const mailsToThem = () => sentMail.mock.calls.filter(([mail]) => mail.to === 'ny-lenke@example.com')
        await waitUntil(() => mailsToThem().length > 0)
        expect(mailsToThem()[0][0].subject).toBe('Velg passord hos Contactor')
    })

    test('an email belongs to one company user, across companies', async () => {
        await register('delt@example.com')
        await expect(companyUserOperations.create({
            params: { companyId: otherCompanyId },
            data: { email: 'delt@example.com', firstname: 'Ola', lastname: 'Nordmann', admin: false },
            session: companyAdmin,
        })).rejects.toThrow(new Smorekopp('DUPLICATE'))
    })

    test('the users of a company are listed with the admins first, and not those of other companies', async () => {
        await register('admin@example.com', true)
        await companyUserOperations.create({
            params: { companyId: otherCompanyId },
            data: { email: 'annen@example.com', firstname: 'Ola', lastname: 'Nordmann', admin: false },
            session: companyAdmin,
        })

        const companyUsers = await companyUserOperations.readOfCompany({ params: { companyId }, session: companyAdmin })
        expect(companyUsers[0].email).toBe('admin@example.com')
        expect(companyUsers.map(companyUser => companyUser.email)).not.toContain('annen@example.com')
    })

    test('changing the role ends the sessions that carry the old one', async () => {
        const companyUser = await register('rolle@example.com')
        const updated = await companyUserOperations.updateRole({
            params: { id: companyUser.id },
            data: { admin: true, active: false },
            session: companyAdmin,
        })
        expect(updated).toMatchObject({ admin: true, active: false })

        const stored = await prisma.companyUser.findUniqueOrThrow({ where: { id: companyUser.id } })
        expect(stored.sessionEpoch).toBe(1)
    })

    test('deleting a company removes its users', async () => {
        const company = await prisma.company.create({ data: { name: 'Brukertest Slett AS', description: '' } })
        await companyUserOperations.create({
            params: { companyId: company.id },
            data: { email: 'slettes@example.com', firstname: 'Per', lastname: 'Nordmann', admin: false },
            session: companyAdmin,
        })

        await prisma.company.delete({ where: { id: company.id } })
        expect(await prisma.companyUser.count({ where: { email: 'slettes@example.com' } })).toBe(0)
    })
})

import { Session } from '@/auth/session/Session'
import { Require } from '@/auth/authorizer/Require'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import {
    companySessionStillStands,
    companySessionTokenOf,
    refreshedCompanySessionToken,
} from '@/auth/nextAuth/sessionToken'
import { companyOperations } from '@/services/careers/companies/operations'
import { companyUserOperations } from '@/services/careers/companies/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession, SessionMaybeUser } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'
import type { MembershipFiltered } from '@/services/groups/types'
import type { CompanyUserOfSession } from '@/services/careers/companies/users/types'

let companyId: number
let otherCompanyId: number
let adminId: number
let colleagueId: number
let outsiderId: number

const sessionOfCompanyUser = async (companyUserId: number): Promise<AnySession> =>
    Session.fromToken(await companySessionTokenOf(companyUserId))

async function createCompanyUser(ofCompanyId: number, email: string, admin: boolean) {
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId: ofCompanyId,
            email,
            firstname: 'Kari',
            lastname: 'Nordmann',
            admin,
            credentials: { create: { passwordHash: 'not a hash anyone can match' } },
        },
    })
    return companyUser.id
}

beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: 'Sesjonstest AS', description: '' } })
    const otherCompany = await prisma.company.create({ data: { name: 'Sesjonstest To AS', description: '' } })
    companyId = company.id
    otherCompanyId = otherCompany.id
    adminId = await createCompanyUser(companyId, 'sesjon-admin@example.com', true)
    colleagueId = await createCompanyUser(companyId, 'sesjon-kollega@example.com', false)
    outsiderId = await createCompanyUser(otherCompanyId, 'sesjon-annen@example.com', true)
})

describe('the kinds of session', () => {
    const companyUser: CompanyUserOfSession = {
        id: 1,
        email: 'kari@example.com',
        firstname: 'Kari',
        lastname: 'Nordmann',
        admin: false,
        company: { id: 1, name: 'Sesjonstest AS' },
    }
    const user = { id: 1 } as UserFiltered
    const memberships: MembershipFiltered[] = [{ groupId: 1, order: 1, active: true, admin: false }]

    test('the type of a session refuses two owners, and memberships without a user', () => {
        const sessions: SessionMaybeUser[] = [
            { user, permissions: [], memberships },
            { user: null, companyUser, permissions: [], memberships: [] },
            { user: null, permissions: [], memberships: [] },
            // @ts-expect-error A session belongs to a user or to a company user, never to both.
            { user, companyUser, permissions: [], memberships },
            // @ts-expect-error A company user is a member of nothing.
            { user: null, companyUser, permissions: [], memberships },
            // @ts-expect-error Neither is a visitor.
            { user: null, permissions: [], memberships },
        ]
        expect(sessions).toHaveLength(6)
    })

    test('a token naming both owners gives the session of the user alone', () => {
        const session = Session.fromToken({ user, companyUser, permissions: [], memberships })
        expect(session.user).toBe(user)
        expect(session.companyUser).toBeNull()
    })

    test('a company session has no user and no memberships, whatever the token says', () => {
        const session = Session.fromToken({ user: null, companyUser, permissions: [], memberships })
        expect(session.user).toBeNull()
        expect(session.companyUser).toEqual(companyUser)
        expect(session.memberships).toEqual([])
    })

    test('a session of no one has no memberships either', () => {
        const session = Session.fromToken({ user: null, companyUser: null, permissions: [], memberships })
        expect(session.memberships).toEqual([])
    })
})

describe('the token of a company session', () => {
    test('it carries the company user and their company, and the permissions of a visitor', async () => {
        const token = await companySessionTokenOf(adminId)
        const defaultPermissions = await prisma.defaultPermission.findMany()

        expect(token.provider).toBe('company-credentials')
        expect(token.user).toBeNull()
        expect(token.companyUser).toMatchObject({ id: adminId, admin: true, company: { id: companyId } })
        expect(token.memberships).toEqual([])
        expect([...token.permissions].sort()).toEqual(defaultPermissions.map(({ permission }) => permission).sort())
    })

    test('it stands until the company user is deactivated or ends their sessions', async () => {
        const companyUserId = await createCompanyUser(companyId, 'sesjon-slutt@example.com', false)
        const token = await companySessionTokenOf(companyUserId)
        expect(await companySessionStillStands(token)).toBe(true)

        await prisma.companyUser.update({ where: { id: companyUserId }, data: { active: false } })
        expect(await companySessionStillStands(token)).toBe(false)

        await prisma.companyUser.update({
            where: { id: companyUserId },
            data: { active: true, sessionEpoch: { increment: 1 } },
        })
        expect(await companySessionStillStands(token)).toBe(false)
        expect(await companySessionStillStands(await companySessionTokenOf(companyUserId))).toBe(true)
    })

    test('it does not stand for a company user without a password, or one who is gone', async () => {
        const companyUser = await prisma.companyUser.create({
            data: { companyId, email: 'sesjon-uten@example.com', firstname: 'Ola', lastname: 'Nordmann' },
        })
        const token = await companySessionTokenOf(companyUser.id)
        expect(await companySessionStillStands(token)).toBe(false)

        await prisma.companyUser.delete({ where: { id: companyUser.id } })
        expect(await companySessionStillStands(token)).toBe(false)
    })

    test('it is read again when the company user has changed since it was issued', async () => {
        const companyUserId = await createCompanyUser(companyId, 'sesjon-endret@example.com', false)
        const token = await companySessionTokenOf(companyUserId)
        const issuedNow = { ...token, iat: Math.floor(Date.now() / 1000) + 60 }
        expect(await refreshedCompanySessionToken(issuedNow)).toBe(issuedNow)

        await prisma.companyUser.update({ where: { id: companyUserId }, data: { firstname: 'Kristin' } })
        const issuedBefore = { ...token, iat: Math.floor(Date.now() / 1000) - 60 }
        const refreshed = await refreshedCompanySessionToken(issuedBefore)
        expect(refreshed.companyUser?.firstname).toBe('Kristin')
        expect(refreshed.sessionEpoch).toBe(token.sessionEpoch)
    })
})

describe('Require and company users', () => {
    test('the company conditions pass for the company user they name and no one else', async () => {
        const admin = (await sessionOfCompanyUser(adminId)).toJsObject()
        const colleague = (await sessionOfCompanyUser(colleagueId)).toJsObject()
        const outsider = (await sessionOfCompanyUser(outsiderId)).toJsObject()
        const visitor = Session.empty().toJsObject()

        const anyCompanyUser = Require.companyUser()
        const member = Require.companyMember().data({ companyId })
        const companyAdmin = Require.companyAdmin().data({ companyId })
        const self = Require.companyUserId().data({ companyUserId: colleagueId })

        expect([admin, colleague, outsider, visitor].map(session => anyCompanyUser.auth(session).authorized))
            .toEqual([true, true, true, false])
        expect([admin, colleague, outsider, visitor].map(session => member.auth(session).authorized))
            .toEqual([true, true, false, false])
        expect([admin, colleague, outsider, visitor].map(session => companyAdmin.auth(session).authorized))
            .toEqual([true, false, false, false])
        expect([admin, colleague, outsider, visitor].map(session => self.auth(session).authorized))
            .toEqual([false, true, false, false])
    })

    test('a company user is not a user, and is turned away as signed in', async () => {
        const session = (await sessionOfCompanyUser(adminId)).toJsObject()
        const result = Require.user().auth(session)
        expect(result.authorized).toBe(false)
        expect(result.status).toBe('UNAUTHORIZED')
        expect(Require.user().auth(Session.empty().toJsObject()).status).toBe('UNAUTHENTICATED')
    })
})

describe('what a company user may do', () => {
    test('an admin of the company registers and changes its users, a colleague does not', async () => {
        const admin = await sessionOfCompanyUser(adminId)
        const colleague = await sessionOfCompanyUser(colleagueId)
        const data = { email: 'sesjon-ny@example.com', firstname: 'Per', lastname: 'Nordmann', admin: false }

        await expect(companyUserOperations.create({ params: { companyId }, data, session: colleague }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        const created = await companyUserOperations.create({ params: { companyId }, data, session: admin })

        await expect(companyUserOperations.updateRole({
            params: { id: created.id },
            data: { admin: true, active: true },
            session: colleague,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(companyUserOperations.updateRole({
            params: { id: created.id },
            data: { admin: true, active: true },
            session: admin,
        })).resolves.toMatchObject({ admin: true })
    })

    test('a company user changes their own name, but not their role and not a colleague', async () => {
        const colleague = await sessionOfCompanyUser(colleagueId)

        await expect(companyUserOperations.update({
            params: { id: colleagueId },
            data: { firstname: 'Kari', lastname: 'Hansen' },
            session: colleague,
        })).resolves.toMatchObject({ lastname: 'Hansen' })
        await expect(companyUserOperations.updateRole({
            params: { id: colleagueId },
            data: { admin: true, active: true },
            session: colleague,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(companyUserOperations.update({
            params: { id: adminId },
            data: { firstname: 'Kari', lastname: 'Hansen' },
            session: colleague,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('colleagues see each other, and an admin of another company sees and changes nothing', async () => {
        const colleague = await sessionOfCompanyUser(colleagueId)
        const outsider = await sessionOfCompanyUser(outsiderId)

        const companyUsers = await companyUserOperations.readOfCompany({ params: { companyId }, session: colleague })
        expect(companyUsers.map(companyUser => companyUser.id)).toEqual(expect.arrayContaining([adminId, colleagueId]))

        await expect(companyUserOperations.readOfCompany({ params: { companyId }, session: outsider }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(companyUserOperations.read({ params: { id: colleagueId }, session: outsider }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(companyUserOperations.destroy({ params: { id: colleagueId }, session: outsider }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('an admin of the company changes its details, but not its sponsor tier', async () => {
        const admin = await sessionOfCompanyUser(adminId)
        const outsider = await sessionOfCompanyUser(outsiderId)

        await companyOperations.update({
            params: { id: companyId },
            data: { description: 'Skrevet av bedriften selv' },
            session: admin,
        })
        const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
        expect(company.description).toBe('Skrevet av bedriften selv')

        await expect(companyOperations.update({
            params: { id: companyId },
            data: { description: 'Skrevet av en annen bedrift' },
            session: outsider,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(companyOperations.updateSponsorTier({
            params: { id: companyId },
            data: { sponsorTier: 'MAIN' },
            session: admin,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })
})

import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { decryptAndComparePassword } from '@/auth/passwordHash'
import { generateResetPasswordJWT } from '@/services/auth/account/tokens'
import { authOperations } from '@/services/auth/operations'
import { companySessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { companyUserAccountOperations } from '@/services/careers/companies/users/account/operations'
import { recordSentMail } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'

const companyAdmin = Session.fromJsObject({ user: null, permissions: ['COMPANY_ADMIN'], memberships: [] })
const PASSWORD = 'et-langt-nok-passord-123'

let companyId: number

async function createCompanyUser(email: string) {
    return prisma.companyUser.create({
        data: { companyId, email, firstname: 'Kari', lastname: 'Nordmann' },
    })
}

const passwordToken = (companyUserId: number, email: string, expiresIn = 60 * 60) =>
    generateResetPasswordJWT('companyresetpassword', companyUserId, email, expiresIn)

const choosePassword = (token: string, password = PASSWORD) => companyUserAccountOperations.choosePassword({
    params: { token },
    data: { password, confirmPassword: password },
})

beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: 'Kontotest AS', description: '' } })
    companyId = company.id
})

describe('the password link of a company user', () => {
    test('it is mailed to the company user', async () => {
        const companyUser = await createCompanyUser('konto-lenke@example.com')
        const sentMail = recordSentMail()

        await companyUserAccountOperations.sendPasswordLink({ params: { id: companyUser.id }, session: companyAdmin })

        expect(sentMail).toHaveBeenCalledTimes(1)
        const [[mail]] = sentMail.mock.calls
        expect(mail.to).toBe('konto-lenke@example.com')
        expect(mail.subject).toBe('Velg passord hos Contactor')
    })

    test('sending it is for those who may manage the company user, and the company user themself', async () => {
        const companyUser = await createCompanyUser('konto-hvem@example.com')
        const other = await createCompanyUser('konto-kollega@example.com')
        const sentMail = recordSentMail()
        const sessionOf = async (id: number) => {
            await prisma.companyUser.update({
                where: { id },
                data: { credentials: { create: { passwordHash: 'not a hash anyone can match' } } },
            })
            return Session.fromToken(await companySessionTokenOf(id))
        }

        await expect(companyUserAccountOperations.sendPasswordLink({
            params: { id: companyUser.id },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        await expect(companyUserAccountOperations.sendPasswordLink({
            params: { id: companyUser.id },
            session: await sessionOf(other.id),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        expect(sentMail).not.toHaveBeenCalled()

        await companyUserAccountOperations.sendPasswordLink({
            params: { id: companyUser.id },
            session: await sessionOf(companyUser.id),
        })
        expect(sentMail).toHaveBeenCalledTimes(1)
    })

    test('it is not sent to a deactivated company user', async () => {
        const companyUser = await createCompanyUser('konto-deaktivert@example.com')
        await prisma.companyUser.update({ where: { id: companyUser.id }, data: { active: false } })

        await expect(companyUserAccountOperations.sendPasswordLink({
            params: { id: companyUser.id },
            session: companyAdmin,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('asked for by email, it answers the same whether the email is a company user or not', async () => {
        await createCompanyUser('konto-glemt@example.com')
        const sentMail = recordSentMail()

        const known = await companyUserAccountOperations.sendResetPasswordEmail({
            params: { site: 'CAREERS' },
            data: { email: 'Konto-Glemt@example.com' },
        })
        const unknown = await companyUserAccountOperations.sendResetPasswordEmail({
            params: { site: 'CAREERS' },
            data: { email: 'konto-ingen@example.com' },
        })
        expect(known).toBe('konto-glemt@example.com')
        expect(unknown).toBe('konto-ingen@example.com')

        // The mail is sent without being awaited.
        await new Promise(resolve => setTimeout(resolve, 500))
        expect(sentMail.mock.calls.map(([mail]) => mail.to)).toEqual(['konto-glemt@example.com'])
    })
})

describe('choosing a password as a company user', () => {
    test('the first password is set, the email is verified and earlier sessions end', async () => {
        const companyUser = await createCompanyUser('konto-forste@example.com')

        await choosePassword(passwordToken(companyUser.id, companyUser.email))

        const stored = await prisma.companyUser.findUniqueOrThrow({
            where: { id: companyUser.id },
            include: { credentials: true },
        })
        expect(stored.credentials).not.toBeNull()
        expect(await decryptAndComparePassword(PASSWORD, stored.credentials?.passwordHash ?? '')).toBe(true)
        expect(stored.emailVerified).not.toBeNull()
        expect(stored.sessionEpoch).toBe(companyUser.sessionEpoch + 1)
    })

    test('the link is spent by the password it sets', async () => {
        const companyUser = await createCompanyUser('konto-brukt@example.com')
        const token = passwordToken(companyUser.id, companyUser.email)

        await choosePassword(token)
        // The password is newer than the link from the next second on.
        await new Promise(resolve => setTimeout(resolve, 1100))
        await expect(choosePassword(token, 'et-annet-langt-passord-456'))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
    })

    test('a link for an email the company user has since left does not verify the new one', async () => {
        const companyUser = await createCompanyUser('konto-byttet@example.com')

        await choosePassword(passwordToken(companyUser.id, 'konto-gammel@example.com'))

        const stored = await prisma.companyUser.findUniqueOrThrow({ where: { id: companyUser.id } })
        expect(stored.emailVerified).toBeNull()
    })

    test('an expired link, and one for a deactivated company user, are refused', async () => {
        const companyUser = await createCompanyUser('konto-utlopt@example.com')
        await expect(choosePassword(passwordToken(companyUser.id, companyUser.email, -60)))
            .rejects.toThrow(new Smorekopp('JWT EXPIRED'))

        await prisma.companyUser.update({ where: { id: companyUser.id }, data: { active: false } })
        await expect(choosePassword(passwordToken(companyUser.id, companyUser.email)))
            .rejects.toThrow(new Smorekopp('NOT FOUND'))
    })

    test('a password is held to what a user\'s is', async () => {
        const companyUser = await createCompanyUser('konto-kort@example.com')
        await expect(choosePassword(passwordToken(companyUser.id, companyUser.email), 'kort'))
            .rejects.toThrow(new Smorekopp('BAD DATA'))
    })

    test('a link of a company user does nothing to the user with the same id, and the other way round', async () => {
        const companyUser = await createCompanyUser('konto-kryss@example.com')
        // A company user's token, naming the id of a user.
        await expect(authOperations.resetPassword({
            params: { token: passwordToken(1, 'en-bruker@example.com') },
            data: { password: PASSWORD, confirmPassword: PASSWORD },
        })).rejects.toThrow(new Smorekopp('JWT INVALID'))
        // A user's token, naming the id of a company user.
        await expect(choosePassword(generateResetPasswordJWT('resetpassword', companyUser.id, companyUser.email, 60 * 60)))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
    })
})

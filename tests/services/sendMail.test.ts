import { prisma } from '@/prisma-pn-client-instance'
import { Smorekopp } from '@/services/error'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { userOperations } from '@/services/users/operations'
import { recordSentMail } from 'tests/utils'
import { beforeEach, describe, expect, test } from '@jest/globals'
import type { jest } from '@jest/globals'
import type Mail from 'nodemailer/lib/mailer'

const from = 'styret@omega.ntnu.no'

let sendBulkMail: jest.Mock<(mails: Mail.Options[]) => Promise<void>>

beforeEach(() => {
    recordSentMail()
    sendBulkMail = global.mailHandler.sendBulkMail as unknown as typeof sendBulkMail
})

let userCounter = 0
async function createUser(firstname: string) {
    const username = `sendmail-${++userCounter}`
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname,
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

/** A mailing list reaching one user directly, one through a group and one external address. */
async function createMailingList() {
    const direct = await createUser('Direkte')
    const member = await createUser('Medlem')
    const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: `sendmail-${userCounter}`, shortName: `sendmail-${userCounter}` } },
        },
    })
    await prisma.membership.create({ data: { groupId: group.id, userId: member.id, order, admin: false, active: true } })
    const external = `ekstern-${userCounter}@example.com`
    const list = await prisma.mailingList.create({
        data: {
            name: `sendmail-liste-${userCounter}`,
            users: { create: { userId: direct.id } },
            groups: { create: { groupId: group.id } },
            mailAddressExternal: { create: { mailAddressExternal: { create: { address: external } } } },
        },
    })
    return { list, direct, member, external }
}

const sentMails = () => sendBulkMail.mock.calls.flatMap(([mails]) => mails)

describe('sending mail', () => {
    test('each recipient of the addresses and lists gets one mail of their own', async () => {
        const { list, direct, member, external } = await createMailingList()
        const typed = await createUser('Skrevet')

        await sendMailOperations.sendMail({
            data: {
                from,
                // The direct member is typed as well, and must still only get one mail.
                recipients: `${typed.email}, ${direct.email.toUpperCase()}\nannen@example.com`,
                mailingListIds: [list.id],
                subject: 'Hei %n',
                text: 'Hei %N (%u)',
            },
            bypassAuth: true,
        })

        const mails = sentMails()
        expect(mails.map(mail => (mail.to as string).toLowerCase()).sort()).toEqual([
            typed.email, direct.email, member.email, external, 'annen@example.com',
        ].sort())
        expect(mails.find(mail => mail.to === member.email)).toMatchObject({
            from,
            subject: 'Hei Medlem',
            text: `Hei Medlem Testesen (${member.username})`,
        })
        expect(mails.find(mail => mail.to === external)).toMatchObject({ subject: 'Hei ', text: 'Hei  ()' })
    })

    test('a mail that reaches nobody is refused', async () => {
        await expect(sendMailOperations.sendMail({
            data: { from, recipients: '', mailingListIds: [], subject: 'Hei', text: 'Hei' },
            bypassAuth: true,
        })).rejects.toThrow(Smorekopp)
        expect(sendBulkMail).not.toHaveBeenCalled()
    })

    test('an invalid typed address is refused', async () => {
        await expect(sendMailOperations.sendMail({
            data: { from, recipients: 'ikke-en-adresse', mailingListIds: [], subject: 'Hei', text: 'Hei' },
            bypassAuth: true,
        })).rejects.toThrow()
        expect(sendBulkMail).not.toHaveBeenCalled()
    })
})

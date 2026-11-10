import { sendMailOperations } from '@/services/mail/send/operations'
import { recordSentMail } from 'tests/utils'
import { beforeEach, describe, expect, test } from '@jest/globals'
import type { jest } from '@jest/globals'
import type Mail from 'nodemailer/lib/mailer'

let sendSingleMail: ReturnType<typeof recordSentMail>
let sendBulkMail: jest.Mock<(mails: Mail.Options[]) => Promise<void>>

beforeEach(() => {
    sendSingleMail = recordSentMail()
    sendBulkMail = global.mailHandler.sendBulkMail as unknown as typeof sendBulkMail
})

describe('sending mail', () => {
    test('a system mail goes to one address from the address no one answers', async () => {
        await sendMailOperations.sendSystemMail.internalCall({
            data: { to: 'noen@example.com', subject: 'Glemt passord', body: '<p>Hei</p>' },
        })

        expect(sendSingleMail).toHaveBeenCalledTimes(1)
        expect(sendSingleMail.mock.calls[0][0]).toEqual({
            to: 'noen@example.com',
            subject: 'Glemt passord',
            from: 'noreply@omega.ntnu.no',
            html: '<p>Hei</p>',
        })
    })

    test('a system mail to something that is no address is refused', async () => {
        await expect(sendMailOperations.sendSystemMail.internalCall({
            data: { to: 'ikke-en-adresse', subject: 'Glemt passord', body: '<p>Hei</p>' },
        })).rejects.toThrow()
        expect(sendSingleMail).not.toHaveBeenCalled()
    })

    test('bulk mails are handed on as they are', async () => {
        const mails = [
            { from: 'styret@omega.ntnu.no', to: 'en@example.com', subject: 'Hei', html: '<p>Hei</p>' },
            { from: 'styret@omega.ntnu.no', to: 'to@example.com', subject: 'Hei', html: '<p>Hei</p>' },
        ]
        await sendMailOperations.sendBulkMail.internalCall({ data: mails })
        expect(sendBulkMail.mock.calls).toEqual([[mails]])
    })
})

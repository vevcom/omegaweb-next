import '@pn-server-only'
import logger from '@/lib/logger'
import { TRANSPORT_OPTIONS } from '@/services/mail/send/constants'
import nodemailer from 'nodemailer'
import type { SMTPPoolSentMessageInfo, TestAccount, Transporter as MailTransporter } from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
// A configured server is used in every environment. Without one, development sends through Ethereal.
const hasConfiguredServer = Boolean(process.env.EMAIL_SERVER)

type Transporter = MailTransporter<SMTPPoolSentMessageInfo>

class MailHandler {
    transporter: Transporter | null = null
    resolveSetup: (value?: unknown) => void = () => {}
    waitForSetup = new Promise((resolve) => { this.resolveSetup = resolve })
    testAccount: TestAccount | null = null

    queue: Mail.Options[] = []

    constructor() {
        void this.setup()
    }

    async getTransporter(): Promise<Transporter> {
        if (this.transporter) {
            return this.transporter
        }

        await this.waitForSetup
        if (!this.transporter) {
            throw new Error('Transporter is not set after setup, this should never happen.')
        }

        return this.transporter
    }

    async setup() {
        await this.setupTransporter()

        const transporter = await this.getTransporter()

        transporter.on('idle', () => void this.handleNewMail())
    }

    async setupTransporter() {
        if (isProd || hasConfiguredServer) {
            this.transporter = nodemailer.createTransport(TRANSPORT_OPTIONS)
            this.resolveSetup()
            logger.debug(`Email setup against ${process.env.EMAIL_SERVER}.`)
            return
        }

        this.testAccount = await nodemailer.createTestAccount()

        this.transporter = nodemailer.createTransport({
            pool: true,
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: this.testAccount.user, // generated ethereal user
                pass: this.testAccount.pass // generated ethereal password
            }
        })

        this.resolveSetup()
        logger.debug('Email setup for development.', { testAccount: this.testAccount })
    }

    async getTestAccount(): Promise<TestAccount> {
        if (isProd) {
            throw new Error('TestAccount should only be used in development')
        }

        if (this.testAccount) {
            return this.testAccount
        }

        await this.waitForSetup

        if (!this.testAccount) {
            throw new Error('Test account is not set after setup, this should never happen.')
        }

        return this.testAccount
    }

    async handleNewMail() {
        if (isTest) return

        const transporter = await this.getTransporter()

        const responsePromises = []

        while (transporter.isIdle() && this.queue.length) {
            const nextMail = this.queue.shift()
            if (nextMail) {
                responsePromises.push(transporter.sendMail(nextMail))
            }
        }

        const responses = await Promise.all(responsePromises)

        responses.forEach(response => {
            logger.debug('Mail sent.', { response })

            if (!isProd && !hasConfiguredServer) {
                logger.info(`Mail preview: ${nodemailer.getTestMessageUrl(response)}`)
            }
        })
    }

    /**
     * Outside production every mail goes out from the account it is sent with, since a mail server
     * only accepts its own addresses as sender: the configured user, or Ethereal's test account.
     */
    private async senderOutsideProduction(): Promise<string | undefined> {
        if (hasConfiguredServer) return process.env.EMAIL_USER
        return (await this.getTestAccount()).user
    }

    async sendSingleMail(data: Mail.Options) {
        await this.sendBulkMail([data])
    }

    async sendBulkMail(data: Mail.Options[]) {
        const testSender = isProd ? null : await this.senderOutsideProduction()

        const queue = data
            .map(mailData => ({
                ...mailData,
                from: testSender ?? mailData.from,
            }))

        this.queue.push(...queue)

        await this.handleNewMail()
    }
}

export function mailHandlerSingleton() {
    return new MailHandler()
}

export function getMailHandler() {
    if (!global.mailHandler) {
        global.mailHandler = mailHandlerSingleton()
    }

    return global.mailHandler
}

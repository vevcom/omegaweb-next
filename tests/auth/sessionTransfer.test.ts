import {
    issueTransferTicket,
    transferCallbackUrl,
    transferStateCookie,
    userOfTransferRequest,
    userOfTransferTicket,
} from '@/auth/nextAuth/sessionTransfer'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { SiteContext } from '@/lib/sites/context'
import { beforeEach, describe, expect, test } from '@jest/globals'

const contactor = 'https://contactor.no'

beforeEach(() => SiteContext.configure(DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'career.localhost:3000': { site: 'CAREERS', protocol: 'http' },
})))

const ticketFor = (state: string, to = contactor) =>
    issueTransferTicket({ userId: 7, provider: 'feide', state, to })

describe('session transfer tickets', () => {
    test('carry the user and how their session started to the origin and state they were issued for', () => {
        expect(userOfTransferTicket(ticketFor('s1'), { origin: contactor, state: 's1' }))
            .toEqual({ id: '7', sessionProvider: 'feide' })
    })

    test('are worth nothing for another state, another origin, or tampered with', () => {
        const ticket = ticketFor('s1')
        expect(userOfTransferTicket(ticket, { origin: contactor, state: 's2' })).toBeNull()
        expect(userOfTransferTicket(ticket, { origin: 'https://omega.ntnu.no', state: 's1' })).toBeNull()
        expect(userOfTransferTicket(`${ticket}x`, { origin: contactor, state: 's1' })).toBeNull()
        expect(userOfTransferTicket(ticket, { origin: contactor, state: undefined })).toBeNull()
        expect(userOfTransferTicket(undefined, { origin: contactor, state: 's1' })).toBeNull()
    })

    test('are read from the host the proxy checked and the state cookie of that host', () => {
        const ticket = ticketFor('s1')
        const name = transferStateCookie(contactor).name
        expect(name).toBe('__Host-sso-state')
        expect(userOfTransferRequest(ticket, { 'x-forwarded-host': 'contactor.no', cookie: `a=b; ${name}=s1` }))
            .toEqual({ id: '7', sessionProvider: 'feide' })
        expect(userOfTransferRequest(ticket, { 'x-forwarded-host': 'contactor.no', cookie: `${name}=s2` })).toBeNull()
        expect(userOfTransferRequest(ticket, { 'x-forwarded-host': 'evil.example', cookie: `${name}=s1` })).toBeNull()

        const local = ticketFor('s3', 'http://career.localhost:3000')
        expect(userOfTransferRequest(local, { host: 'career.localhost:3000', cookie: 'sso-state=s3' }))
            .toEqual({ id: '7', sessionProvider: 'feide' })
    })
})

describe('where a hop may end', () => {
    test('an app path, or a url on a configured domain', () => {
        expect(transferCallbackUrl('/job-ads?x=1')).toBe('/job-ads?x=1')
        expect(transferCallbackUrl('https://contactor.no/job-ads')).toBe('https://contactor.no/job-ads')
    })

    test('nowhere else', () => {
        expect(transferCallbackUrl('https://evil.example/')).toBeNull()
        expect(transferCallbackUrl('//evil.example/')).toBeNull()
        expect(transferCallbackUrl('/\\evil.example/')).toBeNull()
        expect(transferCallbackUrl('http://contactor.no/')).toBeNull()
        expect(transferCallbackUrl('job-ads')).toBeNull()
        expect(transferCallbackUrl(null)).toBeNull()
    })
})

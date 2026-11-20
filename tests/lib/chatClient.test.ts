import { ChatClient } from '@/lib/chatSync/client'
import { ACCOUNTS_WITH_PICTURE_REUSE_MS } from '@/lib/chatSync/constants'
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import type { ChatFetch } from '@/lib/chatSync/client'

type Call = { method: string, url: URL, contentType: string, token: string, body: unknown }

const KARI = '@kari:chat.test'
const ofKari = `/_synapse/admin/v2/users/${encodeURIComponent(KARI)}`
const ACCOUNTS = '/_synapse/admin/v2/users'

const masAnswers: Record<string, unknown> = {
    '/oauth2/token': { access_token: 'mas-token' },
    '/api/admin/v1/users/by-username/omegaweb-admin': { data: { id: 'admin', attributes: { deactivated_at: null } } },
    '/api/admin/v1/personal-sessions': { data: { attributes: { access_token: 'admin-token' } } },
}

/** A client of a homeserver that answers with `answer`, and of a MAS that hands it its tokens. */
function clientOf(answer: (call: Call) => unknown = () => ({}), statusOf: (call: Call) => number = () => 200) {
    const calls: Call[] = []
    const fetch: ChatFetch = (url, init) => {
        const headers = init.headers as Record<string, string>
        const call = {
            method: init.method ?? 'GET',
            url: new URL(url),
            contentType: headers['Content-Type'],
            token: headers.Authorization,
            body: init.body,
        }
        const fromMas = call.url.host === 'mas.test'
        if (!fromMas) calls.push(call)
        return Promise.resolve({
            status: fromMas ? 200 : statusOf(call),
            json: () => Promise.resolve(fromMas ? masAnswers[call.url.pathname] : answer(call)),
        })
    }
    const client = new ChatClient({
        homeserverUrl: 'http://synapse.test',
        serverName: 'chat.test',
        asToken: 'as-token',
        masUrl: 'http://mas.test',
        masClientSecret: 'secret',
        fetch,
    })
    return { client, calls, listings: () => calls.filter(call => call.url.pathname === ACCOUNTS) }
}

const bodyOf = (call: Call) => JSON.parse(call.body as string) as unknown

afterEach(() => {
    jest.restoreAllMocks()
})

describe('writing a profile', () => {
    test('is one call to Synapse\'s admin api, with only what is given', async () => {
        const { client, calls } = clientOf()
        await client.writeProfile(KARI, { displayName: 'Kari Nordmann', pictureUrl: 'mxc://chat.test/bilde' })
        await client.writeProfile(KARI, { displayName: 'Kari N' })

        expect(calls.map(call => [call.method, call.url.pathname, call.token]))
            .toEqual(Array(2).fill(['PUT', ofKari, 'Bearer admin-token']))
        expect(calls.map(bodyOf)).toEqual([
            { displayname: 'Kari Nordmann', avatar_url: 'mxc://chat.test/bilde' },
            { displayname: 'Kari N' },
        ])
    })

    test('takes a picture away with an empty uri, which is what Synapse takes for none', async () => {
        const { client, calls } = clientOf()
        await client.writeProfile(KARI, { pictureUrl: null })
        expect(calls.map(bodyOf)).toEqual([{ avatar_url: '' }])
    })
})

describe('uploading a picture', () => {
    test('gives the homeserver the jpeg as the bot, and returns where it keeps it', async () => {
        const { client, calls } = clientOf(() => ({ content_uri: 'mxc://chat.test/opplastet' }))
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

        await expect(client.uploadPicture(jpeg)).resolves.toBe('mxc://chat.test/opplastet')
        expect(calls).toMatchObject([{ method: 'POST', contentType: 'image/jpeg', token: 'Bearer as-token' }])
        expect(calls[0].url.href).toBe('http://synapse.test/_matrix/media/v3/upload')
        expect(Buffer.from(calls[0].body as Uint8Array)).toEqual(jpeg)
    })
})

describe('deleting a picture', () => {
    const FILE = '/_synapse/admin/v1/media/chat.test/opplastet'

    test('asks Synapse\'s admin api to delete the file, as the admin', async () => {
        const { client, calls } = clientOf()
        await client.deletePicture('mxc://chat.test/opplastet')
        expect(calls.map(call => [call.method, call.url.pathname, call.token]))
            .toEqual([['DELETE', FILE, 'Bearer admin-token']])
    })

    test('takes a file the homeserver no longer has for deleted, and no other refusal', async () => {
        const gone = clientOf(() => ({ errcode: 'M_NOT_FOUND', error: 'Unknown media' }), () => 404)
        await expect(gone.client.deletePicture('mxc://chat.test/opplastet')).resolves.toBeUndefined()

        const failing = clientOf(() => ({}), () => 500)
        await expect(failing.client.deletePicture('mxc://chat.test/opplastet'))
            .rejects.toThrow(`DELETE http://synapse.test${FILE}`)
    })

    test('takes no file for deleted when the 404 is of a path Synapse does not serve', async () => {
        const unserved = clientOf(() => ({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized request' }), () => 404)
        await expect(unserved.client.deletePicture('mxc://chat.test/opplastet')).rejects.toThrow('Unrecognized request')
    })

    test('asks nothing for what is no file of this homeserver', async () => {
        const { client, calls } = clientOf()
        const notOurs = ['mxc://matrix.org/fil', 'mxc://chat.test/', 'https://chat.test/fil', 'mxc://chat.test/a/b']
        for (const uri of notOurs) {
            await expect(client.deletePicture(uri)).rejects.toThrow('is no file of this homeserver')
        }
        expect(calls).toHaveLength(0)
    })
})

describe('the picture an account shows', () => {
    test('is the one Synapse\'s admin api has for it, and none where it has none or no such account', async () => {
        const shown = clientOf(() => ({ name: KARI, avatar_url: 'mxc://chat.test/bilde' }))
        await expect(shown.client.readPicture(KARI)).resolves.toBe('mxc://chat.test/bilde')
        expect(shown.calls.map(call => [call.method, call.url.pathname, call.token]))
            .toEqual([['GET', ofKari, 'Bearer admin-token']])

        const without = clientOf(() => ({ name: KARI, avatar_url: null }))
        await expect(without.client.readPicture(KARI)).resolves.toBeNull()
        const noAccount = clientOf(() => ({ errcode: 'M_NOT_FOUND', error: 'User not found' }), () => 404)
        await expect(noAccount.client.readPicture(KARI)).resolves.toBeNull()
    })

    test('is not known when Synapse does not answer for the account, which is no account without a picture', async () => {
        const unserved = clientOf(() => ({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized request' }), () => 404)
        await expect(unserved.client.readPicture(KARI)).rejects.toThrow('Unrecognized request')
    })
})

describe('the accounts with a picture', () => {
    const pages: Record<string, unknown> = {
        first: {
            users: [{ name: KARI, avatar_url: 'mxc://chat.test/bilde' }, { name: '@ola:chat.test', avatar_url: null }],
            next_token: '500',
        },
        500: { users: [{ name: '@per:chat.test', avatar_url: 'mxc://chat.test/annet' }] },
    }
    const pageAsked = (call: Call) => pages[call.url.searchParams.get('from') ?? 'first']

    test('are read page by page, without the guests, which Synapse refuses to list under MAS', async () => {
        const { client, listings } = clientOf(pageAsked)
        await expect(client.readAccountsWithPicture()).resolves.toEqual(new Set([KARI, '@per:chat.test']))
        expect(listings().map(call => Object.fromEntries(call.url.searchParams))).toEqual([
            { guests: 'false', limit: '500' },
            { guests: 'false', limit: '500', from: '500' },
        ])
    })

    test('are asked for again only after a while, and follow what is written meanwhile', async () => {
        const start = Date.now()
        const now = jest.spyOn(Date, 'now').mockReturnValue(start)
        const { client, listings } = clientOf(call => (call.url.pathname === ACCOUNTS ? pageAsked(call) : {}))
        await client.readAccountsWithPicture()

        await client.writeProfile(KARI, { pictureUrl: null })
        await client.writeProfile('@ola:chat.test', { pictureUrl: 'mxc://chat.test/nytt' })
        now.mockReturnValue(start + ACCOUNTS_WITH_PICTURE_REUSE_MS - 1)
        await expect(client.readAccountsWithPicture()).resolves.toEqual(new Set(['@ola:chat.test', '@per:chat.test']))
        expect(listings()).toHaveLength(2)

        now.mockReturnValue(start + ACCOUNTS_WITH_PICTURE_REUSE_MS)
        await expect(client.readAccountsWithPicture()).resolves.toEqual(new Set([KARI, '@per:chat.test']))
        expect(listings()).toHaveLength(4)
    })

    test('are not asked for again right after a listing that failed, which leaves what was known', async () => {
        const start = Date.now()
        const now = jest.spyOn(Date, 'now').mockReturnValue(start)
        let secondPageFails = true
        const { client, listings } = clientOf(
            pageAsked,
            call => (secondPageFails && call.url.searchParams.has('from') ? 504 : 200),
        )

        await expect(client.readAccountsWithPicture()).rejects.toThrow('504')
        await expect(client.readAccountsWithPicture()).resolves.toEqual(new Set())
        expect(listings()).toHaveLength(2)

        secondPageFails = false
        now.mockReturnValue(start + ACCOUNTS_WITH_PICTURE_REUSE_MS)
        await client.readAccountsWithPicture()
        secondPageFails = true
        now.mockReturnValue(start + 2 * ACCOUNTS_WITH_PICTURE_REUSE_MS)
        await expect(client.readAccountsWithPicture()).rejects.toThrow('504')
        await expect(client.readAccountsWithPicture()).resolves.toEqual(new Set([KARI, '@per:chat.test']))
        expect(listings()).toHaveLength(6)
    })
})

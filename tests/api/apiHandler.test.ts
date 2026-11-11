import { apiHandler } from '@/api/apiHandler'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { defineOperation } from '@/services/serviceOperation'
import { describe, expect, test } from '@jest/globals'
import { z } from 'zod'

const update = defineOperation({
    paramsSchema: z.object({ id: z.string().regex(/^\d+$/) }),
    dataSchema: z.object({ name: z.string().min(2) }),
    authorizer: () => Require.nothing(),
    operation: ({ params, data }) => ({ id: params.id, name: data.name }),
})

const handler = apiHandler({
    serviceOperation: update,
    session: () => Promise.resolve(Session.empty()),
    query: query => ({ id: query.get('id') ?? '' }),
})

const put = (id: string, body: unknown) => handler(new Request(`https://omega.ntnu.no/api/v1/things?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
}))

describe('the api handler', () => {
    test('answers with the operation\'s result', async () => {
        const response = await put('3', { name: 'Kari' })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ id: '3', name: 'Kari' })
    })

    test('a bad param is BAD PARAMETERS and a bad field of the body BAD DATA, each with its issues', async () => {
        const badParam = await put('x', { name: 'Kari' })
        expect(badParam.status).toBe(400)
        expect(await badParam.json()).toMatchObject({ errorCode: 'BAD PARAMETERS', errors: [{ path: ['id'] }] })

        const badData = await put('3', { name: 'K' })
        expect(badData.status).toBe(400)
        expect(await badData.json()).toMatchObject({ errorCode: 'BAD DATA', errors: [{ path: ['name'] }] })
    })
})

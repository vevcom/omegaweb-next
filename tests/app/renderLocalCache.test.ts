import './requestHeaders'
import { describe, expect, jest, test } from '@jest/globals'

// React's `cache` as it is inside one render: the same answer for the same arguments. It must be in
// place when the cache is loaded, so the test imports that itself.
jest.mock('react', () => ({
    ...jest.requireActual<object>('react'),
    cache: <Args extends unknown[], Kept>(make: (...args: Args) => Kept) => {
        const kept: { args: Args, value: Kept }[] = []
        return (...args: Args) => {
            const found = kept.find(entry => (
                entry.args.length === args.length && entry.args.every((arg, index) => Object.is(arg, args[index]))
            ))
            if (found) return found.value
            const value = make(...args)
            kept.push({ args, value })
            return value
        }
    },
}))

describe('the cache of a render', () => {
    test('is in force for what a page, a layout or a section reads, so a read asked twice runs once', async () => {
        const { RenderSession } = await import('@/app/renderSession')
        const { Session } = await import('@/auth/session/Session')
        const { withPageSession } = await import('@/app/ServerPage')
        const { defineOperation } = await import('@/services/serviceOperation')
        const { Require } = await import('@/auth/authorizer/Require')
        jest.spyOn(RenderSession, 'fromNextAuth').mockResolvedValue(Session.empty())
        const runs = jest.fn()
        const read = defineOperation({ read: true, authorizer: () => Require.nothing(), operation: () => runs() })

        await withPageSession(async () => {
            await read({})
            await read({})
        })

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('answers everything in the render from one read, until one of them clears it', async () => {
        const { RenderLocalCache } = await import('@/app/renderLocalCache')
        const operation = {}
        const read = jest.fn(() => Promise.resolve({}))
        const ofTheLayout = new RenderLocalCache()
        const ofThePage = new RenderLocalCache()

        const first = await ofTheLayout.remember(operation, 'key', read)
        expect(await ofThePage.remember(operation, 'key', read)).toBe(first)
        expect(read).toHaveBeenCalledTimes(1)

        ofThePage.clear()

        expect(await ofTheLayout.remember(operation, 'key', read)).not.toBe(first)
        expect(await ofThePage.remember(operation, 'key', read)).not.toBe(first)
        expect(read).toHaveBeenCalledTimes(2)
    })

    test('begun inside another of the render, is cleared with it and remembers again', async () => {
        const { RenderLocalCache } = await import('@/app/renderLocalCache')
        const { LocalCache } = await import('@/services/localCache')
        const read = jest.fn(() => Promise.resolve({}))
        const remember = () => LocalCache.inForce()?.remember(read, 'key', read)

        await RenderLocalCache.begin(() => RenderLocalCache.begin(async () => {
            await remember()
            LocalCache.inForce()?.clear()

            expect(await remember()).toBe(await remember())
            expect(read).toHaveBeenCalledTimes(2)
        }))
    })
})

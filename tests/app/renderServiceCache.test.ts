import { describe, expect, jest, test } from '@jest/globals'

// React's `cache` as it is inside one render: the same answer for the same arguments. It must be in
// place when the cache is loaded, so the test imports that itself.
jest.mock('react', () => ({
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
    test('answers every context of the render from one read, until one of them clears it', async () => {
        const { RenderServiceCache } = await import('@/app/renderServiceCache')
        const operation = {}
        const read = jest.fn(() => Promise.resolve({}))
        const ofTheLayout = new RenderServiceCache()
        const ofThePage = new RenderServiceCache()

        const first = await ofTheLayout.remember(operation, 'key', read)
        expect(await ofThePage.remember(operation, 'key', read)).toBe(first)
        expect(read).toHaveBeenCalledTimes(1)

        ofThePage.clear()

        expect(await ofTheLayout.remember(operation, 'key', read)).not.toBe(first)
        expect(await ofThePage.remember(operation, 'key', read)).not.toBe(first)
        expect(read).toHaveBeenCalledTimes(2)
    })
})

import { componentWithSkeleton } from '@/app/componentWithSkeleton'
import Skeleton from '@/components/UI/Skeleton'
import { describe, expect, test } from '@jest/globals'

type Known = { title: string }
type Read = { usernames: string[] }

describe('a component with its skeleton', () => {
    test('the component is the body with the read props, and the skeleton the body with the block', () => {
        const seen: unknown[] = []
        const UserList = componentWithSkeleton<Known, Read>(props => {
            seen.push(props)
            return null
        })

        const rendered = [
            UserList.Component({ title: 'Brukere', usernames: ['harambe'] }),
            UserList.Skeleton({ title: 'Brukere' }),
        ]

        expect(rendered).toEqual([null, null])
        expect(seen).toEqual([
            { title: 'Brukere', usernames: ['harambe'], loaded: true, Skeleton: null },
            { title: 'Brukere', loaded: false, Skeleton },
        ])
    })

    /**
     * The `@ts-expect-error` lines are the test: `tsc` fails when one of them stops holding.
     */
    test('the body cannot read what is not loaded, or place a block over what is', () => {
        const UserList = componentWithSkeleton<Known, Read>(({ title, loaded, Skeleton: Block, usernames }) => (
            <div>
                <h2>{title}</h2>
                {loaded ? usernames.join(', ') : <Block className="h-lh w-40" />}
                {/* @ts-expect-error - the usernames are not there while loading */}
                {!loaded && usernames.length}
                {/* @ts-expect-error - there is no block once loaded */}
                {loaded && <Block className="h-lh w-40" />}
            </div>
        ))

        const component = <UserList.Component title="Brukere" usernames={[]} />
        const skeleton = <UserList.Skeleton title="Brukere" />
        // @ts-expect-error - the component needs what is read
        const withoutRead = <UserList.Component title="Brukere" />
        // @ts-expect-error - the skeleton has nothing read to take
        const withRead = <UserList.Skeleton title="Brukere" usernames={[]} />

        expect([component, skeleton, withoutRead, withRead]).toHaveLength(4)
    })

    test('a key is known or read and not both, and the body is not async', () => {
        // @ts-expect-error - the title would be read over the one that is known
        const sharedKey = componentWithSkeleton<Known, { title: string, usernames: string[] }>(() => null)
        // @ts-expect-error - the body is plain markup, which waits for nothing
        const asyncBody = componentWithSkeleton<Known, Read>(() => Promise.resolve(null))

        expect([sharedKey, asyncBody]).toHaveLength(2)
    })
})

import '@ow-server-only'
import Skeleton from '@/components/UI/Skeleton'
import type { ReactElement } from 'react'

type Loaded<Read> = { loaded: true, Skeleton: null } & Read

type Loading<Read> = { loaded: false, Skeleton: typeof Skeleton } & { [Key in keyof Read]?: undefined }

const loading: { loaded: false, Skeleton: typeof Skeleton } = { loaded: false, Skeleton }

/** `Read` as the constraint of itself, where a key it shares with `Known` is a type error. */
type SharingNoKeyWith<Known, Read> = { [Key in keyof Read]: Key extends keyof Known ? never : Read[Key] }

/** A component and its skeleton, made from one body by {@link componentWithSkeleton}. */
export type ComponentWithSkeleton<Known, Read> = {
    Component: (props: Known & Read) => ReactElement | null,
    Skeleton: (props: Known) => ReactElement | null,
}

/**
 * Makes a component and its skeleton from one body, so the skeleton is the component with blocks
 * where the read data goes and cannot drift from it. `Known` is what is known before the read and
 * `Read` is what is read. A Suspendful takes the result whole as its `section`, and whoever has
 * the data already renders `.Component`.
 *
 * The body gets one props object. With `loaded: true` the read props are there and `Skeleton` is
 * null. With `loaded: false` they are not, and `Skeleton` is the block to place where they go.
 *
 * The body is plain markup: no hooks, not async, in a file without `'use client'`, which this
 * module refuses to be imported from. A part that needs a hook is a client component the loaded
 * branch renders and hands the data. `Known` and `Read` share no key.
 *
 * A Suspendful renders `.Component` inside its boundary and calls `.Skeleton` outside it, where
 * the page places the section. So a bug in the loading branch of a body is the page's and not the
 * section's: it must not fail.
 *
 * @example
 * export const UserCard = componentWithSkeleton<{ title: string }, { user: User }>(
 *     ({ title, loaded, Skeleton, user }) => (
 *         <Card title={title}>
 *             {loaded ? <p>{user.username}</p> : <Skeleton className="h-lh w-40" />}
 *         </Card>
 *     )
 * )
 */
export function componentWithSkeleton<Known, Read extends SharingNoKeyWith<Known, Read>>(
    body: (props: Known & (Loaded<Read> | Loading<Read>)) => ReactElement | null
): ComponentWithSkeleton<Known, Read> {
    return {
        Component: props => body({ ...props, loaded: true, Skeleton: null }),
        Skeleton: props => body({ ...props, ...loading }),
    }
}

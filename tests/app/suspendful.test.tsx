import { requestPath } from './requestHeaders'
import { Suspendful, suspendfulErrorAction, suspendfulFailure, suspendfulLoaded } from '@/app/Suspendful'
import { componentWithSkeleton } from '@/app/componentWithSkeleton'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { ServiceError, Smorekopp, errorCodes } from '@/services/error'
import { describe, expect, test } from '@jest/globals'
import { isValidElement } from 'react'
// What Next's own redirect throws is what a section must not catch, so it is not siteRedirect's to make.
// eslint-disable-next-line no-restricted-imports
import { notFound, redirect } from 'next/navigation'
import type { SuspendfulErrorPolicy } from '@/app/Suspendful'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { ErrorCode } from '@/services/error'
import type { ReactNode } from 'react'

const everyCode = errorCodes.map(code => code.name)

describe('what a Suspendful does with a service error, by its code', () => {
    test('unless told otherwise it hides the three codes that say a section is not for the visitor', () => {
        const hidden = everyCode.filter(code => suspendfulErrorAction(code) === 'hide')
        const shown = everyCode.filter(code => suspendfulErrorAction(code) === 'show')

        expect(hidden.sort()).toEqual(['NOT FOUND', 'UNAUTHENTICATED', 'UNAUTHORIZED'])
        expect(shown).toHaveLength(everyCode.length - 3)
    })

    test('a use changes the codes it names and no other', () => {
        const errors: SuspendfulErrorPolicy = { UNAUTHORIZED: 'show', 'SERVER ERROR': 'hide' }

        expect(suspendfulErrorAction('UNAUTHORIZED', errors)).toBe('show')
        expect(suspendfulErrorAction('SERVER ERROR', errors)).toBe('hide')
        expect(suspendfulErrorAction('NOT FOUND', errors)).toBe('hide')
        expect(suspendfulErrorAction('UNAUTHENTICATED', errors)).toBe('hide')
        expect(suspendfulErrorAction('UNKNOWN ERROR', errors)).toBe('show')
    })

    test('the login is where a visitor who is not logged in is sent only when asked for', () => {
        expect(suspendfulErrorAction('UNAUTHENTICATED', { UNAUTHENTICATED: 'login' })).toBe('login')
        expect(suspendfulErrorAction('UNAUTHENTICATED', { UNAUTHORIZED: 'show' })).toBe('hide')
        expect(everyCode.filter(code => suspendfulErrorAction(code) === 'login')).toEqual([])
    })
})

describe('what a section does with what it caught', () => {
    test('a hidden service error leaves the section out', async () => {
        expect(await suspendfulFailure(new Smorekopp('UNAUTHORIZED'))).toBeNull()
        expect(await suspendfulFailure(new ServiceError('SERVER ERROR', 'Stripe svarte ikke'), { 'SERVER ERROR': 'hide' }))
            .toBeNull()
    })

    test('a shown service error gives its own message, or the message of its code', async () => {
        expect(await suspendfulFailure(new ServiceError('SERVER ERROR', 'Stripe svarte ikke')))
            .toEqual({ message: 'Stripe svarte ikke' })
        expect(await suspendfulFailure(new Smorekopp('UNAUTHORIZED'), { UNAUTHORIZED: 'show' }))
            .toEqual({ message: 'Du har ikke tilgang til denne ressursen' })
    })

    test('a bug is thrown on, to the boundary of the section', async () => {
        const bug = new TypeError('undefined is not a function')

        expect(await thrownBy(() => suspendfulFailure(bug))).toBe(bug)
        expect(await thrownBy(() => suspendfulFailure(bug, { 'UNKNOWN ERROR': 'hide' }))).toBe(bug)
    })

    test('the redirect and the notFound of Next are thrown on, whatever the section does with errors', async () => {
        const redirectError = await thrownBy(() => redirect('/login'))
        const notFoundError = await thrownBy(() => notFound())
        const hideAll: SuspendfulErrorPolicy = Object.fromEntries(everyCode.map(code => [code, 'hide']))

        expect(await thrownBy(() => suspendfulFailure(redirectError, hideAll))).toBe(redirectError)
        expect(await thrownBy(() => suspendfulFailure(notFoundError, hideAll))).toBe(notFoundError)
    })

    test('the login, when asked for, is where a visitor who is not logged in is sent, to come back here', async () => {
        const unauthenticated = new Smorekopp('UNAUTHENTICATED')

        const thrown = await thrownBy(() => suspendfulFailure(unauthenticated, { UNAUTHENTICATED: 'login' }))

        expect(digestOf(thrown)).toMatch(/^NEXT_REDIRECT;/)
        expect(digestOf(thrown)).toContain(`/api/sso/start?callbackUrl=${encodeURIComponent(requestPath)}`)
        expect(await suspendfulFailure(unauthenticated)).toBeNull()
    })
})

describe('the boundary of a Suspendful', () => {
    const keyOf = (node: ReactNode) => (isValidElement(node) ? node.key : undefined)

    test('is keyed by the params, so the fallback shows again when they change', () => {
        const section = (filter: string) => Suspendful({
            params: { filter, page: 2 },
            operation: ({ params }) => params.filter,
            fallback: null,
            render: () => null,
        })

        expect(keyOf(section('a'))).toBe(keyOf(section('a')))
        expect(keyOf(section('a'))).not.toBe(keyOf(section('b')))
        expect(keyOf(section('a'))).not.toBeNull()
    })

    test('has no key without params, so a refresh keeps what the section shows', () => {
        expect(keyOf(Suspendful({ operation: () => 1, fallback: null, render: () => null }))).toBeNull()
    })
})

describe('a Suspendful with a section', () => {
    const UserCard = componentWithSkeleton<{ title: string }, { username: string }>(
        ({ title, loaded, username }) => <p>{title}: {loaded ? username : 'laster'}</p>
    )

    test('its fallback, which is also the shape of an error, is the skeleton of the section with the props', () => {
        const suspendful = Suspendful({
            operation: () => ({ username: 'harambe' }),
            section: UserCard,
            props: { title: 'Eier' },
        })
        const skeleton = UserCard.Skeleton({ title: 'Eier' })

        expect(propOf(suspendful, 'shape')).toEqual(skeleton)
        expect(propOf(propOf(suspendful, 'children'), 'fallback')).toEqual(skeleton)
    })

    test('once loaded it is the component of the section, with what was read and what was known, which wins', () => {
        const loaded = suspendfulLoaded(
            { section: UserCard, props: { title: 'Eier' } },
            { data: { username: 'harambe', title: 'Lest' }, session: Session.empty() },
        )

        expect(loaded).toEqual(<UserCard.Component title="Eier" username="harambe" />)
    })
})

/**
 * The `@ts-expect-error` lines and the annotated consts are the test: `tsc` fails when one of them
 * stops holding. The callbacks are never run.
 */
describe('the types of a Suspendful', () => {
    test('only UNAUTHENTICATED can be sent to the login', () => {
        type CodesThatCanBeLogin = {
            [Code in ErrorCode]: 'login' extends NonNullable<SuspendfulErrorPolicy[Code]> ? Code : never
        }[ErrorCode]
        const codesThatCanBeLogin: Record<CodesThatCanBeLogin, true> = { UNAUTHENTICATED: true }

        const section = <Suspendful
            operation={() => 1}
            fallback={null}
            // @ts-expect-error - a visitor who lacks access gains nothing from the login
            errors={{ UNAUTHORIZED: 'login' }}
            render={() => null}
        />

        expect(codesThatCanBeLogin).toBeDefined()
        expect(section).toBeDefined()
    })

    test('the operation is given the params as they are typed, and render the data the operation returns', () => {
        const filter = ['a'].at(1)

        const section = <Suspendful
            params={{ filter, page: 2 }}
            operation={({ params }) => {
                const given: { filter: string | undefined, page: number } = params
                // @ts-expect-error - the filter may be undefined, as it is given
                const surely: string = params.filter
                // @ts-expect-error - no such param is given
                const missing: unknown = params.missing
                return { given, surely, missing }
            }}
            fallback={null}
            render={({ data }) => {
                const page: number = data.given.page
                // @ts-expect-error - the operation returns no such thing
                const missing: unknown = data.somethingElse
                return <p>{page}{String(missing)}</p>
            }}
        />

        expect(section).toBeDefined()
    })

    test('without params the operation is given none, and render gets the capabilities the section declares', () => {
        const section = <Suspendful
            operation={(args) => {
                // @ts-expect-error - no params are given
                const none: unknown = args.params
                return { none, userId: args.session.user?.id }
            }}
            capabilities={data => ({ canSeeUser: Require.userId().data({ userId: data.userId ?? -1 }) })}
            fallback={null}
            render={({ capabilities }) => {
                const authorized: boolean = capabilities.canSeeUser.authorized
                // @ts-expect-error - the section declares no such capability
                const undeclared: unknown = capabilities.canDestroy
                return <p>{String(authorized)}{String(undeclared)}</p>
            }}
        />

        expect(section).toBeDefined()
    })

    test('an operation cannot read params that are not given, or that may not be there', () => {
        const filter = ['a'].at(1)

        const annotated = <Suspendful
            // @ts-expect-error - the operation says it reads params, and none are given
            operation={({ params }: { params: { id: number } }) => params.id}
            fallback={null}
            render={() => null}
        />
        const asAPage = <Suspendful
            // @ts-expect-error - the arguments of a page's operation are not those of a section's
            operation={({ params }: PageOperationArgs<{ id: string }>) => params.id}
            fallback={null}
            render={() => null}
        />
        // @ts-expect-error - the type arguments say there are params, and none are given
        const byTypeArguments = <Suspendful<number, { id: number }>
            operation={() => 1}
            fallback={null}
            render={() => null}
        />
        const maybeUndefined = <Suspendful
            // @ts-expect-error - the params are an object or left out, so the optional part goes inside: `{ filter }`
            params={filter === undefined ? undefined : { filter }}
            operation={() => 1}
            fallback={null}
            render={() => null}
        />

        expect([annotated, asAPage, byTypeArguments, maybeUndefined]).toHaveLength(4)
    })

    test('with a section, the props and the data are those of its component', () => {
        const UserCard = componentWithSkeleton<{ title: string }, { username: string }>(
            ({ title, loaded, username }) => <p>{title}{loaded && username}</p>
        )

        const fits = <Suspendful operation={() => ({ username: 'harambe' })} section={UserCard} props={{ title: 'Eier' }} />
        const wrongData = <Suspendful
            // @ts-expect-error - the component reads a username, and the operation returns none
            operation={() => ({ userId: 1 })}
            section={UserCard}
            props={{ title: 'Eier' }}
        />
        const wrongProps = <Suspendful
            operation={() => ({ username: 'harambe' })}
            section={UserCard}
            // @ts-expect-error - the component is given a title before the read
            props={{ heading: 'Eier' }}
        />

        const mixed = <Suspendful
            operation={() => ({ username: 'harambe' })}
            // @ts-expect-error - a section that needs capabilities is given with fallback and render
            section={UserCard}
            props={{ title: 'Eier' }}
            capabilities={() => ({ canSeeUser: Require.user() })}
        />

        expect([fits, wrongData, wrongProps, mixed]).toHaveLength(4)
    })
})

async function thrownBy(run: () => unknown): Promise<unknown> {
    try {
        await run()
    } catch (error) {
        return error
    }
    throw new Error('Nothing was thrown')
}

function propOf(node: unknown, name: string): unknown {
    if (!isValidElement(node) || typeof node.props !== 'object' || node.props === null) {
        throw new Error(`There is no element to read ${name} of`)
    }
    return new Map<string, unknown>(Object.entries(node.props)).get(name)
}

function digestOf(error: unknown) {
    return error instanceof Error && 'digest' in error ? String(error.digest) : ''
}

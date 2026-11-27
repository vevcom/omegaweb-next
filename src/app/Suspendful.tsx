import '@ow-server-only'
import { handleServiceError, pageCapabilities, serviceErrorOf, withPageSession } from '@/app/ServerPage'
import { SuspendfulBoundary, SuspendfulRefresh } from '@/components/Suspendful/SuspendfulBoundary'
import SuspendfulError from '@/components/Suspendful/SuspendfulError'
import { getDefaultErrorMessage } from '@/services/error'
import { Suspense } from 'react'
import type { CapabilitiesOf, PageCapabilities, ServerPageSession } from '@/app/ServerPage'
import type { ComponentWithSkeleton } from '@/app/componentWithSkeleton'
import type { CapabilityAuthorizers } from '@/auth/authorizer/capabilities'
import type { Awaitable } from '@/lib/awaitable'
import type { ErrorCode } from '@/services/error'
import type { ReactNode } from 'react'

type SuspendfulParams = Record<string, string | number | boolean | null | undefined>

type WithParams<Data, Params> = {
    params: Params,
    operation: (args: { params: Params, session: ServerPageSession }) => Awaitable<Data>,
}

type WithoutParams<Data> = {
    operation: (args: { session: ServerPageSession }) => Awaitable<Data>,
}

type Shown<Data, Authorizers, Known> = { errors?: SuspendfulErrorPolicy } & ({
    section: ComponentWithSkeleton<Known, Data>,
    props: Known,
    capabilities?: never,
    fallback?: never,
    render?: never,
} | {
    capabilities?: CapabilitiesOf<Data, Authorizers>,
    fallback: ReactNode,
    render: (args: {
        data: Data,
        capabilities: PageCapabilities<Authorizers>,
        session: ServerPageSession,
    }) => Awaitable<ReactNode>,
})

// In one signature this union leaves the operation's argument untyped, so Suspendful has a signature for each half.
type SuspendfulProps<Data, Params, Authorizers, Known> =
    & (WithParams<Data, Params> | WithoutParams<Data>)
    & Shown<Data, Authorizers, Known>

/**
 * serverPage in component form, for a section of a page: loads the section with an operation and
 * renders it behind a Suspense boundary of its own, so the page around it is sent without waiting
 * for it. A page or a layout places it, in its own `render`. A client component cannot render
 * one, but can be handed one as `children`.
 *
 * What it shows is given in one of two forms. `section` with `props` is for a component made by
 * {@link componentWithSkeleton}: its skeleton is the fallback, and it is rendered with what the
 * operation returns and `props`, which win where the two share a key. `fallback` with `render`,
 * and `capabilities` as for {@link serverPage}, is for a section that is not one such component.
 *
 * The page is already on its way when a section fails. A service error is left out or shown where
 * the section would have been, by `errors`. A bug thrown by `render`, by a component under it or
 * by a section's component is caught by a boundary of the section's own, and the page stands. A
 * section's skeleton is made where the page places the section, outside that boundary, so a bug
 * in the loading branch of its body is the page's. `notFound()` and a redirect are not caught:
 * they act on the whole page after it has shown, so a section's operation does not call them, nor
 * a helper that does, such as `siteRedirect`. What decides the page, which is the thing itself,
 * access, the title and the main content, stays in the page's own operation.
 *
 * @param params - Optional: what the operation reads by, such as a filter or a page number. The
 * operation receives it, and the fallback shows again when it changes. Without it the section
 * keeps what it shows while it loads again.
 * @param operation - Loads what the section needs, in a service context seeded with the session.
 * With `section` it returns the read props of the component.
 * @param section - A component with its skeleton, see {@link componentWithSkeleton}.
 * @param props - What the section's component and skeleton both take: what is known before the read.
 * @param fallback - The section's skeleton, in the section's own size, since a smaller one moves
 * the page when the section arrives. It is also the shape an error is shown in.
 * @param capabilities - Optional, as for {@link serverPage}: what the user may do in the section,
 * built from its data and the session, and given to `render` under the same `can[Something]` keys.
 * @param render - Renders the section from the loaded data, the capabilities and the session.
 * @param errors - Optional: what a service error becomes, by its code, where the default is not
 * wanted. See {@link SuspendfulErrorPolicy}.
 *
 * @example
 * <Suspendful
 *     operation={async () => ({ user: await userOperations.read({ params: { id: userId } }) })}
 *     section={UserCard}
 *     props={{ title: 'Eier' }}
 * />
 *
 * @example
 * <Suspendful
 *     params={{ filter }}
 *     operation={({ params }) => jobAdOperations.readPage({ params: { type: params.filter } })}
 *     capabilities={() => ({ canCreate: jobAdAuth.create })}
 *     fallback={<JobAdListSkeleton />}
 *     render={({ data, capabilities }) => <JobAdList jobAds={data} capabilities={capabilities} />}
 * />
 */
export function Suspendful<
    Data,
    Params extends SuspendfulParams,
    Authorizers extends CapabilityAuthorizers<Authorizers> = Record<never, never>,
    Known extends object = object,
>(props: WithParams<Data, Params> & Shown<Data, Authorizers, Known>): ReactNode
export function Suspendful<
    Data,
    Authorizers extends CapabilityAuthorizers<Authorizers> = Record<never, never>,
    Known extends object = object,
>(props: WithoutParams<Data> & Shown<Data, Authorizers, Known>): ReactNode
export function Suspendful<
    Data,
    Params extends SuspendfulParams,
    Authorizers extends CapabilityAuthorizers<Authorizers>,
    Known extends object,
>(props: SuspendfulProps<Data, Params, Authorizers, Known>) {
    const fallback = 'section' in props ? props.section.Skeleton(props.props) : props.fallback
    return (
        <SuspendfulBoundary key={'params' in props ? JSON.stringify(props.params) : undefined} shape={fallback}>
            <Suspense fallback={fallback}>
                <SuspendfulSection given={props} fallback={fallback} />
            </Suspense>
        </SuspendfulBoundary>
    )
}

/**
 * What a Suspendful does with a service error, by its code: `'hide'` leaves the section out, and
 * `'show'` shows the error where the section would have been, with a button that loads it again.
 * NOT FOUND, UNAUTHENTICATED and UNAUTHORIZED are hidden unless said otherwise, since they say
 * the section is not for this visitor, and every other code is shown. It is for what the operation
 * and `render` throw: a service error thrown by a component under `render` reaches the boundary
 * as any bug does.
 *
 * `'login'`, for UNAUTHENTICATED alone, sends the visitor to the login with the page as the way
 * back. The page has shown by then, for as long as the section took to load, so the visitor is
 * moved away from a page they were reading: after two seconds for a section of two seconds, and
 * after ten on a slow phone. A page that needs a login says so in its own operation, which
 * redirects before anything shows.
 */
export type SuspendfulErrorPolicy =
    & Partial<Record<Exclude<ErrorCode, 'UNAUTHENTICATED'>, 'hide' | 'show'>>
    & { UNAUTHENTICATED?: 'hide' | 'show' | 'login' }

const defaultErrorPolicy: SuspendfulErrorPolicy = {
    'NOT FOUND': 'hide',
    UNAUTHENTICATED: 'hide',
    UNAUTHORIZED: 'hide',
}

export function suspendfulErrorAction(errorCode: ErrorCode, errors: SuspendfulErrorPolicy = {}) {
    return errors[errorCode] ?? defaultErrorPolicy[errorCode] ?? 'show'
}

async function SuspendfulSection<
    Data,
    Params extends SuspendfulParams,
    Authorizers extends CapabilityAuthorizers<Authorizers>,
    Known extends object,
>({ given, fallback }: { given: SuspendfulProps<Data, Params, Authorizers, Known>, fallback: ReactNode }) {
    try {
        const loaded = await withPageSession(async session => ({
            session,
            data: 'params' in given
                ? await given.operation({ params: given.params, session })
                : await given.operation({ session }),
        }))
        return await suspendfulLoaded(given, loaded)
    } catch (error) {
        const failure = await suspendfulFailure(error, given.errors)
        return failure && <SuspendfulError shape={fallback} message={failure.message} action={<SuspendfulRefresh />} />
    }
}

/**
 * What a section shows once its data is there. A section's component is given what was read and
 * then what was known, so the data never replaces a known prop. It is returned as an element, to
 * render in React's own time, so what it throws reaches the section's boundary and not `errors`.
 */
export function suspendfulLoaded<Data, Authorizers extends CapabilityAuthorizers<Authorizers>, Known extends object>(
    shown: Shown<Data, Authorizers, Known>,
    { data, session }: { data: Data, session: ServerPageSession },
) {
    if ('section' in shown) return <shown.section.Component {...data} {...shown.props} />
    return shown.render({ data, session, capabilities: pageCapabilities(shown.capabilities, data, session) })
}

/**
 * What a section does with what it caught while loading or rendering. A service error is hidden,
 * which is null, or shown with the message returned, by `errors`, or sends the visitor to the
 * login. Everything else is thrown on: a bug to the section's boundary, and the redirect and the
 * notFound of Next to Next.
 */
export async function suspendfulFailure(error: unknown, errors?: SuspendfulErrorPolicy) {
    const serviceError = serviceErrorOf(error)
    const action = suspendfulErrorAction(serviceError.errorCode, errors)
    if (action === 'hide') return null
    // Only UNAUTHENTICATED can be 'login', and for that code this redirects and never returns.
    if (action === 'login') await handleServiceError(serviceError)
    return { message: serviceError.errors.at(0)?.message ?? getDefaultErrorMessage(serviceError.errorCode) }
}

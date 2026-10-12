import '@pn-server-only'
import ServiceErrorView from '@/components/ServiceErrorView/ServiceErrorView'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { Smorekopp } from '@/services/error'
import { withServiceContext } from '@/services/serviceOperation'
import { ServerSession } from '@/auth/session/ServerSession'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import { CURRENT_PATH_HEADER } from '@/proxy'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { notFound, redirect, unstable_rethrow as unstableRethrow } from 'next/navigation'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { ErrorCode } from '@/services/error'
import type { AuthStatus } from '@/auth/authorizer/AuthResult'
import type { Capabilities, CapabilityAuthorizers, CapabilityKey } from '@/auth/authorizer/capabilities'
import type { Session } from '@/auth/session/Session'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export type SearchParams = { [key: string]: string | string[] | undefined }

export type ServerPageSession = Session<'HAS_USER'> | Session<'NO_USER'>

/**
 * The arguments a serverPage operation receives. Pages with route params annotate their
 * operation callback with this to declare the params' shape:
 * `operation: async ({ params }: PageOperationArgs<{ id: string }>) => ...`
 */
export type PageOperationArgs<Params extends object = object> = {
    params: Params,
    searchParams: SearchParams,
    session: ServerPageSession,
}

type PageProps<Params extends object> = {
    params: Promise<Params>,
    searchParams: Promise<SearchParams>,
}

/** The capabilities a page or layout declares, built from its data and the session of the request. */
type CapabilitiesOf<Data, Authorizers> = (data: Data, session: ServerPageSession) => Authorizers

type PageCapabilities<Authorizers> = Capabilities<Extract<keyof Authorizers, CapabilityKey>>

function pageCapabilities<Data, Authorizers extends CapabilityAuthorizers<Authorizers>>(
    capabilities: CapabilitiesOf<Data, Authorizers> | undefined,
    data: Data,
    session: ServerPageSession,
): PageCapabilities<Authorizers> {
    if (!capabilities) return {} as PageCapabilities<Authorizers>
    return runCapabilities(session, capabilities(data, session))
}

/**
 * Rethrows everything that should not be handled by rendering an error view:
 * Next.js control-flow errors (redirect/notFound) and non-service errors (which belong
 * in the error boundary - they are bugs, not expected failures). Service errors get their
 * conventional treatment: NOT FOUND renders the not-found page and UNAUTHENTICATED sends
 * the user to login. Every other service error is returned for the caller to display.
 */
export async function handleServiceError(error: unknown): Promise<Smorekopp<ErrorCode | AuthStatus>> {
    unstableRethrow(error)
    if (!(error instanceof Smorekopp)) throw error
    if (error.errorCode === 'NOT FOUND') notFound()
    if (error.errorCode === 'UNAUTHENTICATED') redirect(await urlWithCallback('/login'))
    if (error.errorCode === 'UNAUTHORIZED') {
        // A user who has not accepted the terms yet is not turned away but sent to finish
        // registration - the same rule redirectOnUnauthorized enforced.
        const session = await ServerSession.fromNextAuth()
        if (session.user && !session.user.acceptedTerms) redirect(await urlWithCallback('/register'))
    }
    return error
}

/**
 * The given url with the current page as callbackUrl, so the user lands back where they
 * were once they are through it. The current path comes from the header stamped by the proxy
 * (src/proxy.ts) - a server component cannot read its own URL. Should the header be
 * missing, the plain url is used.
 */
async function urlWithCallback(url: string) {
    const currentPath = (await headers()).get(CURRENT_PATH_HEADER)
    return currentPath ? `${url}?${QueryParams.callbackUrl.encodeUrl(currentPath)}` : url
}

/**
 * Builds a page (and its generateMetadata) from a data-loading operation and a renderer,
 * replacing the old pattern of calling read *actions* at the top of pages and unwrapping
 * their ActionReturn into a thrown error. Pages built with this call service operations
 * directly - the operation callback runs inside a service context seeded with the session
 * of the request, so operations called within it pick the session up automatically.
 *
 * Errors from the operation are handled here, not by the Next.js error boundary:
 * a thrown service error renders `ServiceErrorView` in place of the page (except
 * NOT FOUND -> `notFound()` and UNAUTHENTICATED -> redirect to login). Non-service errors
 * still propagate to the error boundary, since they are bugs rather than expected failures.
 * An error thrown by `metadata` or `render` itself is handled the same way - but not one thrown
 * by a server component inside what `render` returns, which only runs after the page has
 * returned.
 *
 * The title returned by `metadata` is also fed to the PageTitle context, so pages built
 * with this never render `PageTitleSetter` themselves.
 *
 * @param operation - Loads everything the page needs. Runs once per request (shared between
 * the page render and generateMetadata via React `cache`). Throwing a service error inside
 * it sends the user to the error view - wrap non-critical calls in {@link withFallback} when
 * a failure should not take the whole page down.
 * @param capabilities - Optional: the authorizers of what the user may do on the page, under
 * `can[Something]` keys, built from the loaded data and the session. They are run against the
 * session and arrive in `render` as `capabilities` under the same keys. They do not guard the
 * page - a failing one only tells `render` to leave out what the user may not do (an edit
 * button, a form). Access to the page itself is decided in `operation`.
 * @param metadata - Optional Next.js metadata from the loaded data. Titles are plain -
 * the root layout's title template appends the site name.
 * @param render - Renders the page from the loaded data, the capabilities and the session.
 *
 * @example
 * const { page, generateMetadata } = serverPage({
 *     operation: async ({ params }: { params: { username: string } }) =>
 *         userOperations.readProfile({ params: { username: params.username } }),
 *     capabilities: (profile) => ({
 *         canUpdate: userAuth.update.data({ username: profile.user.username }),
 *     }),
 *     metadata: (profile) => ({ title: profile.user.username }),
 *     render: ({ data, capabilities }) => (
 *         <div>
 *             {data.user.username}
 *             {capabilities.canUpdate.authorized && <EditButton />}
 *         </div>
 *     ),
 * })
 *
 * export default page
 * export { generateMetadata }
 */
export function serverPage<
    Params extends object,
    Data,
    Authorizers extends CapabilityAuthorizers<Authorizers> = Record<never, never>,
>({ operation, capabilities, metadata, render }: {
    operation: (args: PageOperationArgs<Params>) => Promise<Data>,
    capabilities?: CapabilitiesOf<Data, Authorizers>,
    metadata?: (data: Data) => Metadata,
    render: (args: {
        data: Data,
        capabilities: PageCapabilities<Authorizers>,
        session: ServerPageSession,
    }) => ReactNode | Promise<ReactNode>,
}): {
    page: (props: PageProps<Params>) => Promise<ReactNode>,
    generateMetadata: (props: PageProps<Params>) => Promise<Metadata>,
} {
    // The operation must run at most once per request even though both the page and
    // generateMetadata need its result. React `cache` memoizes per request, but only on
    // argument identity - and Next does not guarantee that the page and generateMetadata
    // receive identical params/searchParams promise instances. Serializing the resolved
    // (JSON-safe) values gives a stable key to memoize on.
    const serializeProps = async ({ params, searchParams }: PageProps<Params>) =>
        JSON.stringify({ params: await params, searchParams: await searchParams })

    const load = cache(async (serializedProps: string) => {
        const { params, searchParams } = JSON.parse(serializedProps) as {
            params: Params,
            searchParams: SearchParams,
        }
        const session = await ServerSession.fromNextAuth()
        const data = await withServiceContext(
            { session },
            false,
            () => operation({ params, searchParams, session })
        )
        return { data, session, capabilities: pageCapabilities(capabilities, data, session) }
    })

    const page = async (props: PageProps<Params>): Promise<ReactNode> => {
        try {
            const loaded = await load(await serializeProps(props))
            const pageTitle = metadata ? metadata(loaded.data).title : undefined
            return (
                <>
                    {typeof pageTitle === 'string' && <PageTitleSetter title={pageTitle} />}
                    {await render(loaded)}
                </>
            )
        } catch (error) {
            return <ServiceErrorView error={await handleServiceError(error)} />
        }
    }

    const generateMetadata = async (props: PageProps<Params>): Promise<Metadata> => {
        if (!metadata) return {}
        try {
            const loaded = await load(await serializeProps(props))
            return metadata(loaded.data)
        } catch (error) {
            await handleServiceError(error)
            return { title: 'Feil' }
        }
    }

    return { page, generateMetadata }
}

/**
 * The arguments a serverLayout operation receives - {@link PageOperationArgs} without the
 * searchParams, which Next.js does not give to layouts.
 */
export type LayoutOperationArgs<Params extends object = object> = {
    params: Params,
    session: ServerPageSession,
}

type LayoutProps<Params extends object> = {
    params: Promise<Params>,
    children: ReactNode,
}

/**
 * serverPage for layouts: builds a layout from a data-loading operation and a renderer. The
 * operation runs inside a service context seeded with the session of the request, and a service
 * error thrown from it is handled as in a page - NOT FOUND renders the not-found page,
 * UNAUTHENTICATED sends the user to login, and every other service error renders
 * `ServiceErrorView` in place of the layout and the pages under it.
 *
 * A layout needs this even when every page under it is built with serverPage: an error thrown
 * by a layout is not caught by the pages it wraps, so an expected service error would otherwise
 * land in the error boundary as if it were a bug.
 *
 * Not for the root layout - it renders the document itself, so it has nothing to show an error
 * view in. It wraps its reads in {@link withFallback} instead.
 *
 * @param operation - Loads everything the layout needs. Throwing a service error inside it
 * shows the error view instead of the layout and its pages.
 * @param capabilities - Optional, as for {@link serverPage}: what the user may do on the layout,
 * run against the session and given to `render` under the same `can[Something]` keys.
 * @param render - Renders the layout around `children` from the loaded data, the capabilities
 * and the session.
 *
 * @example
 * export default serverLayout({
 *     operation: async ({ params }: LayoutOperationArgs<{ category: string }>) =>
 *         articleCategoryOperations.read({ params: { name: decodeURIComponent(params.category) } }),
 *     render: ({ data: category, children }) => <SideBar category={category}>{children}</SideBar>,
 * })
 */
export function serverLayout<
    Params extends object,
    Data,
    Authorizers extends CapabilityAuthorizers<Authorizers> = Record<never, never>,
>({ operation, capabilities, render }: {
    operation: (args: LayoutOperationArgs<Params>) => Promise<Data>,
    capabilities?: CapabilitiesOf<Data, Authorizers>,
    render: (args: {
        data: Data,
        capabilities: PageCapabilities<Authorizers>,
        children: ReactNode,
        session: ServerPageSession,
    }) => ReactNode | Promise<ReactNode>,
}): (props: LayoutProps<Params>) => Promise<ReactNode> {
    return async ({ params, children }) => {
        try {
            const loaded = await withPageSession(async session => {
                const data = await operation({ params: await params, session })
                return { data, session, capabilities: pageCapabilities(capabilities, data, session) }
            })
            return await render({ ...loaded, children })
        } catch (error) {
            return <ServiceErrorView error={await handleServiceError(error)} />
        }
    }
}

/**
 * Marks a service operation call inside a serverPage operation as non-critical: if it fails
 * with a service error the given fallback value is returned instead of the failure taking
 * the whole page to the error view. Next.js control-flow errors and non-service errors
 * still propagate.
 *
 * @param operationPromise - The call that is allowed to fail.
 * @param fallbackValue - What to return in place of its result when it does.
 * @param fallbackOn - Limits the fallback to service errors with one of these codes. Any other
 * service error propagates as if the call was not wrapped. Leave it out to fall back on every
 * service error.
 *
 * @example
 * operation: async ({ params }) => ({
 *     user: await userOperations.read({ params }),
 *     flairs: await withFallback(flairOperations.readForUser({ params }), []),
 *     // Only a missing locker gets the fallback - a visitor without access still gets the error.
 *     locker: await withFallback(lockerOperations.read({ params }), null, ['NOT FOUND']),
 * })
 */
export async function withFallback<Data, Fallback>(
    operationPromise: Promise<Data>,
    fallbackValue: Fallback,
    fallbackOn?: ErrorCode[]
): Promise<Data | Fallback> {
    try {
        return await operationPromise
    } catch (error) {
        unstableRethrow(error)
        if (!(error instanceof Smorekopp)) throw error
        if (fallbackOn && !fallbackOn.some(errorCode => errorCode === error.errorCode)) throw error
        return fallbackValue
    }
}

/**
 * For server components that are neither pages nor layouts (cards rendered inside a page's
 * tree), and for the root layout: loads the session of the request and runs the callback inside
 * a service context seeded with it, so service operations called within pick the session up
 * automatically - the same environment a serverPage operation runs in. Errors are not handled
 * here; wrap calls in {@link withFallback}, catch them with {@link handleServiceError}, or let
 * them hit the error boundary. Layouts use {@link serverLayout}, which handles them.
 */
export async function withPageSession<Result>(
    callback: (session: ServerPageSession) => Promise<Result>
): Promise<Result> {
    const session = await ServerSession.fromNextAuth()
    return withServiceContext({ session }, false, () => callback(session))
}

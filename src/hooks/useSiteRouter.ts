'use client'
import useSiteContext from './useSiteContext'
import { SiteContext } from '@/lib/sites/context'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { ResolveHrefOptions } from '@/lib/sites/context'

type Router = ReturnType<typeof useRouter>
type NavigateOptions = Parameters<Router['push']>[1] & ResolveHrefOptions

/**
 * The router for app paths: push, replace and prefetch take one and go where it is for the domain
 * the visitor is on, the way SiteLink renders a link. The rest of the router is as it is. The
 * router keeps its identity between renders on the same page, as Next's does, for effects that
 * depend on it.
 */
export default function useSiteRouter(): Router {
    const router = useRouter()
    const { domain, path } = useSiteContext()
    return useMemo(() => {
        const context = SiteContext.fromAppPath(domain, path)
        const resolve = (href: string, options?: NavigateOptions) =>
            context.resolveHref(href, { toMainDomainServingSite: options?.toMainDomainServingSite })
        return {
            ...router,
            push: (href, options?: NavigateOptions) => router.push(resolve(href, options), options),
            replace: (href, options?: NavigateOptions) => router.replace(resolve(href, options), options),
            prefetch: (href, options) => router.prefetch(resolve(href), options),
        }
    }, [router, domain, path])
}

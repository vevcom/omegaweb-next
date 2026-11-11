'use client'
import useDomainContext from './useDomainContext'
import { DomainContext } from '@/lib/sites/context'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { ResolveHrefOptions } from '@/lib/sites/context'
import type { AppHref } from '@/lib/sites/href'

type NextRouter = ReturnType<typeof useRouter>
type NavigateOptions = Parameters<NextRouter['push']>[1] & ResolveHrefOptions

/** Next's router, taking app paths where it takes hrefs. */
export type SiteRouter = Omit<NextRouter, 'push' | 'replace' | 'prefetch'> & {
    push: (href: AppHref, options?: NavigateOptions) => void,
    replace: (href: AppHref, options?: NavigateOptions) => void,
    prefetch: (href: AppHref, options?: Parameters<NextRouter['prefetch']>[1]) => void,
}

/**
 * The router for app paths: push, replace and prefetch take one and go where it is for the domain
 * the visitor is on, the way SiteLink renders a link. The rest of the router is as it is. The
 * router keeps its identity between renders on the same page, as Next's does, for effects that
 * depend on it.
 */
export default function useSiteRouter(): SiteRouter {
    const router = useRouter()
    const { domain, path } = useDomainContext()
    return useMemo(() => {
        const context = DomainContext.fromAppPath(domain, path)
        const resolve = (href: AppHref, options?: NavigateOptions) =>
            context.resolveHref(href, {
                toMainDomainServingSite: options?.toMainDomainServingSite,
                servedOn: options?.servedOn,
            })
        return {
            ...router,
            push: (href, options?: NavigateOptions) => router.push(resolve(href, options), options),
            replace: (href, options?: NavigateOptions) => router.replace(resolve(href, options), options),
            prefetch: (href, options) => router.prefetch(resolve(href), options),
        }
    }, [router, domain, path])
}

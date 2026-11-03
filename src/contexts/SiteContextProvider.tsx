'use client'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { SiteContext } from '@/lib/sites/context'
import { createContext } from 'react'
import type { SiteDomain } from '@/lib/sites/domainConfig'
import type { SiteContextData } from '@/lib/sites/context'
import type { ReactNode } from 'react'

type PropTypes = {
    /** The domains in use, so the browser infers sites the way the server does. */
    domains: SiteDomain[],
    /** Where the request that rendered the page was. */
    data: SiteContextData,
    children: ReactNode,
}

/** Not consumed directly: useSiteContext gives the context of the page the visitor is on now. */
export const SiteContextDataContext = createContext<SiteContextData | null>(null)

export default function SiteContextProvider({ domains, data, children }: PropTypes) {
    // Before anything renders a link: the config the server used, in the browser's copy of SiteContext.
    SiteContext.configure(DomainConfig.fromJSON(domains))
    return <SiteContextDataContext.Provider value={data}>{children}</SiteContextDataContext.Provider>
}

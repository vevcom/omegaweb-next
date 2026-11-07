'use client'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { createContext } from 'react'
import type { SiteDomain } from '@/lib/sites/domainConfig'
import type { DomainContextData } from '@/lib/sites/context'
import type { ReactNode } from 'react'

type PropTypes = {
    /** The domains in use, so the browser infers sites the way the server does. */
    domains: SiteDomain[],
    /** Where the request that rendered the page was. */
    data: DomainContextData,
    children: ReactNode,
}

/** Not consumed directly: useDomainContext gives the context of the page the visitor is on now. */
export const DomainContextDataContext = createContext<DomainContextData | null>(null)

export default function DomainContextProvider({ domains, data, children }: PropTypes) {
    // Before anything renders a link: the config the server used, in the browser's copy of DomainContext.
    DomainContext.configure(DomainConfig.fromJSON(domains))
    return <DomainContextDataContext.Provider value={data}>{children}</DomainContextDataContext.Provider>
}

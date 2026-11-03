'use client'
import { SiteContextDataContext } from '@/contexts/SiteContextProvider'
import { SiteContext } from '@/lib/sites/context'
import { usePathname } from 'next/navigation'
import { useContext } from 'react'

/** Where the visitor is: the domain the page was requested on, and the page the browser shows now. */
export default function useSiteContext(): SiteContext {
    const data = useContext(SiteContextDataContext)
    const pathname = usePathname()
    if (!data) throw new Error('useSiteContext needs a SiteContextProvider above it')
    return SiteContext.fromBrowser(data.domain, pathname)
}

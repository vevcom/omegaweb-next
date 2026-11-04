'use client'
import { DomainContextDataContext } from '@/contexts/DomainContextProvider'
import { DomainContext } from '@/lib/sites/context'
import { usePathname } from 'next/navigation'
import { useContext } from 'react'

/** Where the visitor is: the domain the page was requested on, and the page the browser shows now. */
export default function useDomainContext(): DomainContext {
    const data = useContext(DomainContextDataContext)
    const pathname = usePathname()
    if (!data) throw new Error('useDomainContext needs a DomainContextProvider above it')
    return DomainContext.fromBrowser(data.domain, pathname)
}

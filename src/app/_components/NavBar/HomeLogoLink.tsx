'use client'
import { useNavMenu } from '@/contexts/NavMenu'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export default function HomeLogoLink({ className, children }: { className?: string, children: ReactNode }) {
    const pathname = usePathname()
    const { setIsOpen } = useNavMenu()

    return (
        <SiteLink
            className={className}
            href={appHref('/')}
            aria-label={pathname === '/' ? 'Åpne meny' : 'Gå til hjemmesiden'}
            onClick={event => {
                if (pathname !== '/') return
                event.preventDefault()
                setIsOpen(true)
            }}
        >
            {children}
        </SiteLink>
    )
}

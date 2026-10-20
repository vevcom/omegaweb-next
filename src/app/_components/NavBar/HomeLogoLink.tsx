'use client'
import { useNavMenu } from '@/contexts/NavMenu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export default function HomeLogoLink({ className, children }: { className?: string, children: ReactNode }) {
    const pathname = usePathname()
    const { setIsOpen } = useNavMenu()

    return (
        <Link
            className={className}
            href="/"
            aria-label={pathname === '/' ? 'Åpne meny' : 'Gå til hjemmesiden'}
            onClick={event => {
                if (pathname !== '/') return
                event.preventDefault()
                setIsOpen(true)
            }}
        >
            {children}
        </Link>
    )
}

'use client'
import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { authLinks } from '@/pageKits/auth/links'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The login of the career site, coming back to the page it sits on. */
export default function CareersLoginLink({ className }: { className: string }) {
    const pathname = usePathname()
    return <Link href={authLinks(careersAuthPages).login(pathname)} className={className}>Logg inn</Link>
}

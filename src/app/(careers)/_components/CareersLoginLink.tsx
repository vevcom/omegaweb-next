'use client'
import { loginHref } from '@/lib/authPaths'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The login of the career site, coming back to the page it sits on. */
export default function CareersLoginLink({ className }: { className: string }) {
    const pathname = usePathname()
    return <Link href={loginHref(pathname)} className={className}>Logg inn</Link>
}

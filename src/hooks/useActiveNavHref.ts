import { usePathname } from 'next/navigation'

/**
 * The href among `hrefs` that the current page belongs to. That is the longest one the path is at
 * or under, so on /career/job-ads it is /career/job-ads rather than /career.
 */
export default function useActiveNavHref(hrefs: string[]): string | undefined {
    const pathname = usePathname()
    return hrefs
        .filter(href => pathname === href || pathname.startsWith(`${href}/`))
        .sort((one, other) => other.length - one.length)
        .at(0)
}

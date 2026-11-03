import { useDebounce } from '@/hooks/useDebounce'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Returns a debounced setter that writes a search to the `search` query param, keeping the page's
 * other params. The page reads it back from `searchParams`, whether through `useSearchParams` on
 * the client or through its own server-rendered `operation`.
 */
export function useSearchQueryParam(): (search: string) => void {
    const { replace } = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    return useDebounce((search: string) => {
        const params = new URLSearchParams(searchParams)
        if (search) params.set(QueryParams.search.name, search)
        else params.delete(QueryParams.search.name)
        const query = params.toString()
        const url = query ? `${pathname}?${query}` : pathname
        replace(url, { scroll: false })
    }, 300)
}

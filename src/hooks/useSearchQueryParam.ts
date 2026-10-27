import { useDebounce } from '@/hooks/useDebounce'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Returns a debounced setter that writes a search to the `search` query param, keeping the page's
 * other params. By default the page renders again on the server and filters there. With `shallow`
 * only the URL changes, for pages that filter on the client and read the param with
 * `useSearchParams`, since a server render would reset their client state.
 */
export function useSearchQueryParam({ shallow = false }: { shallow?: boolean } = {}): (search: string) => void {
    const { replace } = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    return useDebounce((search: string) => {
        const params = new URLSearchParams(searchParams)
        if (search) params.set(QueryParams.search.name, search)
        else params.delete(QueryParams.search.name)
        const query = params.toString()
        const url = query ? `${pathname}?${query}` : pathname
        if (shallow) window.history.replaceState(null, '', url)
        else replace(url, { scroll: false })
    }, 300)
}

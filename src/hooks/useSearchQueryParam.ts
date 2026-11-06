import { useDebounce } from '@/hooks/useDebounce'
import useSiteRouter from '@/hooks/useSiteRouter'
import useDomainContext from '@/hooks/useDomainContext'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { appHref } from '@/lib/sites/href'
import { useSearchParams } from 'next/navigation'

/**
 * Returns a debounced setter that writes a search to the `search` query param, keeping the page's
 * other params. The page reads it back from `searchParams`, whether through `useSearchParams` on
 * the client or through its own server-rendered `operation`.
 */
export function useSearchQueryParam(): (search: string) => void {
    const router = useSiteRouter()
    // The page's app path without its query, which is rebuilt from the search params below.
    const pagePath = useDomainContext().path.split('?')[0]
    const searchParams = useSearchParams()

    return useDebounce((search: string) => {
        const params = new URLSearchParams(searchParams)
        if (search) params.set(QueryParams.search.name, search)
        else params.delete(QueryParams.search.name)
        const query = params.toString()
        router.replace(appHref(query ? `${pagePath}?${query}` : pagePath), { scroll: false })
    }, 300)
}

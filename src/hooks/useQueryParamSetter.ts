import { useDebounce } from '@/hooks/useDebounce'
import useSiteRouter from '@/hooks/useSiteRouter'
import useDomainContext from '@/hooks/useDomainContext'
import { appHref } from '@/lib/sites/href'
import { useSearchParams } from 'next/navigation'
import type { QueryParam } from '@/lib/queryParams/queryParam'

/**
 * Returns a debounced setter that writes a value to `param`, keeping the page's other params. Null
 * or a value encoding to nothing removes it. The page reads it back from `searchParams`, whether
 * through `useSearchParams` on the client or through its own server-rendered `operation`.
 */
export function useQueryParamSetter<Type>(param: QueryParam<Type>): (value: Type | null) => void {
    const router = useSiteRouter()
    // The page's app path without its query, which is rebuilt from the search params below.
    const pagePath = useDomainContext().path.split('?')[0]
    const searchParams = useSearchParams()

    return useDebounce((value: Type | null) => {
        const params = new URLSearchParams(searchParams)
        const encoded = value === null ? '' : param.encode(value)
        if (encoded) params.set(param.name, encoded)
        else params.delete(param.name)
        const query = params.toString()
        router.replace(appHref(query ? `${pagePath}?${query}` : pagePath), { scroll: false })
    }, 300)
}

'use client'
import TextInput from '@/UI/TextInput'
import { useSearchQueryParam } from '@/hooks/useSearchQueryParam'

type PropTypes = {
    defaultValue: string
    label?: string
}

/**
 * Writes the search to the `search` query param, so the page reads it from `searchParams` and filters on the server.
 */
export default function SearchBar({ defaultValue, label = 'Søk' }: PropTypes) {
    const setSearch = useSearchQueryParam()

    return (
        <span className="flex flex-row flex-nowrap items-center gap-3 w-full p-2 bg-surface-base rounded-round">
            <TextInput
                className="max-w-none! mt-0!"
                name="search"
                type="text"
                onChange={(event) => setSearch(event.target.value)}
                defaultValue={defaultValue}
                label={label}
            />
        </span>
    )
}

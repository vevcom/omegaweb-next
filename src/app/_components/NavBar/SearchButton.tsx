'use client'
import { useGlobalSearch } from '@/contexts/GlobalSearch'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

export default function SearchButton() {
    const { setIsOpen } = useGlobalSearch()

    return (
        <button
            type="button"
            className="group cursor-pointer bg-transparent border-none p-0 flex items-center justify-center size-12"
            aria-label="Søk"
            title="Søk (⌘K / Ctrl+K)"
            onClick={() => setIsOpen(true)}
        >
            <FontAwesomeIcon
                className="size-[30px]! text-text transition-colors duration-300 [&_path]:text-inherit group-hover:text-accent-blue"
                icon={faMagnifyingGlass}
            />
        </button>
    )
}

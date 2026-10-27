'use client'
import { UserListFiltersContext } from '@/contexts/UserListFilters'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilter } from '@fortawesome/free-solid-svg-icons'
import { useContext } from 'react'

type PropTypes = {
    open: boolean,
    onToggle: () => void,
    activeCount: number,
}

/** The mobile-only pill that opens UserList's filters. */
export function FiltersToggleButton({ open, onToggle, activeCount }: PropTypes) {
    return (
        <button
            type="button"
            className="
                hidden
                max-mobile:flex
                header-pill-link border-none px-4
            "
            aria-expanded={open}
            onClick={onToggle}
        >
            <FontAwesomeIcon icon={faFilter} />
            <span>Filtre{activeCount > 0 && ` (${activeCount})`}</span>
        </button>
    )
}

/** The toggle for a page's header, wired to the UserList through UserListFiltersProvider. */
export default function UserListFiltersToggle() {
    const filters = useContext(UserListFiltersContext)
    if (!filters) throw new Error('UserListFiltersToggle must be rendered inside UserListFiltersProvider')

    return (
        <FiltersToggleButton
            open={filters.open}
            onToggle={() => filters.setOpen(!filters.open)}
            activeCount={filters.activeCount}
        />
    )
}

'use client'
import styles from './SearchButton.module.scss'
import { useGlobalSearch } from '@/contexts/GlobalSearch'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

export default function SearchButton() {
    const { setIsOpen } = useGlobalSearch()

    return (
        <button
            type="button"
            className={styles.searchButton}
            aria-label="Søk"
            title="Søk (⌘K / Ctrl+K)"
            onClick={() => setIsOpen(true)}
        >
            <FontAwesomeIcon className={styles.searchPicture} icon={faMagnifyingGlass} />
        </button>
    )
}

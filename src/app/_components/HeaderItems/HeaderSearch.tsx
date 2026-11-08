'use client'
import TextInput from '@/UI/TextInput'
import { useQueryParamSetter } from '@/hooks/useQueryParamSetter'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { searchMaxLength } from '@/services/search/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { ChangeEvent } from 'react'

type PropTypes = {
    defaultValue: string,
    label?: string,
}

/**
 * A search for PageWrapper's header row, written to the `search` query param. On desktop it is an
 * input in the row. On mobile there is no room for that, so it is an icon pill that opens a
 * full-width input under the others.
 */
export default function HeaderSearch({ defaultValue, label = 'Søk' }: PropTypes) {
    const [value, setValue] = useState(defaultValue)
    const [open, setOpen] = useState(defaultValue !== '')
    const setSearch = useQueryParamSetter(QueryParams.search)

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value)
        setSearch(event.target.value)
    }

    const clear = () => {
        setValue('')
        setSearch('')
        setOpen(false)
    }

    return (
        <>
            <TextInput
                compact
                name="search"
                maxLength={searchMaxLength}
                label={label}
                value={value}
                onChange={handleChange}
                className="
                    flex-1 min-w-[200px] mt-0! max-w-[400px]!
                    max-mobile:hidden
                "
            />
            <button
                type="button"
                className="
                    hidden
                    max-mobile:flex
                    header-pill-link border-none px-3.5
                "
                aria-label={label}
                aria-expanded={open}
                onClick={() => setOpen(previous => !previous)}
            >
                <FontAwesomeIcon icon={faMagnifyingGlass} />
            </button>
            {open && (
                <div className="
                    hidden
                    max-mobile:block
                    relative basis-full order-last
                ">
                    <TextInput
                        compact
                        name="search"
                        maxLength={searchMaxLength}
                        label={label}
                        value={value}
                        onChange={handleChange}
                        autoFocus={defaultValue === ''}
                        className="
                            mt-0! max-w-none!
                            [&_input]:pr-10
                        "
                    />
                    <button
                        type="button"
                        className="
                            absolute right-3 top-1/2 -translate-y-1/2 z-3 border-none bg-transparent p-1 cursor-pointer
                            text-base-content/80
                        "
                        aria-label="Tøm søk"
                        onClick={clear}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            )}
        </>
    )
}

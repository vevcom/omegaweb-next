'use client'
import styles from './SearchableDropdown.module.scss'
import { DropdownPanel, useDropdown } from './Dropdown'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import type { PropTypes as DropdownPropTypes } from './Dropdown'
import type { ChangeEvent } from 'react'

export type SearchableDropdownOption<ValueType> = {
    value: ValueType,
    label?: string,
    key?: string,
}

export type PropTypes<ValueType> = Omit<DropdownPropTypes<ValueType>, 'options'> & {
    options: SearchableDropdownOption<ValueType>[],
}

/**
 * A Dropdown whose trigger is a text field, which narrows the options down to the ones whose label
 * contains what is typed.
 */
export default function SearchableDropdown<ValueType extends string | number>({
    name,
    label,
    defaultValue,
    options,
    onChange,
    color = 'black',
    background = 'base',
    className,
    disabled,
}: PropTypes<ValueType>) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredOptions = options.filter(option =>
        (option.label ?? String(option.value)).toLowerCase().includes(searchTerm.toLowerCase())
    )

    const {
        value,
        open,
        setOpen,
        activeIndex,
        setActiveIndex,
        domId,
        ref,
        select,
        openWithActive,
        handleKeyDown,
    } = useDropdown({ listedOptions: filteredOptions, defaultValue, onChange, onClose: () => setSearchTerm('') })

    const selectedOption = options.find(option => option.value === value)

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value)
        setActiveIndex(0)
        if (!open) setOpen(true)
    }

    const displayValue = open
        ? searchTerm
        : (selectedOption?.label ?? (selectedOption ? String(selectedOption.value) : ''))

    return (
        <div
            ref={ref}
            className={
                `${styles.SearchableDropdown} ${styles[color]} ` +
                `${background === 'raised' ? styles.onRaised : ''} ${open ? styles.open : ''} ${className ?? ''}`
            }
        >
            <input
                id={domId}
                type="text"
                className={styles.field}
                autoComplete="off"
                disabled={disabled}
                value={displayValue}
                onFocus={openWithActive}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={`${domId}-listbox`}
            />
            <label htmlFor={domId} className={`${styles.label} ${(open || selectedOption) ? styles.floated : ''}`}>
                {label}
            </label>
            <FontAwesomeIcon icon={faChevronDown} className={styles.chevron} />
            {
                open && (
                    <DropdownPanel
                        options={filteredOptions}
                        value={value}
                        activeIndex={activeIndex}
                        onSelect={select}
                        onActivate={setActiveIndex}
                        emptyText="Ingen treff"
                        id={`${domId}-listbox`}
                    />
                )
            }
            <input type="hidden" name={name} value={value ?? ''} readOnly />
        </div>
    )
}

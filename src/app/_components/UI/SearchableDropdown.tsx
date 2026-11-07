'use client'
import {
    DropdownPanel,
    dropdownChevronClassName,
    dropdownColorClassNames,
    dropdownLabelClassName,
    useDropdown,
} from './Dropdown'
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

export const focusBorderClassNames = {
    black: 'focus:border-accent-blue',
    primary: 'focus:border-accent-blue',
    secondary: 'focus:border-accent-blue',
    red: 'focus:border-accent-red',
    white: 'focus:border-accent-blue',
} as const

export const backgroundClassNames = {
    base: `
        bg-surface-raised
        hover:bg-surface-hover
        focus:bg-surface-hover
    `,
    raised: `
        bg-surface-hover
        hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        focus:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
    `,
} as const

/**
 * A Dropdown whose trigger is a text field, which narrows the options down to the ones whose label
 * contains what is typed.
 */
export default function SearchableDropdown<ValueType extends string | number>({
    name,
    label,
    defaultValue,
    value: controlledValue,
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
    } = useDropdown({
        listedOptions: filteredOptions,
        defaultValue,
        value: controlledValue,
        onChange,
        onClose: () => setSearchTerm(''),
    })

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
                `
                    relative mt-2 w-full max-w-[320px]
                    ${className ?? ''}
                `
            }
        >
            <input
                id={domId}
                type="text"
                className={`
                    w-full border-2 border-transparent rounded-inner outline-0 text-m leading-[calc(var(--text-m)*1.25)]
                    pt-6 pr-10 pb-2 pl-4 transition-[border-color,background-color] duration-300
                    disabled:cursor-not-allowed disabled:opacity-60
                    ${dropdownColorClassNames[color]}
                    ${focusBorderClassNames[color]}
                    ${backgroundClassNames[background]}
                `}
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
            <label htmlFor={domId} className={dropdownLabelClassName(Boolean(open || selectedOption))}>
                {label}
            </label>
            <FontAwesomeIcon icon={faChevronDown} className={`
                ${dropdownChevronClassName(open)}
                pointer-events-none
            `} />
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

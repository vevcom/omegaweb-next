'use client'
import {
    DropdownPanel,
    dropdownChevronClassName,
    dropdownColorClassNames,
    dropdownLabelClassName,
    useDropdown,
} from './Dropdown'
import { backgroundClassNames, focusBorderClassNames } from './SearchableDropdown'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { PropTypes as DropdownPropTypes } from './Dropdown'
import type { SearchableDropdownOption } from './SearchableDropdown'
import type { ChangeEvent } from 'react'

export type PropTypes<ValueType> = Omit<DropdownPropTypes<ValueType>, 'options' | 'defaultValue' | 'value' | 'onChange'> & {
    options: SearchableDropdownOption<ValueType>[],
    defaultValues?: ValueType[],
    onChange?: (values: ValueType[]) => void,
}

/**
 * A SearchableDropdown where several options can be picked. Picking an option toggles it and leaves
 * the panel open, and the picked ones are listed under the field. The form gets one value per picked
 * option under `name`.
 */
export default function MultiSearchableDropdown<ValueType extends string | number>({
    name,
    label,
    defaultValues = [],
    options,
    onChange,
    color = 'black',
    background = 'base',
    className,
    disabled,
}: PropTypes<ValueType>) {
    const [searchTerm, setSearchTerm] = useState('')
    const [values, setValues] = useState<ValueType[]>(defaultValues)

    const filteredOptions = options.filter(option =>
        (option.label ?? String(option.value)).toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggle = (value: ValueType) => {
        const newValues = values.includes(value)
            ? values.filter(selected => selected !== value)
            : [...values, value]
        setValues(newValues)
        onChange?.(newValues)
    }

    const {
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
        onChange: toggle,
        onClose: () => setSearchTerm(''),
        keepOpenOnSelect: true,
    })

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value)
        setActiveIndex(0)
        if (!open) setOpen(true)
    }

    const selectedOptions = values
        .map(value => options.find(option => option.value === value))
        .filter(option => option !== undefined)

    return (
        <div className={`
            mt-2 w-full max-w-[320px]
            ${className ?? ''}
        `}>
            <div ref={ref} className="relative">
                <input
                    id={domId}
                    type="text"
                    className={`
                        w-full border-2 border-transparent rounded-inner outline-0 text-m
                        leading-[calc(var(--text-m)*1.25)] pt-6 pr-10 pb-2 pl-4 transition-[border-color,background-color]
                        duration-300
                        disabled:cursor-not-allowed disabled:opacity-60
                        ${dropdownColorClassNames[color]}
                        ${focusBorderClassNames[color]}
                        ${backgroundClassNames[background]}
                    `}
                    autoComplete="off"
                    disabled={disabled}
                    value={searchTerm}
                    placeholder={open ? 'Søk' : undefined}
                    onFocus={openWithActive}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-controls={`${domId}-listbox`}
                />
                <label htmlFor={domId} className={dropdownLabelClassName(open || searchTerm.length > 0)}>
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
                            value={undefined}
                            selectedValues={values}
                            activeIndex={activeIndex}
                            onSelect={select}
                            onActivate={setActiveIndex}
                            emptyText="Ingen treff"
                            id={`${domId}-listbox`}
                        />
                    )
                }
            </div>
            {selectedOptions.length > 0 && (
                <ul className="flex flex-wrap gap-1 mt-2 list-none p-0">
                    {selectedOptions.map(option => (
                        <li
                            key={option.key ?? String(option.value)}
                            className="flex items-center gap-1 rounded-inner bg-surface-hover py-1 pl-3 pr-1 text-s"
                        >
                            {option.label ?? String(option.value)}
                            <button
                                type="button"
                                className="
                                    flex items-center justify-center size-6 border-none rounded-full bg-transparent
                                    text-text-muted cursor-pointer
                                    hover:text-accent-red
                                "
                                aria-label={`Fjern ${option.label ?? String(option.value)}`}
                                disabled={disabled}
                                onClick={() => toggle(option.value)}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {values.map(value => <input key={value} type="hidden" name={name} value={value} readOnly />)}
        </div>
    )
}

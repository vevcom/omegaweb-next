'use client'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useKeyPress from '@/hooks/useKeyPress'
import { useEffect, useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import type { KeyboardEvent, ReactNode } from 'react'

export type DropdownOption<ValueType> = {
    value: ValueType,
    label?: ReactNode,
    key?: string,
}

export type PropTypes<ValueType> = {
    name: string,
    label: string,
    defaultValue?: ValueType,
    value?: ValueType,
    options: DropdownOption<ValueType>[],
    onChange?: (value: ValueType) => void,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
    className?: string,
    disabled?: boolean,
}

export const dropdownColorClassNames = {
    black: 'text-ink-strong',
    primary: 'text-accent-blue',
    secondary: 'text-text',
    red: 'text-accent-red',
    white: 'text-white',
} as const

export const dropdownLabelClassName = (floated: boolean) => `
    absolute left-4 block text-text-muted transition-all duration-300 pointer-events-none z-1
    ${floated ? 'top-2 text-[length:calc(var(--text-s)*0.85)]' : 'top-1/2 -translate-y-1/2 text-m'}`

export const dropdownChevronClassName = (open: boolean) => `
    absolute right-4 top-1/2 -translate-y-1/2 transition-[translate,rotate,color] duration-300
    ${open ? 'rotate-180 text-accent-blue' : 'text-text-muted'}`

const triggerBackgroundClassNames = {
    base: { closed: `
        bg-surface-raised
        hover:bg-surface-hover
    `, open: 'bg-surface-hover' },
    raised: {
        closed: `
            bg-surface-hover
            hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        `,
        open: `
            bg-surface-hover
            hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        `,
    },
} as const

/**
 * The state and keyboard handling of a dropdown, shared with SearchableDropdown.
 * @param listedOptions - The options in the panel, which are the ones the arrow keys move between.
 * @param onClose - Called every time the panel closes, on top of closing it.
 * @param keepOpenOnSelect - Leaves the panel open after an option is picked, for picking several.
 */
export function useDropdown<ValueType extends string | number>({
    listedOptions,
    defaultValue,
    value: controlledValue,
    onChange,
    onClose,
    keepOpenOnSelect = false,
}: {
    listedOptions: DropdownOption<ValueType>[],
    defaultValue?: ValueType,
    value?: ValueType,
    onChange?: (value: ValueType) => void,
    onClose?: () => void,
    keepOpenOnSelect?: boolean,
}) {
    const [internalValue, setValue] = useState<ValueType | undefined>(defaultValue)
    const value = controlledValue ?? internalValue
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const domId = useId()

    const close = () => {
        setOpen(false)
        onClose?.()
    }
    const ref = useClickOutsideRef(close)
    useKeyPress('Escape', close)

    const select = (option: DropdownOption<ValueType>) => {
        setValue(option.value)
        if (!keepOpenOnSelect) close()
        onChange?.(option.value)
    }

    const openWithActive = () => {
        const startIndex = value !== undefined ? listedOptions.findIndex(option => option.value === value) : -1
        setActiveIndex(startIndex >= 0 ? startIndex : 0)
        setOpen(true)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (listedOptions.length === 0) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) {
                openWithActive()
                return
            }
            setActiveIndex(previousIndex => (previousIndex + 1) % listedOptions.length)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
                openWithActive()
                return
            }
            setActiveIndex(previousIndex => (previousIndex - 1 + listedOptions.length) % listedOptions.length)
        } else if (event.key === 'Enter') {
            if (open && listedOptions[activeIndex]) {
                event.preventDefault()
                select(listedOptions[activeIndex])
            }
        }
    }

    return { value, open, setOpen, activeIndex, setActiveIndex, domId, ref, close, select, openWithActive, handleKeyDown }
}

/**
 * The list of options a dropdown opens, shared with SearchableDropdown. Render it only while the
 * dropdown is open.
 * @param emptyText - Shown in place of the options when there are none. Without it the panel is just empty.
 * @param id - The listbox's id, for the control that opens it to reference with aria-controls.
 * @param selectedValues - Marks several options as selected, in place of `value`.
 */
export function DropdownPanel<ValueType extends string | number>({
    options,
    value,
    activeIndex,
    onSelect,
    onActivate,
    emptyText,
    id,
    selectedValues,
}: {
    options: DropdownOption<ValueType>[],
    value: ValueType | undefined,
    activeIndex: number,
    onSelect: (option: DropdownOption<ValueType>) => void,
    onActivate: (index: number) => void,
    emptyText?: string,
    id?: string,
    selectedValues?: ValueType[],
}) {
    const isSelected = (option: DropdownOption<ValueType>) => (
        selectedValues ? selectedValues.includes(option.value) : option.value === value
    )
    const panelRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        panelRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex])

    return (
        <ul id={id} className="
            absolute top-[calc(100%+var(--gap))] left-0 right-0 z-5 list-none m-0 p-2 max-h-[260px] overflow-y-auto
            rounded-inner bg-surface-hover shadow-soft-hover
        " role="listbox" ref={panelRef}>
            {
                options.length === 0 && emptyText ? (
                    <li className="py-2 px-4 text-text-muted text-s">{emptyText}</li>
                ) : options.map((option, index) => (
                    <li key={option.key ?? String(option.value)}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={isSelected(option)}
                            className={
                                `
                                    w-full flex items-center justify-between gap-2 border-none bg-transparent text-left
                                    text-m py-2 px-4 rounded-[calc(var(--rounding)-1.5*var(--gap))] cursor-pointer
                                    transition-colors duration-300
                                    hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
                                    ${isSelected(option) ? 'text-accent-blue' : 'text-text'}
                                    ${index === activeIndex ? 'bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]' : ''}
                                `
                            }
                            onClick={() => onSelect(option)}
                            onMouseEnter={() => onActivate(index)}
                            data-active={index === activeIndex}
                        >
                            <span>{option.label ?? option.value}</span>
                            {isSelected(option) && <FontAwesomeIcon icon={faCheck} />}
                        </button>
                    </li>
                ))
            }
        </ul>
    )
}

export default function Dropdown<ValueType extends string | number>({
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
    const {
        value,
        open,
        activeIndex,
        setActiveIndex,
        domId,
        ref,
        close,
        select,
        openWithActive,
        handleKeyDown,
    } = useDropdown({ listedOptions: options, defaultValue, value: controlledValue, onChange })

    const selectedOption = options.find(option => option.value === value)

    const handleTriggerClick = () => {
        if (open) {
            close()
        } else {
            openWithActive()
        }
    }

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
            <button
                type="button"
                id={domId}
                className={`
                    relative w-full flex items-center border-2 rounded-inner outline-0 text-m text-left pt-6 pr-10 pb-2
                    pl-4 transition-[border-color,background-color] duration-300 cursor-pointer
                    disabled:cursor-not-allowed disabled:opacity-60
                    ${dropdownColorClassNames[color]}
                    ${open ? 'border-accent-blue' : 'border-transparent'}
                    ${triggerBackgroundClassNames[background][open ? 'open' : 'closed']}
                `}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${domId}-listbox`}
                onClick={handleTriggerClick}
                onKeyDown={handleKeyDown}
            >
                <span
                    className={`
                        overflow-hidden text-ellipsis whitespace-nowrap min-h-[calc(var(--text-m)*1.25)]
                        ${dropdownColorClassNames[color]}
                    `}
                >
                    {selectedOption?.label ?? selectedOption?.value ?? ''}
                </span>
                <FontAwesomeIcon icon={faChevronDown} className={dropdownChevronClassName(open)} />
            </button>
            <label
                htmlFor={domId}
                className={dropdownLabelClassName(Boolean(open || selectedOption))}
            >
                {label}
            </label>
            {
                open && (
                    <DropdownPanel
                        options={options}
                        value={value}
                        activeIndex={activeIndex}
                        onSelect={select}
                        onActivate={setActiveIndex}
                        id={`${domId}-listbox`}
                    />
                )
            }
            <input type="hidden" name={name} value={value ?? ''} readOnly />
        </div>
    )
}

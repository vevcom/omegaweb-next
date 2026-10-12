'use client'
import styles from './Dropdown.module.scss'
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
    options: DropdownOption<ValueType>[],
    onChange?: (value: ValueType) => void,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
    className?: string,
    disabled?: boolean,
}

/**
 * The state and keyboard handling of a dropdown, shared with SearchableDropdown.
 * @param listedOptions - The options in the panel, which are the ones the arrow keys move between.
 * @param onClose - Called every time the panel closes, on top of closing it.
 */
export function useDropdown<ValueType extends string | number>({
    listedOptions,
    defaultValue,
    onChange,
    onClose,
}: {
    listedOptions: DropdownOption<ValueType>[],
    defaultValue?: ValueType,
    onChange?: (value: ValueType) => void,
    onClose?: () => void,
}) {
    const [value, setValue] = useState<ValueType | undefined>(defaultValue)
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
        close()
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
 */
export function DropdownPanel<ValueType extends string | number>({
    options,
    value,
    activeIndex,
    onSelect,
    onActivate,
    emptyText,
    id,
}: {
    options: DropdownOption<ValueType>[],
    value: ValueType | undefined,
    activeIndex: number,
    onSelect: (option: DropdownOption<ValueType>) => void,
    onActivate: (index: number) => void,
    emptyText?: string,
    id?: string,
}) {
    const panelRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        panelRef.current?.querySelector(`.${styles.active}`)?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex])

    return (
        <ul id={id} className={styles.panel} role="listbox" ref={panelRef}>
            {
                options.length === 0 && emptyText ? (
                    <li className={styles.empty}>{emptyText}</li>
                ) : options.map((option, index) => (
                    <li key={option.key ?? String(option.value)}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            className={
                                `${option.value === value ? styles.selected : ''} ` +
                                `${index === activeIndex ? styles.active : ''}`
                            }
                            onClick={() => onSelect(option)}
                            onMouseEnter={() => onActivate(index)}
                        >
                            <span>{option.label ?? option.value}</span>
                            {option.value === value && <FontAwesomeIcon icon={faCheck} />}
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
    } = useDropdown({ listedOptions: options, defaultValue, onChange })

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
                `${styles.Dropdown} ${styles[color]} ` +
                `${background === 'raised' ? styles.onRaised : ''} ${open ? styles.open : ''} ${className ?? ''}`
            }
        >
            <button
                type="button"
                id={domId}
                className={styles.trigger}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${domId}-listbox`}
                onClick={handleTriggerClick}
                onKeyDown={handleKeyDown}
            >
                <span className={styles.value}>{selectedOption?.label ?? selectedOption?.value ?? ''}</span>
                <FontAwesomeIcon icon={faChevronDown} className={styles.chevron} />
            </button>
            <label
                htmlFor={domId}
                className={`${styles.label} ${(open || selectedOption) ? styles.floated : ''}`}
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

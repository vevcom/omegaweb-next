'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useId, type SelectHTMLAttributes } from 'react'

export type PropTypes<ValueType> = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
    name: string,
    label?: string,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
    onChange?: (value: ValueType) => void,
    options: {
        value: ValueType,
        label?: string,
        key?: string,
    }[],
} & ({
    value?: ValueType,
} | {
    defaultValue?: ValueType,
})

// A <select> always has a selection, so the label sits permanently in the floated position.
const fieldClassName = [
    'peer appearance-none relative w-full flex items-center border-2 border-transparent rounded-inner outline-0 text-m',
    // Matches the min-height Dropdown gives its value span, so the two are the same height side by side.
    'leading-[calc(var(--text-m)*1.25)] text-left pt-6 pr-10 pb-2 pl-4',
    'transition-[border-color,background-color] duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
    // The popup list is drawn by the browser; without these it falls back to a white menu.
    '[&_option]:bg-surface-raised [&_option]:text-text',
].join(' ')

const colorClassNames = {
    black: { field: 'text-ink-strong focus:border-accent-blue', accent: 'peer-focus:text-accent-blue' },
    primary: { field: 'text-accent-blue focus:border-accent-blue', accent: 'peer-focus:text-accent-blue' },
    secondary: { field: 'text-text focus:border-accent-blue', accent: 'peer-focus:text-accent-blue' },
    red: { field: 'text-accent-red focus:border-accent-red', accent: 'peer-focus:text-accent-red' },
    white: { field: 'text-white focus:border-accent-blue', accent: 'peer-focus:text-accent-blue' },
} as const

const backgroundClassNames = {
    base: 'bg-surface-raised hover:bg-surface-hover focus:bg-surface-hover',
    raised: [
        'bg-surface-hover hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]',
        'focus:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]',
    ].join(' '),
} as const

export function SelectConstructor<ValueType extends string | number>(valueConverter: (value: string) => ValueType) {
    return function Select({
        name,
        label,
        defaultValue,
        value,
        options,
        onChange,
        color = 'black',
        background = 'base',
        className,
        id,
        ...props
    }: PropTypes<ValueType>) {
        const domId = useId()
        const selectId = id ?? domId

        return (
            <div
                className={
                    `relative w-full max-w-[320px] mt-2 ${className ?? ''}`
                }
            >
                <select
                    {...props}
                    id={selectId}
                    name={name}
                    className={`${fieldClassName} ${colorClassNames[color].field} ${backgroundClassNames[background]}`}
                    {
                        ...(value ? { value } : { defaultValue })
                    }
                    onChange={(event) => {
                        if (onChange && options.length > 0) {
                            onChange(valueConverter(event.target.value))
                        }
                    }
                    }
                >
                    {
                        options.map(option =>
                            <option
                                key={option.key ?? option.value}
                                value={option.value}
                            >
                                {option.label ?? option.value}
                            </option>
                        )
                    }
                </select>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={[
                        'absolute right-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-300',
                        'pointer-events-none', colorClassNames[color].accent,
                    ].join(' ')}
                />
                <label
                    htmlFor={selectId}
                    className={[
                        'absolute left-4 top-2 block text-[length:calc(var(--text-s)*0.85)] text-text-muted',
                        'transition-all duration-300 pointer-events-none z-1', colorClassNames[color].accent,
                    ].join(' ')}
                >{label ?? name}</label>
            </div>
        )
    }
}

export const SelectString = SelectConstructor((value: string) => value)
export const SelectNumber = SelectConstructor((value: string) => Number(value))
export const SelectNumberPossibleNULL = SelectConstructor<number | 'NULL'>(
    (value: string) => (value === 'NULL' ? 'NULL' : Number(value))
)

'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useId, type SelectHTMLAttributes } from 'react'

export type PropTypes<ValueType> = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
    name: string,
    label?: string,
    color?: 'base' | 'primary' | 'secondary' | 'error',
    background?: 'base100' | 'base200',
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

const colorClassNames = {
    base: { field: `
        text-base-content
        focus:border-base-content
    `, accent: 'peer-focus:text-base-content' },
    primary: { field: `
        text-primary
        focus:border-primary
    `, accent: 'peer-focus:text-primary' },
    secondary: { field: `
        text-secondary
        focus:border-secondary
    `, accent: 'peer-focus:text-secondary' },
    error: { field: `
        text-error
        focus:border-error
    `, accent: 'peer-focus:text-error' },
} as const

const backgroundClassNames = {
    base100: `
        bg-base-100
        hover:bg-base-200
        focus:bg-base-200
    `,
    base200: `
        bg-base-200
        hover:bg-base-300
        focus:bg-base-300
    `,
} as const

export function SelectConstructor<ValueType extends string | number>(valueConverter: (value: string) => ValueType) {
    return function Select({
        name,
        label,
        defaultValue,
        value,
        options,
        onChange,
        color = 'base',
        background = 'base200',
        className,
        id,
        ...props
    }: PropTypes<ValueType>) {
        const domId = useId()
        const selectId = id ?? domId

        return (
            <div
                className={
                    `
                        relative w-full max-w-[320px] mt-2
                        ${className ?? ''}
                    `
                }
            >
                <select
                    {...props}
                    id={selectId}
                    name={name}
                    className={`
                        peer appearance-none relative w-full flex items-center border border-base-300
                        focus:ring-3 focus:ring-primary/25
                        rounded-inner outline-0 text-m leading-[calc(var(--text-m)*1.25)] text-left pt-6 pr-10 pb-2.5 pl-4
                        transition-[border-color,background-color,box-shadow] duration-300 cursor-pointer
                        disabled:cursor-not-allowed disabled:opacity-60
                        [&_option]:bg-base-200 [&_option]:text-base-content
                        ${colorClassNames[color].field}
                        ${backgroundClassNames[background]}
                    `}
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
                    className={`
                        absolute right-4 top-1/2 -translate-y-1/2 text-base-content/80 transition-colors duration-300
                        pointer-events-none
                        ${colorClassNames[color].accent}
                    `}
                />
                <label
                    htmlFor={selectId}
                    className={`
                        absolute left-4 top-2 block text-[length:calc(var(--text-s)*0.85)] text-base-content/80
                        transition-all duration-300 pointer-events-none z-1
                        ${colorClassNames[color].accent}
                    `}
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

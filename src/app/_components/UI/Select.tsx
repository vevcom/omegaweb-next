'use client'
import styles from './Select.module.scss'
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
                    `${styles.Select} ${styles[color]} ` +
                    `${background === 'raised' ? styles.onRaised : ''} ${className ?? ''}`
                }
            >
                <select
                    {...props}
                    id={selectId}
                    name={name}
                    className={styles.field}
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
                <FontAwesomeIcon icon={faChevronDown} className={styles.chevron} />
                <label htmlFor={selectId} className={styles.labe}>{label ?? name}</label>
            </div>
        )
    }
}

export const SelectString = SelectConstructor((value: string) => value)
export const SelectNumber = SelectConstructor((value: string) => Number(value))
export const SelectNumberPossibleNULL = SelectConstructor<number | 'NULL'>(
    (value: string) => (value === 'NULL' ? 'NULL' : Number(value))
)

import type { ReactNode } from 'react'

export type PropTypes<ValueType extends string | number> = {
    name: string,
    value: ValueType,
    onChange: (newValue: ValueType) => void,
    options: {
        value: ValueType,
        label: ReactNode,
    }[],
    className?: string,
}

/**
 * A horizontal group of options that looks like n Buttons stitched together, with the selected
 * option filled in the primary color and the rest in the secondary color. Functions like a
 * radio group: exactly one option is selected at a time.
 */
export default function HorizontalSelector<ValueType extends string | number>({
    name,
    value,
    onChange,
    options,
    className,
}: PropTypes<ValueType>) {
    return <div className={`
        inline-flex rounded-inner overflow-hidden
        [&_input[type=radio]]:hidden
        ${className ?? ''}
    `}>
        {options.map(option => {
            const id = `${name}-${option.value}`
            return <label
                key={option.value}
                htmlFor={id}
                className={`
                    ${value === option.value ? 'btn' : 'secondary-btn'}
                    flex items-center justify-center flex-1 m-0 rounded-none cursor-pointer font-normal leading-normal
                    not-last:border-r not-last:border-surface-subtle
                `}
            >
                <input
                    type="radio"
                    id={id}
                    name={name}
                    value={option.value}
                    checked={value === option.value}
                    onChange={() => onChange(option.value)}
                />
                {option.label}
            </label>
        })}
    </div>
}

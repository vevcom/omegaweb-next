import CheckboxFieldPresent from './CheckboxFieldPresent'
import { useId } from 'react'
import type { PropTypes as TextInputPropTypes } from './TextInput'

type PropTypes = Omit<TextInputPropTypes, 'type'>

const checkedColorClassNames = {
    base: 'peer-checked:bg-base-content',
    primary: 'peer-checked:bg-primary',
    secondary: 'peer-checked:bg-secondary',
    error: 'peer-checked:bg-error',
} as const

/**
 * This is really a regular checkbox styled as a slider
 * @param label - The label for the slider
 * @param name - The name of the slider. Without one it posts nothing, for a slider that is part of a larger field.
 * @returns
 */
export default function Slider({ label, name, color = 'primary', ...props }: PropTypes) {
    const domId = useId()

    return (
        <label
            className="
                relative inline-block w-[60px] h-[34px] mt-[calc(var(--text-m)+.2em)]
                [&_input]:opacity-0 [&_input]:w-0 [&_input]:h-0
            "
        >
            <p className="whitespace-nowrap text-m absolute top-[calc(-1*var(--text-m)-.2em)]">{label}</p>
            <input
                type="checkbox"
                name={name}
                {...props}
                id={props.id ?? (name ? `id_for_${name}` : domId)}
                className={`
                    peer
                    ${props.className ?? ''}
                `}
            />
            <div className={`
                w-[60px] absolute cursor-pointer inset-0 bg-base-300 transition-all duration-400 rounded-[34px]
                before:absolute before:h-[26px] before:w-[26px] before:left-[4px] before:bottom-[4px] before:bg-white
                before:transition-all before:duration-400 before:rounded-full
                peer-checked:before:translate-x-[26px]
                ${checkedColorClassNames[color]}
            `} />
            {name && <CheckboxFieldPresent name={name} />}
        </label>
    )
}

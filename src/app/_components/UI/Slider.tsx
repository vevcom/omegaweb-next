import CheckboxFieldPresent from './CheckboxFieldPresent'
import type { PropTypes as TextInputPropTypes } from './TextInput'

type PropTypes = Omit<TextInputPropTypes, 'type'> & { name: string }

const checkedColorClassNames = {
    secondary: 'peer-checked:bg-surface-base',
    primary: 'peer-checked:bg-accent-blue',
    red: 'peer-checked:bg-accent-red',
    green: 'peer-checked:bg-accent-green',
    white: 'peer-checked:bg-white',
    black: 'peer-checked:bg-black',
} as const

/**
 * This is really a regular checkbox styled as a slider
 * @param label - The label for the slider
 * @param name - The name of the slider
 * @returns
 */
export default function Slider({ label, name, color = 'primary', ...props }: PropTypes) {
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
                id={props.id ?? `id_for_${name}`}
                className={`
                    peer
                    ${props.className ?? ''}
                `}
            />
            <div className={`
                w-[60px] absolute cursor-pointer inset-0 bg-surface-raised transition-all duration-400 rounded-[34px]
                before:absolute before:h-[26px] before:w-[26px] before:left-[4px] before:bottom-[4px] before:bg-white
                before:transition-all before:duration-400 before:rounded-full
                peer-checked:before:translate-x-[26px]
                ${checkedColorClassNames[color]}
            `} />
            <CheckboxFieldPresent name={name} />
        </label>
    )
}

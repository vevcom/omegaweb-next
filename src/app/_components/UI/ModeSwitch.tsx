'use client'
import { motion } from 'framer-motion'
import { useId } from 'react'

type PropTypes<ValueType extends string> = {
    options: {
        value: ValueType,
        label: string,
    }[],
    value: ValueType,
    onChange: (newValue: ValueType) => void,
    /** For a switch inside a field of a form, where the full size would outweigh what it switches. */
    compact?: boolean,
}

/**
 * A segmented switch between a small set of options. The active option's background is a
 * single shared element (framer-motion layoutId) that slides to its new position, rather
 * than a class swap on each button.
 */
export default function ModeSwitch<ValueType extends string>({
    options,
    value,
    onChange,
    compact = false,
}: PropTypes<ValueType>) {
    const layoutId = useId()

    return (
        <div className={`
            inline-flex items-center gap-1 p-1 bg-base-300 rounded-(--gap)
            ${compact ? 'self-start h-10' : `
                h-14 mt-2
                max-mobile:w-full
            `}
        `}>
            {options.map(option => {
                const active = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={`
                            h-full relative border-none bg-transparent m-0 cursor-pointer transition-colors duration-300
                            ${compact ? 'py-1 px-3 text-s' : `
                                py-2 px-4 text-m
                                max-mobile:flex-1
                            `}
                            ${active ? 'text-primary-content' : `
                                text-base-content
                                hover:text-base-content/80
                            `}
                        `}
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                    >
                        {active && (
                            <motion.span
                                layoutId={layoutId}
                                className="absolute inset-0 z-0 bg-primary rounded-[calc(0.5*var(--gap))]"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                            />
                        )}
                        <span className="relative z-1">{option.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

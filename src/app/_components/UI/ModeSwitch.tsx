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
}

/**
 * A segmented switch between a small set of options. The active option's background is a
 * single shared element (framer-motion layoutId) that slides to its new position, rather
 * than a class swap on each button.
 */
export default function ModeSwitch<ValueType extends string>({ options, value, onChange }: PropTypes<ValueType>) {
    const layoutId = useId()

    return (
        <div className="
            inline-flex items-center gap-1 p-1 bg-surface-hover rounded-(--gap) h-14 mt-2
            max-mobile:w-full
        ">
            {options.map(option => {
                const active = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={`
                            h-full relative border-none bg-transparent m-0 py-2 px-4 text-m cursor-pointer
                            transition-colors duration-300
                            max-mobile:flex-1
                            ${active ? 'text-text-inv' : `
                                text-text
                                hover:text-ink-hover
                            `}
                        `}
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                    >
                        {active && (
                            <motion.span
                                layoutId={layoutId}
                                className="absolute inset-0 z-0 bg-accent-blue rounded-[calc(0.5*var(--gap))]"
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

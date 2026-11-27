export type ButtonLooks = {
    /** Named for the theme colour it is drawn in. */
    color?: 'primary' | 'neutral' | 'success' | 'error',
    /**
     * `text` reads as a link, for an action inside a row or next to a heading, where a filled button is
     * too much. `icon` is a square holding one icon, for a toolbar or the corner of what it acts on.
     */
    variant?: 'filled' | 'text' | 'icon',
    /** `s` is for a button among others in a row or a toolbar. A text button has one size. */
    size?: 'm' | 's',
    className?: string,
}

const filledColorClassNames = {
    primary: 'btn-primary',
    neutral: 'btn-neutral',
    success: 'btn-success',
    error: 'btn-error',
} as const

const textColorClassNames = {
    primary: 'text-primary',
    neutral: 'text-base-content',
    success: 'text-success',
    error: 'text-error',
} as const

/**
 * The classes of a button, for what looks like one without being a `Button`: a link, through
 * `ButtonLink`, or the button a component draws itself, such as the one that opens a `PopUp`.
 */
export function buttonClassName({ color = 'primary', variant = 'filled', size = 'm', className = '' }: ButtonLooks = {}) {
    if (variant === 'text') {
        return `
            shrink-0 border-none bg-transparent p-0 text-s cursor-pointer
            enabled:hover:underline
            disabled:text-base-content/80 disabled:cursor-not-allowed
            ${textColorClassNames[color]}
            ${className}
        `
    }
    if (variant === 'icon') {
        return `
            shrink-0 grid place-items-center rounded-inner border-none bg-transparent cursor-pointer
            enabled:hover:bg-base-content/10
            disabled:opacity-40 disabled:cursor-not-allowed
            aria-pressed:bg-primary aria-pressed:text-primary-content
            ${size === 's' ? 'size-6' : 'size-8'}
            ${textColorClassNames[color]}
            ${className}
        `
    }
    return `
        ${filledColorClassNames[color]}
        ${size === 's' ? 'py-2 px-4 text-s' : ''}
        ${className}
        disabled:bg-base-300 disabled:text-base-content/80
    `
}

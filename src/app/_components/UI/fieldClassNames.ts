/** What every form field shares, so they sit alike in a form whatever kind of control they hold. */

/** The box a field stands in: its width and its distance to the field above. */
export const fieldWrapperClassName = 'relative mt-2 w-full max-w-[320px]'

export type FieldColor = 'base' | 'primary' | 'secondary' | 'error'

/** The colour of what is written in a field and of its edge and label while it has focus. */
export const fieldColorClassNames = {
    base: { field: `
        text-base-content
        focus:border-base-content
    `, label: 'peer-focus:text-base-content' },
    primary: { field: `
        text-primary
        focus:border-primary
    `, label: 'peer-focus:text-primary' },
    secondary: { field: `
        text-secondary
        focus:border-secondary
    `, label: 'peer-focus:text-secondary' },
    error: { field: `
        text-error
        focus:border-error
    `, label: 'peer-focus:text-error' },
} as const satisfies Record<FieldColor, { field: string, label: string }>

/** The surface a field is drawn as, named for the one it rests on getting one step lighter on hover and focus. */
export type FieldBackground = 'base100' | 'base200' | 'base300'

/** For a control that takes focus itself. */
export const fieldBackgroundClassNames = {
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
    base300: `
        bg-base-300
        hover:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
        focus:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
    `,
} as const satisfies Record<FieldBackground, string>

/** For a surface beside a hidden control that takes the focus, marked `peer`. */
export const fieldPeerBackgroundClassNames = {
    base100: `
        bg-base-100
        hover:bg-base-200
        peer-focus:bg-base-200
    `,
    base200: `
        bg-base-200
        hover:bg-base-300
        peer-focus:bg-base-300
    `,
    base300: `
        bg-base-300
        hover:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
        peer-focus:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
    `,
} as const satisfies Record<FieldBackground, string>

import type { ComponentProps } from 'react'

/** The surfaces a card can be drawn as, with the class that draws each. */
export const cardClassNames = {
    base100: 'bg-base-100 rounded-round p-(--card-padding)',
    base200: 'bg-base-200 rounded-round p-(--card-padding)',
    base300: 'bg-base-300 rounded-round p-(--card-padding)',
} as const

type PropTypes = ComponentProps<'div'> & {
    surface?: keyof typeof cardClassNames,
}

/** A rounded surface with the house padding, for a part of a page that stands on its own. */
export default function Card({ surface = 'base100', className, ...props }: PropTypes) {
    return <div
        className={`
            ${cardClassNames[surface]}
            ${className ?? ''}
        `}
        {...props}
    />
}

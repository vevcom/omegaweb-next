import { buttonClassName } from './buttonClassName'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { ButtonLooks } from './buttonClassName'
import type { ComponentProps } from 'react'

/** A link that looks like a `Button`, for where pressing it leads to a page and does nothing else. */
export default function ButtonLink({
    color,
    variant,
    size,
    className,
    ...props
}: ComponentProps<typeof SiteLink> & ButtonLooks) {
    return <SiteLink className={buttonClassName({ color, variant, size, className })} {...props} />
}

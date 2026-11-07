import SiteLink from '@/components/SiteLink/SiteLink'
import type { AppHref, ExternalHref } from '@/lib/sites/href'

type PropTypes = {
    href: AppHref | ExternalHref,
    name: string,
}

function Item({ href, name }: PropTypes) {
    return (
        <SiteLink href={href} className="
            inline-block relative text-text no-underline
            after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-accent-blue after:scale-x-0
            after:origin-bottom-right after:transition-transform after:duration-250 after:ease-out
            hover:after:scale-x-100 hover:after:origin-bottom-left
        ">
            <div>{name}</div>
        </SiteLink>
    )
}

export default Item

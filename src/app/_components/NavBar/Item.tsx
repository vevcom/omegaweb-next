import Link from 'next/link'

type PropTypes = {
    href: string,
    name: string,
}

function Item({ href, name }: PropTypes) {
    return (
        <Link href={href} className="
            inline-block relative text-text no-underline
            after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-accent-blue after:scale-x-0
            after:origin-bottom-right after:transition-transform after:duration-250 after:ease-out
            hover:after:scale-x-100 hover:after:origin-bottom-left
        ">
            <div>{name}</div>
        </Link>
    )
}

export default Item

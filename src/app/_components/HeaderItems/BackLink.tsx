import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

type PropTypes = {
    href: string,
    label: string,
}

export default function BackLink({ href, label }: PropTypes) {
    return (
        <Link href={href} className="
            header-pill-link pr-5 pl-3.5
            [&_span]:overflow-hidden [&_span]:text-ellipsis
        ">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{label}</span>
        </Link>
    )
}

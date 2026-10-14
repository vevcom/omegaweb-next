import HeaderItemLink from './HeaderItemLink'
import { faArchive } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    href: string
}

/** A header item link to a page's archive. */
export default function ArchiveLink({ href }: PropTypes) {
    return <HeaderItemLink href={href} label="Arkiv" icon={faArchive} />
}

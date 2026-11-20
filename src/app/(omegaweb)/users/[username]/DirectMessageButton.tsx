import Button from '@/components/UI/Button'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments } from '@fortawesome/free-solid-svg-icons'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    /** The chat page the button opens. Null for a user who is not on the chat. */
    href: AppHref | null,
    firstname: string,
}

/** The profile's way over to a direct message with its user, greyed out for a user who is not on the chat. */
export default function DirectMessageButton({ href, firstname }: PropTypes) {
    const content = <>
        <FontAwesomeIcon icon={faComments} />
        <p className="w-[8em]">Send melding</p>
    </>

    if (href === null) {
        return (
            <div className="flex flex-col items-center">
                <Button disabled className="flex! items-center! gap-[0.5em]! cursor-not-allowed!">{content}</Button>
                <p className="m-0 text-s text-base-content/80">{firstname} er ikke på chatten</p>
            </div>
        )
    }
    return (
        <SiteLink href={href}>
            <Button className="flex! items-center! gap-[0.5em]!">{content}</Button>
        </SiteLink>
    )
}

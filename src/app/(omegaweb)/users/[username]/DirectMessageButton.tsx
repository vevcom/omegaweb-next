import Button from '@/components/UI/Button'
import SiteLink from '@/components/SiteLink/SiteLink'
import { externalHref } from '@/lib/sites/href'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    /** Where the chat opens a direct message with the user. Null for a user who is not on the chat. */
    url: string | null,
    firstname: string,
}

/** The profile's way over to a direct message with its user on the chat, greyed out for a user who is not there. */
export default function DirectMessageButton({ url, firstname }: PropTypes) {
    const content = <>
        <FontAwesomeIcon icon={faComments} />
        <p className="w-[8em]">Send melding</p>
    </>

    if (url === null) {
        return (
            <div className="flex flex-col items-center">
                <Button disabled className="flex! items-center! gap-[0.5em]! cursor-not-allowed!">{content}</Button>
                <p className="m-0 text-s text-base-content/80">{firstname} er ikke på chatten</p>
            </div>
        )
    }
    return (
        <SiteLink href={externalHref(url)} target="_blank">
            <Button className="flex! items-center! gap-[0.5em]!">{content}</Button>
        </SiteLink>
    )
}

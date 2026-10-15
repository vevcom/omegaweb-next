import { faTag } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { EventTag } from '@/prisma-generated-pn-types'

type PropTypes = {
    eventTag: EventTag
}

export default function SmallEventTag({ eventTag }: PropTypes) {
    return (
        <div className={[
            'relative [&_svg]:size-[1.5em] [&_p]:absolute',
            '[&_p]:left-6 [&_p]:top-0 [&_p]:hidden hover:[&_p]:block',
        ].join(' ')} style={{
            color: `rgb(${eventTag.colorR}, ${eventTag.colorG}, ${eventTag.colorB})`
        }}>
            <FontAwesomeIcon icon={faTag} />
            <p>{eventTag.name}</p>
        </div>
    )
}

import SiteLink from '@/components/SiteLink/SiteLink'

import { externalHref } from '@/lib/sites/href'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faXTwitter,
    faFacebookSquare,
    faInstagram
} from '@fortawesome/free-brands-svg-icons'

function SocialIcons() {
    return (
        <>
            <SiteLink href={externalHref('https://twitter.com/OmegaVevcom')} target="_blank">
                <FontAwesomeIcon icon={faXTwitter} />
            </SiteLink>
            <SiteLink href={externalHref('https://www.facebook.com/SctOmegaBroderskab/')} target="_blank">
                <FontAwesomeIcon icon={faFacebookSquare} />
            </SiteLink>
            <SiteLink href={externalHref('https://www.instagram.com/sctomega/')} target="_blank">
                <FontAwesomeIcon icon={faInstagram} />
            </SiteLink>
        </>
    )
}

export default SocialIcons

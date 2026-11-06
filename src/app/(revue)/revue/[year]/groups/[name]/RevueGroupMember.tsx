import RevueGroupMemberEditor from './RevueGroupMemberEditor'
import { omegaLinks } from '@/app/(omegaweb)/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { ExpandedRevueGroupMember } from '@/services/revue/groups/types'

type PropTypes = {
    member: ExpandedRevueGroupMember,
    capabilities: Capabilities<'canEdit' | 'canReadProfile'>,
}

/**
 * The page is public while the profile of a user is not, so the link is only there for those who
 * may follow it. The editor gets the linked user, so it is only rendered for those who may edit.
 */
export default function RevueGroupMember({ member, capabilities }: PropTypes) {
    return (
        <li className="flex items-center gap-2 py-1">
            {member.user && capabilities.canReadProfile.authorized
                ? <SiteLink href={omegaLinks.user(member.user)}>{member.name}</SiteLink>
                : member.name}
            {capabilities.canEdit.authorized && <RevueGroupMemberEditor member={member} />}
        </li>
    )
}

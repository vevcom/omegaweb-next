'use client'
import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import useAuthorizer from '@/hooks/useAuthorizer'
import { committeeParticipationAuth } from '@/services/applications/committeeParticipation/auth'
import { appHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { faCog, faHome, faInfo, faScroll, faUsers } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    shortName: string,
    groupId: number,
}

export default function Nav({ shortName, groupId }: PropTypes) {
    const canReadCommitteeApplication = useAuthorizer({
        authorizer: committeeParticipationAuth.readAll.data({ groupId }),
    }).authorized

    const adminPath = appHref(`/committees/${shortName}/admin`)
    const readPeriodesPath = appHref(`/committees/${shortName}/application-periods`)
    const membersPath = appHref(`/committees/${shortName}/members`)
    const aboutPath = appHref(`/committees/${shortName}/about`)

    return (
        <SubPageNavBar>
            <SubPageNavBarItem icon={faHome} href={omegaLinks.committee({ shortName })}>Forside</SubPageNavBarItem>
            <SubPageNavBarItem icon={faCog} href={adminPath}>Innstillinger</SubPageNavBarItem>
            {canReadCommitteeApplication &&
                <SubPageNavBarItem icon={faScroll} href={readPeriodesPath}>Søknadsperioder</SubPageNavBarItem>
            }
            <SubPageNavBarItem icon={faUsers} href={membersPath}>Medlemmer</SubPageNavBarItem>
            <SubPageNavBarItem icon={faInfo} href={aboutPath}>Om</SubPageNavBarItem>
        </SubPageNavBar>
    )
}

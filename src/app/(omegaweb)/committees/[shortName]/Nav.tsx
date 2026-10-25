'use client'
import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import useAuthorizer from '@/hooks/useAuthorizer'
import { committeeParticipationAuth } from '@/services/applications/committeeParticipation/auth'
import { faCog, faHome, faInfo, faScroll, faUsers } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    shortName: string,
    groupId: number,
}

export default function Nav({ shortName, groupId }: PropTypes) {
    const canReadCommitteeApplication = useAuthorizer({
        authorizer: committeeParticipationAuth.readAll.data({ groupId }),
    }).authorized

    const adminPath = `/committees/${shortName}/admin`
    const readPeriodesPath = `/committees/${shortName}/application-periods`
    const membersPath = `/committees/${shortName}/members`
    const aboutPath = `/committees/${shortName}/about`

    return (
        <SubPageNavBar>
            <SubPageNavBarItem icon={faHome} href={`/committees/${shortName}`}>Forside</SubPageNavBarItem>
            <SubPageNavBarItem icon={faCog} href={adminPath}>Innstillinger</SubPageNavBarItem>
            {canReadCommitteeApplication &&
                <SubPageNavBarItem icon={faScroll} href={readPeriodesPath}>Søknadsperioder</SubPageNavBarItem>
            }
            <SubPageNavBarItem icon={faUsers} href={membersPath}>Medlemmer</SubPageNavBarItem>
            <SubPageNavBarItem icon={faInfo} href={aboutPath}>Om</SubPageNavBarItem>
        </SubPageNavBar>
    )
}

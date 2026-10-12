'use client'
import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import useAuthorizer from '@/hooks/useAuthorizer'
import { committeeParticipationAuth } from '@/services/applications/committeeParticipation/auth'
import { faArrowLeft, faCog, faInfo, faScroll, faUsers } from '@fortawesome/free-solid-svg-icons'
import { usePathname } from 'next/navigation'

type PropTypes = {
    shortName: string,
    groupId: number,
}

export default function Nav({ shortName, groupId }: PropTypes) {
    const pathname = usePathname()
    const canReadCommitteeApplication = useAuthorizer({
        authorizer: committeeParticipationAuth.readAll.data({ groupId }),
    }).authorized

    const adminPath = `/committees/${shortName}/admin`
    const readPeriodesPath = `/committees/${shortName}/applicationPeriods`
    const membersPath = `/committees/${shortName}/members`
    const aboutPath = `/committees/${shortName}/about`

    return (
        <SubPageNavBar>
            <SubPageNavBarItem icon={faCog} href={adminPath}>Innstillinger</SubPageNavBarItem>
            {canReadCommitteeApplication &&
                <SubPageNavBarItem icon={faScroll} href={readPeriodesPath}>Søknadsperioder</SubPageNavBarItem>
            }
            <SubPageNavBarItem icon={faUsers} href={membersPath}>Medlemmer</SubPageNavBarItem>
            <SubPageNavBarItem icon={faInfo} href={aboutPath}>Om</SubPageNavBarItem>
            <SubPageNavBarItem icon={faArrowLeft} href={
                pathname === `/committees/${shortName}` ? '/committees' : `/committees/${shortName}`
            }>
                Tilbake
            </SubPageNavBarItem>
        </SubPageNavBar>
    )
}

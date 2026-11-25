'use client'
import { careerLinks } from '@/app/(careers)/links'
import SiteLink from '@/components/SiteLink/SiteLink'

export default function CompanyUserEmailVerified({ account }: { account: { email: string } }) {
    return <>
        <h1>E-postadressen er bekreftet</h1>
        <p>Du logger inn med {account.email} fra nå av.</p>
        <SiteLink href={careerLinks.frontpage()}>Fortsett</SiteLink>
    </>
}

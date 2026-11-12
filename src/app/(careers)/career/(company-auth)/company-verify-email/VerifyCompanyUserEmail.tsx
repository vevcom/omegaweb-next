'use client'
import { careerLinks } from '@/app/(careers)/links'
import Form from '@/components/Form/Form'
import SiteLink from '@/components/SiteLink/SiteLink'
import { verifyCompanyUserEmailAction } from '@/services/careers/companies/users/account/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'

/** The button confirming the email of the link, and then where to go from there. */
export default function VerifyCompanyUserEmail({ token }: { token: string }) {
    const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)

    if (verifiedEmail === null) {
        return (
            <Form
                action={configureAction(verifyCompanyUserEmailAction, { params: { token } })}
                title="Bekreft e-postadressen din"
                submitText="Bekreft"
                successCallback={(companyUser?: { email: string }) => setVerifiedEmail(companyUser?.email ?? '')}
            />
        )
    }

    return <>
        <h1>E-postadressen er bekreftet</h1>
        <p>Du logger inn med {verifiedEmail || 'den nye adressen'} fra nå av.</p>
        <SiteLink href={careerLinks.frontpage()}>Fortsett</SiteLink>
    </>
}

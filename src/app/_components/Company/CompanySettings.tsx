'use client'
import CompanySponsorTierForm from './CompanySponsorTierForm'
import TextInput from '@/UI/TextInput'
import FileInput from '@/UI/FileInput'
import Form from '@/components/Form/Form'
import useAuthorizer from '@/hooks/useAuthorizer'
import { companyAuth } from '@/services/careers/companies/auth'
import {
    destroyCompanyAction,
    updateCompanyAction,
    updateCompanyLogoAction,
    updateCompanyNameAction
} from '@/services/careers/companies/actions'
import { configureAction } from '@/services/configureAction'
import type { AppHref } from '@/lib/sites/href'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { Company } from '@/prisma-generated-pn-types'

type PropTypes = {
    company: Company,
    /** The pop-up the forms are shown in, which is closed when one of them is saved. */
    closePopUpOnSuccess?: PopUpKeyType,
    /** Where to go when the company is deleted, for a page that only exists while the company does. */
    navigateOnDestroy?: AppHref,
}

/**
 * The forms for managing a company: its name, details, logo, sponsor tier and removal. Each form is
 * only shown to a user its authorizer lets through, so nothing is rendered for one who may do none of it.
 */
export default function CompanySettings({ company, closePopUpOnSuccess, navigateOnDestroy }: PropTypes) {
    const canUpdateName = useAuthorizer({ authorizer: companyAuth.updateName })
    const canUpdate = useAuthorizer({ authorizer: companyAuth.update.data({ companyId: company.id }) })
    const canUpdateLogo = useAuthorizer({ authorizer: companyAuth.updateLogo.data({ companyId: company.id }) })
    const canUpdateSponsorTier = useAuthorizer({ authorizer: companyAuth.updateSponsorTier })
    const canDestroy = useAuthorizer({ authorizer: companyAuth.destroy })
    const params = { params: { id: company.id } }

    return (
        <>
            {canUpdateName.authorized && (
                <Form
                    title="Navn"
                    action={configureAction(updateCompanyNameAction, params)}
                    refreshOnSuccess
                    closePopUpOnSuccess={closePopUpOnSuccess}
                    submitText="Lagre"
                >
                    <TextInput name="name" label="Navn" defaultValue={company.name} />
                </Form>
            )}
            {canUpdate.authorized && (
                <Form
                    title="Rediger bedrift"
                    action={configureAction(updateCompanyAction, params)}
                    refreshOnSuccess
                    closePopUpOnSuccess={closePopUpOnSuccess}
                    submitText="Lagre"
                >
                    <TextInput name="description" label="Beskrivelse" defaultValue={company.description} />
                    <TextInput name="website" label="Nettside" defaultValue={company.website ?? ''} />
                </Form>
            )}
            {canUpdateLogo.authorized && (
                <Form
                    title="Logo"
                    action={configureAction(updateCompanyLogoAction, params)}
                    refreshOnSuccess
                    closePopUpOnSuccess={closePopUpOnSuccess}
                    submitText="Last opp logo"
                >
                    <FileInput name="imageFile" label="Logo" color="primary" />
                </Form>
            )}
            {canUpdateSponsorTier.authorized && (
                <CompanySponsorTierForm
                    companyId={company.id}
                    sponsorTier={company.sponsorTier}
                    closePopUpOnSuccess={closePopUpOnSuccess}
                />
            )}
            {canDestroy.authorized && (
                <Form
                    action={configureAction(destroyCompanyAction, params)}
                    refreshOnSuccess={!navigateOnDestroy}
                    navigateOnSuccess={navigateOnDestroy}
                    closePopUpOnSuccess={closePopUpOnSuccess}
                    submitText="Slett"
                    submitColor="red"
                    confirmation={{
                        confirm: true,
                        text: 'Er du sikker på at du vil slette denne bedriften?'
                    }}
                />
            )}
        </>
    )
}

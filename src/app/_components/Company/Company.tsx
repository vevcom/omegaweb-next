'use client'
import SelectCompany from './SelectCompany'
import SponsorBadge from './SponsorBadge'
import CompanySponsorTierForm from './CompanySponsorTierForm'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import TextInput from '@/UI/TextInput'
import CmsImage from '@/cms/CmsImage/CmsImage'
import Form from '@/components/Form/Form'
import useAuthorizer from '@/hooks/useAuthorizer'
import { companyAuth } from '@/services/careers/companies/auth'
import {
    destroyCompanyAction,
    updateCompanyAction,
    updateCompanyCmsLogoAction
} from '@/services/careers/companies/actions'
import { configureAction } from '@/services/configureAction'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { CompanyExpanded } from '@/services/careers/companies/types'

const sponsorTierClass = {
    MAIN: `
        border-[color-mix(in_srgb,var(--accent-yellow),transparent_50%)]
        bg-[color-mix(in_srgb,var(--accent-yellow),var(--surface-raised)_94%)]
        hover:bg-[color-mix(in_srgb,var(--accent-yellow),var(--surface-hover)_94%)]
    `,
    SPONSOR: `
        border-[color-mix(in_srgb,var(--accent-cyan),transparent_65%)] bg-surface-raised
        hover:bg-surface-hover
    `,
    NONE: `
        border-transparent bg-surface-raised
        hover:bg-surface-hover
    `,
} satisfies Record<CompanySponsorTier, string>

type PropTypes = {
    company: CompanyExpanded,
    disableEdit?: boolean,
    logoWidth?: number,
    squareLogo?: boolean
}

/**
 *
 * @param company - The company to display
 * @param disableEdit - If the edit buttons should be disabled even if the user has the rights
 * @param logoWidth - The width of the logo
 * @param squareLogo - If the logo should be square (contained in center of square frame)
 * @returns
 */
export default function Company({
    company,
    disableEdit = false,
    logoWidth = 300,
    squareLogo = true,
}: PropTypes) {
    const canUpdate = useAuthorizer({ authorizer: companyAuth.update })
    const canUpdateSponsorTier = useAuthorizer({ authorizer: companyAuth.updateSponsorTier })
    const canDestroy = useAuthorizer({ authorizer: companyAuth.destroy })
    const canEditCmsImageLogo = useAuthorizer({ authorizer: companyAuth.updateCmsImageLogo })
    const updateCmsImageAction = configureAction(
        updateCompanyCmsLogoAction,
        { implementationParams: { companyId: company.id } }
    )
    const showSettings = !disableEdit && (
        canUpdate.authorized || canUpdateSponsorTier.authorized || canDestroy.authorized
    )
    return (
        <div className={`
            relative flex flex-col h-full p-2 border rounded-round transition-[background-color,border-color] duration-300
            ${sponsorTierClass[company.sponsorTier]}
        `}>
            <div className="relative mb-2">
                <CmsImage
                    capabilities={{ canEdit: canEditCmsImageLogo }}
                    disableEditor={disableEdit}
                    className={`
                        overflow-hidden flex items-center bg-surface-base rounded-inner
                        tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180
                        ${squareLogo ? `
                            aspect-square
                            [&_div]:size-full
                            [&_img]:size-full [&_img]:object-contain
                        ` : ''}
                    `}
                    cmsImage={company.logo}
                    width={logoWidth}
                    updateCmsImageAction={updateCmsImageAction}
                />
                <SponsorBadge sponsorTier={company.sponsorTier} iconOnly className="
                    absolute top-2 left-2 max-w-[calc(100%-4*var(--gap))] z-1
                " />
            </div>
            <div className={`
                mx-2 pb-2 relative flex-1
                [&_h2]:text-l [&_h2]:truncate
                [&_p]:text-text-muted
                ${showSettings ? 'pr-10' : ''}
            `}>
                <h2>{company.name}</h2>
                <p>{company.description}</p>
                {
                    showSettings ? (
                        <SettingsHeaderItemPopUp title="Rediger bedrift"
                            showButtonClass="text-text absolute top-0 right-0 z-2"
                            popUpKey={`Edit ${company.id}`}
                        >
                            {
                                canUpdate.authorized && <Form
                                    action={configureAction(updateCompanyAction, { params: { id: company.id } })}
                                    refreshOnSuccess
                                    closePopUpOnSuccess={`Edit ${company.id}`}
                                    submitText="Lagre"
                                >
                                    <TextInput name="name" label="Navn" defaultValue={company.name} />
                                    <TextInput
                                        name="description"
                                        label="Beskrivelse"
                                        defaultValue={company.description}
                                    />
                                    <TextInput
                                        name="website"
                                        label="Nettside"
                                        defaultValue={company.website ?? ''}
                                    />
                                </Form>
                            }
                            {
                                canUpdateSponsorTier.authorized && <CompanySponsorTierForm
                                    companyId={company.id}
                                    sponsorTier={company.sponsorTier}
                                    closePopUpOnSuccess={`Edit ${company.id}`}
                                />
                            }
                            {
                                canDestroy.authorized && <Form
                                    action={configureAction(destroyCompanyAction, { params: { id: company.id } })}
                                    refreshOnSuccess
                                    closePopUpOnSuccess={`Edit ${company.id}`}
                                    submitText="Slett"
                                    submitColor="red"
                                    confirmation={{
                                        confirm: true,
                                        text: 'Er du sikker på at du vil slette denne bedriften?'
                                    }}
                                />
                            }
                        </SettingsHeaderItemPopUp>
                    ) : <></>
                }
            </div>
            <SelectCompany company={company} />
        </div>
    )
}

'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import { updateCompanySponsorTierAction } from '@/services/career/companies/actions'
import { companySponsorTierDetails, companySponsorTierOptions } from '@/services/career/companies/constants'
import { configureAction } from '@/services/configureAction'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    companyId: number,
    sponsorTier: CompanySponsorTier,
    closePopUpOnSuccess?: PopUpKeyType,
}

export default function CompanySponsorTierForm({ companyId, sponsorTier, closePopUpOnSuccess }: PropTypes) {
    return (
        <Form
            title="Plassering i listene"
            action={configureAction(updateCompanySponsorTierAction, { params: { id: companyId } })}
            refreshOnSuccess
            closePopUpOnSuccess={closePopUpOnSuccess}
            submitText="Lagre plassering"
        >
            <SelectString
                name="sponsorTier"
                label="Samarbeidsgrad"
                options={companySponsorTierOptions}
                defaultValue={sponsorTier}
            />
            <p>
                {companySponsorTierDetails.MAIN.label} kan kun én bedrift ha om gangen.
                Gir du plassen videre, blir bedriften som hadde den
                til {companySponsorTierDetails.SPONSOR.label.toLowerCase()}.
            </p>
        </Form>
    )
}

'use client'

import { createPricePeriodAction, updatePricePeriodAction } from '@/services/cabin/pricePeriod/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import Checkbox from '@/app/_components/UI/Checkbox'
import DateInput from '@/app/_components/UI/DateInput'
import type { PricePeriod } from '@/prisma-generated-pn-types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    period?: PricePeriod,
    closePopUpOnSuccess: PopUpKeyType,
}

export default function PricePeriodForm({ period, closePopUpOnSuccess }: PropTypes) {
    return <Form
        action={period
            ? configureAction(updatePricePeriodAction, { params: { id: period.id } })
            : createPricePeriodAction
        }
        submitText={period ? 'Oppdater pris periode' : 'Lag ny pris periode'}
        refreshOnSuccess
        closePopUpOnSuccess={closePopUpOnSuccess}
    >
        <DateInput name="validFrom" label="Start dato" defaultValue={period?.validFrom} />
        {!period && <Checkbox name="copyPreviousPrices" label="Kopier tidligere priser." defaultChecked />}
    </Form>
}

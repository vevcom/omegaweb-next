import {
    CreatePricePeriodField,
    CreatePricePeriodSubmitter,
    UpdatePricePeriodField,
    UpdatePricePeriodSubmitter,
} from './cabinPeriodSubmitters'
import type { PricePeriod } from '@/prisma-generated-pn-types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    period?: PricePeriod,
    closePopUpOnSuccess: PopUpKeyType,
}

export default function PricePeriodForm({ period, closePopUpOnSuccess }: PropTypes) {
    if (!period) {
        return <CreatePricePeriodSubmitter
            defaultValues={{ copyPreviousPrices: true }}
            submitText="Lag ny prisperiode"
            refreshOnSuccess
            closePopUpOnSuccess={closePopUpOnSuccess}
        >
            <CreatePricePeriodField kind="date" name="validFrom" label="Startdato" />
            <CreatePricePeriodField kind="boolean" name="copyPreviousPrices" label="Kopier tidligere priser" />
        </CreatePricePeriodSubmitter>
    }
    return <UpdatePricePeriodSubmitter
        params={{ id: period.id }}
        defaultValues={{ validFrom: period.validFrom }}
        submitText="Oppdater prisperiode"
        refreshOnSuccess
        closePopUpOnSuccess={closePopUpOnSuccess}
    >
        <UpdatePricePeriodField kind="date" name="validFrom" label="Startdato" />
    </UpdatePricePeriodSubmitter>
}

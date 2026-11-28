import {
    CreateReleasePeriodField,
    CreateReleasePeriodSubmitter,
    UpdateReleasePeriodField,
    UpdateReleasePeriodSubmitter,
} from './cabinPeriodSubmitters'
import type { ReleasePeriod } from '@/prisma-generated-pn-types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    period?: ReleasePeriod,
    closePopUpOnSuccess: PopUpKeyType,
}

export default function ReleasePeriodForm({ period, closePopUpOnSuccess }: PropTypes) {
    if (!period) {
        return <CreateReleasePeriodSubmitter
            submitText="Lag nytt slipp"
            refreshOnSuccess
            closePopUpOnSuccess={closePopUpOnSuccess}
        >
            <CreateReleasePeriodField kind="date" name="releaseTime" label="Slippdato" />
            <CreateReleasePeriodField kind="date" name="releaseUntil" label="Slipp inntil dato" />
        </CreateReleasePeriodSubmitter>
    }
    return <UpdateReleasePeriodSubmitter
        params={{ id: period.id }}
        defaultValues={{ releaseTime: period.releaseTime, releaseUntil: period.releaseUntil }}
        submitText="Oppdater slipp"
        refreshOnSuccess
        closePopUpOnSuccess={closePopUpOnSuccess}
    >
        <UpdateReleasePeriodField kind="date" name="releaseTime" label="Slippdato" />
        <UpdateReleasePeriodField kind="date" name="releaseUntil" label="Slipp inntil dato" />
    </UpdateReleasePeriodSubmitter>
}

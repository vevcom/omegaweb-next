'use client'

import { createReleasePeriodAction, updateReleasePeriodAction } from '@/services/cabin/releasePeriod/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import DateInput from '@/app/_components/UI/DateInput'
import type { ReleasePeriod } from '@/prisma-generated-pn-types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    period?: ReleasePeriod,
    closePopUpOnSuccess: PopUpKeyType,
}

export default function ReleasePeriodForm({ period, closePopUpOnSuccess }: PropTypes) {
    return <Form
        action={period
            ? configureAction(updateReleasePeriodAction, { params: { id: period.id } })
            : createReleasePeriodAction
        }
        submitText={period ? 'Oppdater slipp' : 'Lag nytt slipp'}
        refreshOnSuccess
        closePopUpOnSuccess={closePopUpOnSuccess}
    >
        <DateInput name="releaseTime" label="Slippdato" defaultValue={period?.releaseTime} />
        <DateInput name="releaseUntil" label="Slipp inntil dato" defaultValue={period?.releaseUntil} />
    </Form>
}

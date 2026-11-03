'use client'
import ReleasePeriodForm from './ReleasePeriodForm'
import PricePeriodForm from './PricePeriodForm'
import PopUp from '@/app/_components/PopUp/PopUp'
import { displayDate } from '@/lib/dates/displayDate'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import Form from '@/app/_components/Form/Form'
import useAuthorizer from '@/hooks/useAuthorizer'
import { cabinPricePeriodAuth } from '@/services/cabin/pricePeriod/auth'
import { cabinReleasePeriodAuth } from '@/services/cabin/releasePeriod/auth'
import { destroyPricePeriodAction } from '@/services/cabin/pricePeriod/actions'
import { destroyReleasePeriodAction } from '@/services/cabin/releasePeriod/actions'
import { configureAction } from '@/services/configureAction'
import type { PricePeriod, ReleasePeriod } from '@/prisma-generated-pn-types'


export default function PageStateWrapper({
    releasePeriods,
    pricePeriods,
}: {
    releasePeriods: ReleasePeriod[],
    pricePeriods: PricePeriod[],
}) {
    const canCreateReleasePeriod = useAuthorizer({ authorizer: cabinReleasePeriodAuth.create }).authorized
    const canUpdateReleasePeriod = useAuthorizer({ authorizer: cabinReleasePeriodAuth.update }).authorized
    const canDestroyReleasePeriod = useAuthorizer({ authorizer: cabinReleasePeriodAuth.destroy }).authorized
    const canCreatePricePeriod = useAuthorizer({ authorizer: cabinPricePeriodAuth.create }).authorized
    const canUpdatePricePeriod = useAuthorizer({ authorizer: cabinPricePeriodAuth.update }).authorized
    const canDestroyPricePeriod = useAuthorizer({ authorizer: cabinPricePeriodAuth.destroy }).authorized

    function isPricePeriodReleased(pricePeriod: PricePeriod): boolean {
        return releasePeriods
            .filter(period => period.releaseTime <= new Date())
            .some(period => period.releaseUntil > pricePeriod.validFrom)
    }

    return <>

        {canCreateReleasePeriod &&
            <PopUp
                popUpKey="CreateNewReleasePeriod"
                showButtonContent="Nytt slipp"
                showButtonClass="btn"
            >
                <ReleasePeriodForm closePopUpOnSuccess="CreateNewReleasePeriod" />
            </PopUp>
        }

        <SimpleTable
            header={[
                'Slipptidspunkt',
                'Slipper fram til',
                'Endre',
                'Slett',
            ]}
            body={releasePeriods.map(period => [
                displayDate(period.releaseTime, false),
                displayDate(period.releaseUntil, false),
                !canUpdateReleasePeriod || period.releaseTime < new Date() ? '' :
                    <PopUp
                        key={period.id}
                        popUpKey={`UpdateReleasePeriod${period.id}`}
                        showButtonContent="Endre"
                    >
                        <ReleasePeriodForm period={period} closePopUpOnSuccess={`UpdateReleasePeriod${period.id}`} />
                    </PopUp>,
                period.releaseTime < new Date() ? 'Slippet er publisert.' : canDestroyReleasePeriod &&
                    <Form
                        key={period.id}
                        action={configureAction(destroyReleasePeriodAction, {
                            params: { id: period.id },
                        })}
                        submitText="Slett"
                        submitColor="red"
                        confirmation={{
                            confirm: true,
                            text: 'Er du sikker på at du vil slette dette slippet?'
                        }}
                    />
            ])}
        />

        {canCreatePricePeriod &&
            <PopUp
                popUpKey="CreateNewPricePeriod"
                showButtonContent="Ny prisperiode"
                showButtonClass="btn"
            >
                <PricePeriodForm closePopUpOnSuccess="CreateNewPricePeriod" />
            </PopUp>
        }

        <SimpleTable
            header={[
                'Startdato',
                'Endre',
                'Slett'
            ]}
            body={pricePeriods.map(period => [
                displayDate(period.validFrom, false),
                !canUpdatePricePeriod || isPricePeriodReleased(period) ? '' :
                    <PopUp
                        key={period.id}
                        popUpKey={`UpdatePricePeriod${period.id}`}
                        showButtonContent="Endre"
                    >
                        <PricePeriodForm period={period} closePopUpOnSuccess={`UpdatePricePeriod${period.id}`} />
                    </PopUp>,
                isPricePeriodReleased(period) ? 'Prisperioden er publisert.' : canDestroyPricePeriod &&
                    <Form
                        key={period.id}
                        action={configureAction(destroyPricePeriodAction, {
                            params: { id: period.id },
                        })}
                        submitText="Slett"
                        submitColor="red"
                        confirmation={{
                            confirm: true,
                            text: 'Er du sikker på at du vil slette denne prisperioden? '
                                + 'Dette sletter alle priser knyttet til perioden.'
                        }}
                    />
            ])}
        />

    </>
}

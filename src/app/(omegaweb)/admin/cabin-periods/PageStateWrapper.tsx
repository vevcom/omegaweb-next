'use client'
import ReleasePeriodForm from './ReleasePeriodForm'
import PricePeriodForm from './PricePeriodForm'
import { DestroyPricePeriodSubmitter, DestroyReleasePeriodSubmitter } from './cabinPeriodSubmitters'
import { buttonClassName } from '@/components/UI/buttonClassName'
import PopUp from '@/app/_components/PopUp/PopUp'
import { displayDate } from '@/lib/dates/displayDate'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import useAuthorizer from '@/hooks/useAuthorizer'
import { cabinPricePeriodCapabilities } from '@/capabilities/cabin/pricePeriod/capabilities'
import { cabinReleasePeriodCapabilities } from '@/capabilities/cabin/releasePeriod/capabilities'
import type { PricePeriod, ReleasePeriod } from '@/prisma-generated-pn-types'


export default function PageStateWrapper({
    releasePeriods,
    pricePeriods,
}: {
    releasePeriods: ReleasePeriod[],
    pricePeriods: PricePeriod[],
}) {
    const canCreateReleasePeriod = useAuthorizer({ authorizer: cabinReleasePeriodCapabilities.create.authorizer }).authorized
    const canUpdateReleasePeriod = useAuthorizer({ authorizer: cabinReleasePeriodCapabilities.update.authorizer }).authorized
    const canDestroyReleasePeriod = useAuthorizer({
        authorizer: cabinReleasePeriodCapabilities.destroy.authorizer,
    }).authorized
    const canCreatePricePeriod = useAuthorizer({ authorizer: cabinPricePeriodCapabilities.create.authorizer }).authorized
    const canUpdatePricePeriod = useAuthorizer({ authorizer: cabinPricePeriodCapabilities.update.authorizer }).authorized
    const canDestroyPricePeriod = useAuthorizer({ authorizer: cabinPricePeriodCapabilities.destroy.authorizer }).authorized

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
                showButtonClass={buttonClassName()}
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
                    <DestroyReleasePeriodSubmitter
                        key={period.id}
                        params={{ id: period.id }}
                        submitText="Slett"
                        submitColor="error"
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
                showButtonClass={buttonClassName()}
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
                    <DestroyPricePeriodSubmitter
                        key={period.id}
                        params={{ id: period.id }}
                        submitText="Slett"
                        submitColor="error"
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

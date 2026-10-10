'use client'
import styles from './page.module.scss'
import ReleasePeriodForm from './ReleasePeriodForm'
import PricePeriodForm from './PricePeriodForm'
import PopUp from '@/app/_components/PopUp/PopUp'
import { displayDate } from '@/lib/dates/displayDate'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import Form from '@/app/_components/Form/Form'
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
    function isPricePeriodReleased(pricePeriod: PricePeriod): boolean {
        return releasePeriods
            .filter(period => period.releaseTime <= new Date())
            .some(period => period.releaseUntil > pricePeriod.validFrom)
    }

    return <>

        <PopUp
            popUpKey="CreateNewReleasePeriod"
            showButtonContent="Ny Slipp Periode"
            showButtonClass={styles.button}
        >
            <ReleasePeriodForm />
        </PopUp>

        <SimpleTable
            header={[
                'Slipptidspunkt',
                'Slipp til dato',
                'Slett',
            ]}
            body={releasePeriods.map(period => [
                displayDate(period.releaseTime, false),
                displayDate(period.releaseUntil, false),
                period.releaseTime < new Date() ? 'Slipp perioden er publisert.' :
                    <Form
                        key={period.id}
                        action={configureAction(destroyReleasePeriodAction, {
                            params: { id: period.id },
                        })}
                        submitText="Slett"
                        submitColor="red"
                        confirmation={{
                            confirm: true,
                            text: 'Er du sikker på at du vil slette denne slipp perioden?'
                        }}
                    />
            ])}
        />

        <PopUp
            popUpKey="CreateNewPricePeriod"
            showButtonContent="Ny Pris Periode"
            showButtonClass={styles.button}
        >
            <PricePeriodForm />
        </PopUp>

        <SimpleTable
            header={[
                'Start dato',
                'Slett'
            ]}
            body={pricePeriods.map(period => [
                displayDate(period.validFrom, false),
                <>
                    {isPricePeriodReleased(period) ? 'Pris perioden er publisert.' :
                        <Form
                            key={period.id}
                            action={configureAction(destroyPricePeriodAction, {
                                params: { id: period.id },
                            })}
                            submitText="Slett"
                            submitColor="red"
                            confirmation={{
                                confirm: true,
                                // eslint-disable-next-line max-len
                                text: 'Er du sikker på at du vil slette denne pris perioden? Dette vil slette alle priser forbundet til perioden.'
                            }}
                        />
                    }
                </>
            ])}
        />

    </>
}

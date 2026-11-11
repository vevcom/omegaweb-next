'use client'
import ReleasePeriodForm from './ReleasePeriodForm'
import PricePeriodForm from './PricePeriodForm'
import PopUp from '@/app/_components/PopUp/PopUp'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { osloDateTime } from '@/lib/dates/oslo'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import {
    cabinAdminBadgeClassName,
    cabinAdminCardClassName,
    cabinAdminTableClassName,
} from '@/app/(omegaweb)/admin/cabinAdminStyles'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import Form from '@/app/_components/Form/Form'
import useAuthorizer from '@/hooks/useAuthorizer'
import { cabinPricePeriodAuth } from '@/services/cabin/pricePeriod/auth'
import { cabinReleasePeriodAuth } from '@/services/cabin/releasePeriod/auth'
import { destroyPricePeriodAction } from '@/services/cabin/pricePeriod/actions'
import { destroyReleasePeriodAction } from '@/services/cabin/releasePeriod/actions'
import { configureAction } from '@/services/configureAction'
import type { PricePeriod, ReleasePeriod } from '@/prisma-generated-pn-types'


const osloDay = (date: Date) => osloDateTime(date).setLocale('nb').toFormat('d. MMMM yyyy')

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

    const now = new Date()

    return <div className="flex flex-col gap-6 max-w-5xl">
        <section className={cabinAdminCardClassName}>
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="m-0 text-l">Slipp</h2>
                    <p className="m-0 text-s text-base-content/80">Når nye datoer åpner for booking, og hvor langt fram.</p>
                </div>
                {canCreateReleasePeriod &&
                    <AddHeaderItemPopUp popUpKey="CreateNewReleasePeriod" label="Nytt slipp">
                        <ReleasePeriodForm closePopUpOnSuccess="CreateNewReleasePeriod" />
                    </AddHeaderItemPopUp>
                }
            </div>
            <div className="overflow-x-auto">
                <SimpleTable
                    className={cabinAdminTableClassName}
                    header={['Slippes', 'Åpner fram til', 'Status', '']}
                    body={releasePeriods.map(period => {
                        const published = period.releaseTime < now
                        return [
                            osloDateTime(period.releaseTime).setLocale('nb').toFormat('d. MMMM yyyy \'kl.\' HH:mm'),
                            osloDay(period.releaseUntil),
                            <PublishedBadge key="status" published={published} />,
                            !published && (canUpdateReleasePeriod || canDestroyReleasePeriod) &&
                                <PopUp
                                    key="actions"
                                    popUpKey={`UpdateReleasePeriod${period.id}`}
                                    showButtonContent="Endre"
                                    showButtonClass="btn-neutral m-0!"
                                >
                                    {canUpdateReleasePeriod &&
                                        <ReleasePeriodForm
                                            period={period}
                                            closePopUpOnSuccess={`UpdateReleasePeriod${period.id}`}
                                        />
                                    }
                                    {canDestroyReleasePeriod &&
                                        <Form
                                            action={configureAction(destroyReleasePeriodAction, {
                                                params: { id: period.id },
                                            })}
                                            submitText="Slett slippet"
                                            submitColor="red"
                                            confirmation={{
                                                confirm: true,
                                                text: 'Er du sikker på at du vil slette dette slippet?'
                                            }}
                                        />
                                    }
                                </PopUp>,
                        ]
                    })}
                />
            </div>
        </section>

        <section className={cabinAdminCardClassName}>
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="m-0 text-l">Prisperioder</h2>
                    <p className="m-0 text-s text-base-content/80">
                        Prisene settes per produkt under{' '}
                        <SiteLink href={appHref('/admin/cabin-product')}>Heutteprodukter</SiteLink>.
                        En periode kan ikke endres når datoene den gjelder for er sluppet.
                    </p>
                </div>
                {canCreatePricePeriod &&
                    <AddHeaderItemPopUp popUpKey="CreateNewPricePeriod" label="Ny prisperiode">
                        <PricePeriodForm closePopUpOnSuccess="CreateNewPricePeriod" />
                    </AddHeaderItemPopUp>
                }
            </div>
            <div className="overflow-x-auto">
                <SimpleTable
                    className={cabinAdminTableClassName}
                    header={['Gjelder fra', 'Status', '']}
                    body={pricePeriods.map(period => {
                        const published = isPricePeriodReleased(period)
                        return [
                            osloDay(period.validFrom),
                            <PublishedBadge key="status" published={published} />,
                            !published && (canUpdatePricePeriod || canDestroyPricePeriod) &&
                                <PopUp
                                    key="actions"
                                    popUpKey={`UpdatePricePeriod${period.id}`}
                                    showButtonContent="Endre"
                                    showButtonClass="btn-neutral m-0!"
                                >
                                    {canUpdatePricePeriod &&
                                        <PricePeriodForm
                                            period={period}
                                            closePopUpOnSuccess={`UpdatePricePeriod${period.id}`}
                                        />
                                    }
                                    {canDestroyPricePeriod &&
                                        <Form
                                            action={configureAction(destroyPricePeriodAction, {
                                                params: { id: period.id },
                                            })}
                                            submitText="Slett perioden"
                                            submitColor="red"
                                            confirmation={{
                                                confirm: true,
                                                text: 'Er du sikker på at du vil slette denne prisperioden? '
                                                    + 'Dette sletter alle priser knyttet til perioden.'
                                            }}
                                        />
                                    }
                                </PopUp>,
                        ]
                    })}
                />
            </div>
        </section>
    </div>
}

function PublishedBadge({ published }: { published: boolean }) {
    return <span className={`
        ${cabinAdminBadgeClassName}
        ${published ? 'bg-success text-success-content' : 'bg-info text-info-content'}
    `}>
        {published ? 'Publisert' : 'Planlagt'}
    </span>
}

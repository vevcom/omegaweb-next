import { UpdateCabinProductPriceForm } from './UpdateCabinProductPriceForm'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { cabinAdminCardClassName, cabinAdminTableClassName } from '@/app/(omegaweb)/admin/cabinAdminStyles'
import { displayAmount } from '@/lib/currency/convert'
import SiteLink from '@/components/SiteLink/SiteLink'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ product: string }>) => {
        const [product, pricePeriods] = await Promise.all([
            cabinProductOperations.read({
                params: { id: parseInt(decodeURIComponent(params.product), 10) },
            }),
            cabinPricePeriodOperations.readUnreleasedPeriods({}),
        ])
        return { product, pricePeriods }
    },
    capabilities: () => ({
        canCreatePrice: cabinProductAuth.createPrice,
    }),
    metadata: (data) => ({ title: data.product.name }),
    render: ({ data, capabilities }) => (
        <PageWrapper
            headerItem={capabilities.canCreatePrice.authorized &&
                <AddHeaderItemPopUp popUpKey="AddCabinProductPrice" label="Ny pris">
                    <UpdateCabinProductPriceForm
                        productId={data.product.id}
                        productType={data.product.type}
                        pricePeriods={data.pricePeriods}
                    />
                </AddHeaderItemPopUp>
            }
        >
            <section className={`
                ${cabinAdminCardClassName}
                max-w-5xl
            `}>
                <div className="flex flex-col gap-2 text-s text-base-content/80">
                    <p className="m-0">
                        Hver pris gjelder fra starten av en prisperiode, og bare de nettene intervallet passer.
                        Passer flere priser en natt, får leietakeren den billigste.
                    </p>
                    <p className="m-0">
                        Intervallet skrives som de tre siste feltene i
                        {' '}<SiteLink href={externalHref('https://crontab.guru/')}>cron</SiteLink>:
                        dag i måneden, måned og ukedag. For eksempel er <code>* * 5-6</code> fredag og lørdag.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <SimpleTable
                        className={cabinAdminTableClassName}
                        header={['Beskrivelse', 'Pris per natt', 'Gjelder fra', 'Medlemsandel', 'Intervall']}
                        body={data.product.CabinProductPrice.map(priceObj => [
                            priceObj.description || '–',
                            displayAmount(priceObj.price, false),
                            displayDate(priceObj.PricePeriod.validFrom, false),
                            priceObj.memberShare ? `Minst ${priceObj.memberShare} %` : '–',
                            <code key="cron">{priceObj.cronInterval}</code>,
                        ])}
                    />
                </div>
            </section>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

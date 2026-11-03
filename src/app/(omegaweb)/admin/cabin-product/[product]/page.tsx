import { UpdateCabinProductPriceForm } from './UpdateCabinProductPriceForm'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { displayAmount } from '@/lib/currency/convert'
import Link from 'next/link'
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
                <AddHeaderItemPopUp popUpKey="AddCabinProductPrice">
                    <UpdateCabinProductPriceForm
                        productId={data.product.id}
                        productType={data.product.type}
                        pricePeriods={data.pricePeriods}
                    />
                </AddHeaderItemPopUp>
            }
        >
            <div className="[&_p]:mt-[1rem]">
                <p>kanskje en måte å redigere på som en HeaderItem?</p>

                <p>
                    Her bruker vi en egen syntaks for å skrive tidsintervallet en pris er gyldig i.
                    Syntaksen er inspirert av Cron, men tar bare med de tre siste feltene, siden vi bare bruker datoer.
                    Les mer her: <Link href="https://crontab.guru/">crontab.guru</Link>.
                    Siden vi har laget tolkingen selv, er syntaksen litt begrenset.
                    De tre feltene vi støtter, er <i>dag i måneden</i>, <i>måned</i> og <i>ukedag</i>.
                </p>

                <p>
                    Brukeren vil få den billigste prisen der brukeren oppfyller alle kravene under.
                    Det vil si at dersom flere prisregler passer, får brukeren den billigste.
                </p>

            </div>

            <SimpleTable
                header={[
                    'Beskrivelse',
                    'Pris',
                    'Gyldig fra',
                    'Andel i Omega',
                    'Cron-intervall'
                ]}
                body={data.product.CabinProductPrice.map(priceObj => [
                    priceObj.description,
                    displayAmount(priceObj.price),
                    displayDate(priceObj.PricePeriod.validFrom, false),
                    priceObj.memberShare.toString(),
                    priceObj.cronInterval ?? '',
                ])}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

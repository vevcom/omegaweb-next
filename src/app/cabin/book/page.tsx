import StateWrapper from './stateWrapper'
import SpecialCmsParagraph from '@/app/_components/Cms/CmsParagraph/SpecialCmsParagraph'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { default as DateComponent } from '@/components/Date/Date'
import {
    readSpecialCmsParagraphCabinContractAction,
    updateSpecialCmsParagraphCabinContractAction
} from '@/services/cabin/booking/actions'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import { displayDate } from '@/lib/dates/displayDate'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'
import type { ReleasePeriod } from '@/prisma-generated-pn-types'

function findCurrentReleasePeriod(releasePeriods: ReleasePeriod[]) {
    const filtered = releasePeriods.filter(releasePeriod => {
        const now = new Date()
        return releasePeriod.releaseTime < now && now < releasePeriod.releaseUntil
    })

    if (filtered.length === 0) return new Date()
    return filtered[0].releaseUntil
}

function findNextReleasePeriod(releasePeriods: ReleasePeriod[]) {
    const filtered = releasePeriods.filter(releasePeriod => {
        const now = new Date()
        return now < releasePeriod.releaseTime
    })

    if (filtered.length === 0) return null
    return filtered[0]
}

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const [cabinAvailability, releasePeriods, pricePeriods, cabinProducts] = await Promise.all([
            cabinBookingOperations.readAvailability({}),
            cabinReleasePeriodOperations.readMany({}),
            cabinPricePeriodOperations.readPublicPeriods({}),
            cabinProductOperations.readActive({}),
        ])
        // What paying for the booking out of pocket would take: the visitor's balance, and a
        // Stripe customer session for saved payment methods.
        let cabinBookingBalance: number | undefined
        let cabinBookingCustomerSessionSecret: string | undefined

        if (session.user) {
            cabinBookingBalance = (await ledgerAccountOperations.calculateBalance({
                params: { userId: session.user.id },
            })).amount

            const customerSession = await withFallback(
                stripeCustomerOperations.createSession({ params: { userId: session.user.id } }),
                null
            )
            cabinBookingCustomerSessionSecret = customerSession?.customerSessionClientSecret
        }

        return {
            cabinAvailability,
            releasePeriods,
            pricePeriods,
            cabinProducts,
            cabinBookingBalance,
            cabinBookingCustomerSessionSecret,
        }
    },
    capabilities: () => ({
        canEditSpecialCmsParagraphContract: cabinBookingAuth.updateSpecialCmsParagraphContentCabinContract,
    }),
    metadata: () => ({ title: 'Hyttebooking' }),
    render: ({ data, capabilities }) => {
        const releaseUntil = findCurrentReleasePeriod(data.releasePeriods)
        const nextReleasePeriod = findNextReleasePeriod(data.releasePeriods)

        return <PageWrapper>
            {nextReleasePeriod &&
                <p>
                    Neste slipptid er <DateComponent date={nextReleasePeriod.releaseTime} />,
                    da slippes bookinger fram til <DateComponent date={nextReleasePeriod.releaseUntil} />
                </p>
            }
            {data.pricePeriods.length > 1 &&
                <p>
                    Nye priser fra: {
                        data.pricePeriods.slice(1).map(period => displayDate(period.validFrom, false)).join(', ')
                    }
                </p>
            }
            <StateWrapper
                cabinAvailability={data.cabinAvailability}
                releaseUntil={releaseUntil}
                cabinProducts={data.cabinProducts}
                pricePeriods={data.pricePeriods}
                availableBalance={data.cabinBookingBalance}
                customerSessionClientSecret={data.cabinBookingCustomerSessionSecret}
            />

            <SpecialCmsParagraph
                capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraphContract }}
                special="CABIN_CONTRACT"
                readSpecialCmsParagraphAction={readSpecialCmsParagraphCabinContractAction}
                updateCmsParagraphAction={updateSpecialCmsParagraphCabinContractAction}
            />
        </PageWrapper>
    },
})

export default page
export { generateMetadata }

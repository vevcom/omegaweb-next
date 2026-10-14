import StateWrapper from './StateWrapper'
import ConnectCabinToLedgerForm from './ConnectCabinToLedgerForm'
import SpecialCmsParagraph from '@/app/_components/Cms/CmsParagraph/SpecialCmsParagraph'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
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
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'
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

        // The account the bookings are paid into, and the accounts it may be changed to, feed the
        // settings of a cabin admin, so they are loaded for no one else. Each falls back rather
        // than taking the booking page down.
        const administers = cabinBookingAuth.readLedgerAccount.auth(session).authorized
        const [cabinLedgerAccount, ledgerAccounts] = administers
            ? await Promise.all([
                withFallback(cabinBookingOperations.readLedgerAccount({}), null),
                withFallback(ledgerAccountOperations.readAccessible({
                    params: { includeGroupAccounts: true, includeUserAccounts: false },
                }), []),
            ])
            : [null, []]

        return {
            cabinAvailability,
            releasePeriods,
            pricePeriods,
            cabinProducts,
            cabinBookingBalance,
            cabinBookingCustomerSessionSecret,
            cabinLedgerAccount,
            ledgerAccounts,
        }
    },
    capabilities: (data) => ({
        canEditSpecialCmsParagraphContract: cabinBookingAuth.updateSpecialCmsParagraphContentCabinContract,
        canConnectToLedger: cabinBookingAuth.connectToLedger.data({
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
    }),
    metadata: () => ({ title: 'Hyttebooking' }),
    render: ({ data, capabilities }) => {
        const releaseUntil = findCurrentReleasePeriod(data.releasePeriods)
        const nextReleasePeriod = findNextReleasePeriod(data.releasePeriods)
        const ledgerAccount = data.cabinLedgerAccount

        return <PageWrapper
            headerItem={capabilities.canConnectToLedger.authorized && (
                <SettingsHeaderItemPopUp scale={30} popUpKey="cabinSettings">
                    <p>
                        Konto: {ledgerAccount
                            ? (ledgerAccount.name ?? `Konto ${ledgerAccount.id}`)
                            : 'ingen. Hytta kan ikke bookes før den er knyttet til en konto.'}
                    </p>
                    <ConnectCabinToLedgerForm
                        currentLedgerAccountId={ledgerAccount?.id ?? null}
                        ledgerAccounts={data.ledgerAccounts}
                    />
                </SettingsHeaderItemPopUp>
            )}
        >
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

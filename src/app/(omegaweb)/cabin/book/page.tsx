import StateWrapper from './StateWrapper'
import ConnectCabinToLedgerForm from './ConnectCabinToLedgerForm'
import SpecialCmsParagraph from '@/app/_components/Cms/CmsParagraph/SpecialCmsParagraph'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
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
import { osloDateTime } from '@/lib/dates/oslo'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import { Require } from '@/auth/authorizer/Require'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import { appHref } from '@/lib/sites/href'
import { faHouse } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { ReleasePeriod } from '@/prisma-generated-pn-types'

/** A date as Oslo reads it, such as 11. januar 2027. */
const osloDay = (date: Date) => osloDateTime(date).setLocale('nb').toFormat('d. MMMM yyyy')

function findCurrentReleasePeriod(releasePeriods: ReleasePeriod[]) {
    const filtered = releasePeriods.filter(releasePeriod => {
        const now = new Date()
        return releasePeriod.releaseTime < now && now < releasePeriod.releaseUntil
    })

    if (filtered.length === 0) return null
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
    capabilities: (data, session) => ({
        canReadOwnBookings: session.user
            ? cabinBookingAuth.readManyOfUser.data({ userId: session.user.id })
            : Require.user(),
        canEditSpecialCmsParagraphContract: cabinBookingAuth.updateSpecialCmsParagraphContentCabinContract,
        canConnectToLedgerAccount: cabinBookingAuth.connectToLedgerAccount.data({
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
    }),
    metadata: () => ({ title: 'Hyttebooking' }),
    render: ({ data, capabilities }) => {
        const releaseUntil = findCurrentReleasePeriod(data.releasePeriods)
        const nextReleasePeriod = findNextReleasePeriod(data.releasePeriods)
        const ledgerAccount = data.cabinLedgerAccount

        return <PageWrapper
            headerItem={
                <div className="flex items-center gap-[1em]">
                    {capabilities.canReadOwnBookings.authorized &&
                        <HeaderItemLink
                            href={appHref('/users/me/cabin-bookings')}
                            label="Mine hyttebookinger"
                            icon={faHouse}
                        />
                    }
                    {capabilities.canConnectToLedgerAccount.authorized && (
                        <SettingsHeaderItemPopUp scale={40} popUpKey="cabinSettings">
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
                </div>
            }
        >
            <div className="flex flex-col gap-4 mb-6">
                <p className="m-0 bg-base-200 border border-base-300 rounded-round px-6 py-4">
                    {releaseUntil
                        ? `Datoer fram til ${osloDay(releaseUntil)} kan bookes nå.`
                        : 'Ingen datoer er åpne for booking akkurat nå.'}
                    {nextReleasePeriod && <>
                        {' '}Neste slipp er {osloDay(nextReleasePeriod.releaseTime)}{' '}
                        kl. {osloDateTime(nextReleasePeriod.releaseTime).toFormat('HH:mm')}, og da åpner det fram
                        til {osloDay(nextReleasePeriod.releaseUntil)}.
                    </>}
                    {data.pricePeriods.length > 1 && <>
                        {' '}Nye priser fra {
                            data.pricePeriods.slice(1).map(period => osloDay(period.validFrom)).join(', ')
                        }.
                    </>}
                </p>
            </div>
            <StateWrapper
                cabinAvailability={data.cabinAvailability}
                releaseUntil={releaseUntil ?? new Date()}
                cabinProducts={data.cabinProducts}
                pricePeriods={data.pricePeriods}
                availableBalance={data.cabinBookingBalance}
                customerSessionClientSecret={data.cabinBookingCustomerSessionSecret}
            />

            <div id="cabin-contract" className="mt-6 bg-base-200 border border-base-300 rounded-round p-6">
                <SpecialCmsParagraph
                    capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraphContract }}
                    special="CABIN_CONTRACT"
                    readSpecialCmsParagraphAction={readSpecialCmsParagraphCabinContractAction}
                    updateCmsParagraphAction={updateSpecialCmsParagraphCabinContractAction}
                />
            </div>
        </PageWrapper>
    },
})

export default page
export { generateMetadata }

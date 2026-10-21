import CreateOrder from './CreateOrder'
import Requirements from './Requirements'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { omegaOrderAuth } from '@/services/omegaOrder/auth'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Date from '@/components/Date/Date'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        // The page's whole point is incrementing the order, so it is gated on `create`
        // rather than the read auth the operations themselves enforce.
        authorizeAdminPage('state-of-omega', session)

        const [currentOrder, requirements] = await Promise.all([
            omegaOrderOperations.readCurrent({}),
            omegaOrderOperations.readRequirements({}),
        ])
        return { currentOrder, requirements }
    },
    capabilities: () => ({
        canCreateOrder: omegaOrderAuth.create,
    }),
    metadata: () => ({ title: 'Omegas tilstand' }),
    render: ({ data, capabilities }) => {
        const allRequirementsFulfilled = data.requirements.every(requirement => requirement.fulfilled)

        return (
            <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div
                    className="
                        rounded-round bg-surface-raised border-3 border-accent-blue py-12 px-16 flex flex-col items-center
                        gap-2
                    "
                >
                    <p className="m-0 font-secondary text-l tracking-[0.3em] uppercase text-text-muted">Omega er i orden</p>
                    <h1
                        className="
                            m-0 font-secondary text-[length:clamp(6rem,20vw,12rem)] font-bold leading-none
                            text-accent-blue [text-shadow:0_0_0.3em_color-mix(in_srgb,var(--accent-blue),transparent_40%)]
                        "
                    >{ data.currentOrder.order }</h1
                    >
                </div>
                <p className="m-0 text-text-muted">
                    Ordenen til Omega ble sist inkrementert{' '}
                    <Date date={data.currentOrder.createdAt} includeTime={false} />
                </p>
                <div className="rounded-round bg-surface-raised p-6 w-full max-w-[700px] text-left">
                    <Requirements requirements={data.requirements} />
                </div>
                {capabilities.canCreateOrder.authorized &&
                    <CreateOrder allRequirementsFulfilled={allRequirementsFulfilled} />
                }
            </div>
        )
    },
})

export default page
export { generateMetadata }

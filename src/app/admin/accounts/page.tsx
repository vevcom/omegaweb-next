import LedgerAccountList from '@/components/Ledger/Accounts/LedgerAccountList'
import CreateGroupLedgerAccountForm from '@/components/Ledger/Accounts/CreateGroupLedgerAccountForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const popUpKey = 'createGroupLedgerAccount'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('accounts', session),
    capabilities: () => ({
        canCreate: ledgerAccountAuth.create,
    }),
    metadata: () => ({ title: 'Gruppekontoer' }),
    render: ({ capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canCreate.authorized &&
            <AddHeaderItemPopUp popUpKey={popUpKey}>
                <CreateGroupLedgerAccountForm popUpKey={popUpKey} />
            </AddHeaderItemPopUp>
        }>
            <LedgerAccountList />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }

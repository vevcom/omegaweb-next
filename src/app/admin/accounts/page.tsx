import LedgerAccountList from '@/components/Ledger/Accounts/LedgerAccountList'
import CreateGroupLedgerAccountForm from '@/components/Ledger/Accounts/CreateGroupLedgerAccountForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const popUpKey = 'createGroupLedgerAccount'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('accounts', session),
    metadata: () => ({ title: 'Gruppekontoer' }),
    render: () => (
        <PageWrapper headerItem={
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

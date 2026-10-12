import { Require } from '@/auth/authorizer/Require'
import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'

export const shopAuth = {
    read: Require.permission('SHOP_USE'),
    create: Require.permission('SHOP_ADMIN'),
    connectToLedger: Require.permission('SHOP_ADMIN').allOf(ledgerAccountAccess('LEDGER_ADMIN')),
} as const

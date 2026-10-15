'use client'

import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { LedgerAccountPagingProvider, LedgerAccountPagingContext } from '@/contexts/paging/LedgerAccountPaging'
import { displayAmount } from '@/lib/currency/convert'
import Link from 'next/link'

export default function LedgerAccountList() {
    return <LedgerAccountPagingProvider
        startPage={{ page: 0, pageSize: 10 }}
        details={{ accountType: 'GROUP' }}
        serverRenderedData={[]}
    >
        <EndlessScroll
            pagingContext={LedgerAccountPagingContext}
            renderer={account =>
                <tr key={account.id}>
                    <td><Link href={`accounts/${account.id}`}>{account.name}</Link></td>
                    <td>{displayAmount(account.balance.amount, false)}</td>
                </tr>
            }
            wrapper={children =>
                <table className="ohma-table">
                    <thead>
                        <tr>
                            <th>Navn</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {children}
                    </tbody>
                </table>
            }
        />
    </LedgerAccountPagingProvider>
}

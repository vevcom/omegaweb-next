import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

type Props = {
    transactionsHref?: string,
}

export default function LedgerAccountTransactionSummary({ transactionsHref }: Props) {
    return <div className="bg-surface-base rounded-round p-[calc(3*var(--rounding))]">
        <h2>Transaksjoner</h2>
        {
            transactionsHref &&
            <Link href={transactionsHref} className="inline-flex items-center gap-2">
                Se alle transaksjoner <FontAwesomeIcon icon={faArrowRight} />
            </Link>
        }
    </div>
}

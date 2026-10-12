'use client'

import styles from './LedgerAccountGroupList.module.scss'
import { updateLedgerAccountAction } from '@/services/ledger/accounts/actions'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ExpandedGroup } from '@/services/groups/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type Props = {
    ledgerAccountId: number,
    groups: ExpandedGroup[],
    capabilities: CapabilitiesJsObject<'canChangeGroups'>,
}

export default function LedgerAccountGroupList({ ledgerAccountId, groups, capabilities }: Props) {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    const removeGroup = async (groupId: number) => {
        const result = await updateLedgerAccountAction({
            params: { ledgerAccountId },
        }, {
            data: { removeGroupIds: [groupId] },
        })

        if (!result.success) {
            setError(result.error?.[0]?.message ?? 'Kunne ikke fjerne gruppen.')
            return
        }

        setError(null)
        router.refresh()
    }

    return (
        <>
            <ul>
                {groups.length > 0 ? groups.map(group => (
                    <li key={group.id} className={styles.groupElement}>
                        <span>{group.name}</span>
                        {capabilities.canChangeGroups.authorized &&
                            <button onClick={() => removeGroup(group.id)} className={styles.removeButton}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        }
                    </li>
                )) : <li><em>Denne kontoen er ikke knyttet til noen grupper.</em></li>}
            </ul>
            {error && <p className={styles.error}>{error}</p>}
        </>
    )
}

'use client'

import { updateLedgerAccountAsAdminAction } from '@/services/ledger/accounts/actions'
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
        const result = await updateLedgerAccountAsAdminAction({
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
                    <li key={group.id} className="flex items-center justify-between gap-4 rounded-round border-2 border-solid border-surface-subtle my-2 p-4 text-l">
                        <span>{group.name}</span>
                        {capabilities.canChangeGroups.authorized &&
                            <button onClick={() => removeGroup(group.id)} className="text-l text-text-muted justify-self-end size-[20px] bg-white border-none rounded-full cursor-pointer transition-[background] duration-500 flex justify-center items-center hover:bg-[color-mix(in_srgb,white,black_10%)]">
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        }
                    </li>
                )) : <li><em>Denne kontoen er ikke knyttet til noen grupper.</em></li>}
            </ul>
            {error && <p className="text-accent-red">{error}</p>}
        </>
    )
}

'use client'

import { SelectNumber } from '@/components/UI/Select'
import Button from '@/components/UI/Button'
import { updateLedgerAccountAsAdminAction } from '@/services/ledger/accounts/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ExpandedGroup } from '@/services/groups/types'

type Props = {
    ledgerAccountId: number,
    availableGroups: ExpandedGroup[],
}

export default function AddGroupToLedgerAccount({ ledgerAccountId, availableGroups }: Props) {
    const router = useRouter()
    const [selectedGroupId, setSelectedGroupId] = useState(availableGroups[0]?.id)
    const [error, setError] = useState<string | null>(null)

    if (availableGroups.length === 0) return null

    const addGroup = async () => {
        if (selectedGroupId === undefined) return

        const result = await updateLedgerAccountAsAdminAction({
            params: { ledgerAccountId },
        }, {
            data: { addGroupIds: [selectedGroupId] },
        })

        if (!result.success) {
            setError(result.error?.[0]?.message ?? 'Kunne ikke legge til gruppen.')
            return
        }

        setError(null)
        router.refresh()
    }

    return (
        <div className="flex items-end gap-2 mt-2">
            <SelectNumber
                name="groupId"
                label="Gruppe"
                options={availableGroups.map(group => ({ value: group.id, label: group.name }))}
                value={selectedGroupId}
                onChange={setSelectedGroupId}
            />
            <Button onClick={addGroup} color="secondary">Legg til</Button>
            {error && <p className="text-accent-red">{error}</p>}
        </div>
    )
}

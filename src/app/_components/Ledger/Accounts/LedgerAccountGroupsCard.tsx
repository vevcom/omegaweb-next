import styles from './LedgerAccountGroupsCard.module.scss'
import LedgerAccountGroupList from './LedgerAccountGroupList'
import AddGroupToLedgerAccount from './AddGroupToLedgerAccount'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { withPageSession } from '@/app/serverPage'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type Props = {
    ledgerAccountId: number,
    groupIds: number[],
    capabilities: Capabilities<'canChangeGroups'>,
}

export default async function LedgerAccountGroupsCard({ ledgerAccountId, groupIds, capabilities }: Props) {
    const allGroups = flattenExpandedGroups(await withPageSession(() => readExpandedOfAllTypes({})))
    const currentGroups = allGroups.filter(group => groupIds.includes(group.id))
    const availableGroups = allGroups.filter(group => !groupIds.includes(group.id))

    return <div className={styles.wrapper}>
        <h2>Grupper</h2>
        <LedgerAccountGroupList
            ledgerAccountId={ledgerAccountId}
            groups={currentGroups}
            capabilities={{ canChangeGroups: capabilities.canChangeGroups.toJsObject() }}
        />
        {capabilities.canChangeGroups.authorized &&
            <AddGroupToLedgerAccount ledgerAccountId={ledgerAccountId} availableGroups={availableGroups} />
        }
    </div>
}

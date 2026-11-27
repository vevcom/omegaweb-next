import LedgerAccountCard from './LedgerAccountCard'
import LedgerAccountGroupList from './LedgerAccountGroupList'
import AddGroupToLedgerAccount from './AddGroupToLedgerAccount'
import { componentWithSkeleton } from '@/app/componentWithSkeleton'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { ExpandedGroup } from '@/services/groups/types'

type Known = {
    ledgerAccountId: number,
    groupIds: number[],
    capabilities: Capabilities<'canChangeGroups'>,
}

type Read = {
    allGroups: ExpandedGroup[],
}

/** While it loads, the card has a row for each of the account's groups, whose names are what is read. */
export const LedgerAccountGroupsCard = componentWithSkeleton<Known, Read>(
    ({ ledgerAccountId, groupIds, capabilities, loaded, Skeleton, allGroups }) => (
        <LedgerAccountCard title="Grupper">
            {loaded ? (
                <LedgerAccountGroupList
                    ledgerAccountId={ledgerAccountId}
                    groups={allGroups.filter(group => groupIds.includes(group.id))}
                    capabilities={{ canChangeGroups: capabilities.canChangeGroups.toJsObject() }}
                />
            ) : <>
                {groupIds.map(groupId => (
                    <Skeleton key={groupId} className="my-2 h-[calc(1lh+2.25rem)] rounded-round text-l" />
                ))}
                {groupIds.length === 0 && <Skeleton className="h-lh w-72 text-s" />}
            </>}
            {capabilities.canChangeGroups.authorized && (loaded ? (
                <AddGroupToLedgerAccount
                    ledgerAccountId={ledgerAccountId}
                    availableGroups={allGroups.filter(group => !groupIds.includes(group.id))}
                />
            ) : <Skeleton className="mt-2 h-[calc(1lh+3rem)] w-80 text-m" />)}
        </LedgerAccountCard>
    )
)

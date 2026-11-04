'use client'
import ReorderableList from '@/components/UI/ReorderableList'
import { reorderCommitteesAction } from '@/services/groups/committees/actions'

type PropTypes = {
    committees: { id: number, name: string }[],
}

export default function CommitteeOrder({ committees }: PropTypes) {
    return (
        <ReorderableList
            items={committees}
            getId={committee => committee.id}
            saveOrder={committeeIds => reorderCommitteesAction({ data: { committeeIds } })}
            className="flex flex-col gap-1"
            itemClassName="flex items-center gap-4 py-2 px-4 bg-surface-raised"
            renderItem={(committee, { handle, index }) => (
                <>
                    {handle}
                    <span className="w-6 text-text-muted">{index + 1}</span>
                    <span>{committee.name}</span>
                </>
            )}
        />
    )
}

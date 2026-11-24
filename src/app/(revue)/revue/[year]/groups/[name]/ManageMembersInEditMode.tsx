'use client'
import ManageRevueSubGroupMembers from '@/app/(revue)/_components/ManageRevueSubGroupMembers'
import useEditMode from '@/hooks/useEditMode'
import { revueSubGroupAuth } from '@/services/groups/revueSubGroups/auth'
import type { ComponentProps } from 'react'

export default function ManageMembersInEditMode(props: ComponentProps<typeof ManageRevueSubGroupMembers>) {
    const editable = useEditMode({ authorizer: revueSubGroupAuth.addMembers.data({ groupId: props.groupId }) })

    if (!editable) return null
    return (
        <section className="flex flex-col gap-6">
            <h2 className="font-secondary text-xl">Administrer medlemmer</h2>
            <ManageRevueSubGroupMembers {...props} />
        </section>
    )
}

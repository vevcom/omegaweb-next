'use client'
import ManageGroupMembers from '@/components/Group/ManageGroupMembers'
import useAuthorizer from '@/hooks/useAuthorizer'
import useEditMode from '@/hooks/useEditMode'
import {
    addRevueSubGroupMembersAction,
    readRevueSubGroupAddableUsersAction,
    removeRevueSubGroupMembersAction,
    reorderRevueSubGroupMembersAction,
    setRevueSubGroupMemberAdminAction,
    setRevueSubGroupMemberTitleAction,
} from '@/services/groups/revueSubGroups/actions'
import { revueSubGroupAuth } from '@/services/groups/revueSubGroups/auth'
import type { ManageGroupMembersOrder } from '@/components/Group/ManageGroupMembers'

type PropTypes = {
    groupId: number,
    groupOrder: number,
    orders: ManageGroupMembersOrder[],
}

/** A sub group's members to add, title, make admin, order and remove, in edit mode. */
export default function ManageRevueSubGroupMembers({ groupId, groupOrder, orders }: PropTypes) {
    const editable = useEditMode({ authorizer: revueSubGroupAuth.addMembers.data({ groupId }) })
    const canReadAddableUsers = useAuthorizer({ authorizer: revueSubGroupAuth.readAddableUsers.data({ groupId }) })
    const canRemoveMembers = useAuthorizer({ authorizer: revueSubGroupAuth.removeMembers.data({ groupId }) })
    const canSetMemberAdmin = useAuthorizer({ authorizer: revueSubGroupAuth.setMemberAdmin.data({ groupId }) })
    const canSetMemberTitle = useAuthorizer({ authorizer: revueSubGroupAuth.setMemberTitle.data({ groupId }) })
    const canReorderMembers = useAuthorizer({ authorizer: revueSubGroupAuth.reorderMembers.data({ groupId }) })

    if (!editable) return null
    return (
        <section className="flex flex-col gap-6">
            <h2 className="font-secondary text-xl">Administrer medlemmer</h2>
            <ManageGroupMembers
                groupId={groupId}
                groupOrder={groupOrder}
                orders={orders}
                addMembersAction={addRevueSubGroupMembersAction}
                readAddableUsers={canReadAddableUsers.authorized ? readRevueSubGroupAddableUsersAction : undefined}
                removeMembersAction={canRemoveMembers.authorized ? removeRevueSubGroupMembersAction : undefined}
                setMemberAdminAction={canSetMemberAdmin.authorized ? setRevueSubGroupMemberAdminAction : undefined}
                setMemberTitleAction={canSetMemberTitle.authorized ? setRevueSubGroupMemberTitleAction : undefined}
                reorderMembersAction={canReorderMembers.authorized ? reorderRevueSubGroupMembersAction : undefined}
            />
        </section>
    )
}

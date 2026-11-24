'use client'
import ManageGroupMembers from '@/components/Group/ManageGroupMembers'
import useAuthorizer from '@/hooks/useAuthorizer'
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

/** A sub group's members to add, title, make admin, order and remove, each as far as the viewer may. */
export default function ManageRevueSubGroupMembers({ groupId, groupOrder, orders }: PropTypes) {
    const canAddMembers = useAuthorizer({ authorizer: revueSubGroupAuth.addMembers.data({ groupId }) })
    const canReadAddableUsers = useAuthorizer({ authorizer: revueSubGroupAuth.readAddableUsers.data({ groupId }) })
    const canRemoveMembers = useAuthorizer({ authorizer: revueSubGroupAuth.removeMembers.data({ groupId }) })
    const canSetMemberAdmin = useAuthorizer({ authorizer: revueSubGroupAuth.setMemberAdmin.data({ groupId }) })
    const canSetMemberTitle = useAuthorizer({ authorizer: revueSubGroupAuth.setMemberTitle.data({ groupId }) })
    const canReorderMembers = useAuthorizer({ authorizer: revueSubGroupAuth.reorderMembers.data({ groupId }) })

    return <ManageGroupMembers
        groupId={groupId}
        groupOrder={groupOrder}
        orders={orders}
        addMembersAction={canAddMembers.authorized ? addRevueSubGroupMembersAction : undefined}
        readAddableUsers={canReadAddableUsers.authorized ? readRevueSubGroupAddableUsersAction : undefined}
        removeMembersAction={canRemoveMembers.authorized ? removeRevueSubGroupMembersAction : undefined}
        setMemberAdminAction={canSetMemberAdmin.authorized ? setRevueSubGroupMemberAdminAction : undefined}
        setMemberTitleAction={canSetMemberTitle.authorized ? setRevueSubGroupMemberTitleAction : undefined}
        reorderMembersAction={canReorderMembers.authorized ? reorderRevueSubGroupMembersAction : undefined}
    />
}

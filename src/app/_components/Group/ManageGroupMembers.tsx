'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber } from '@/components/UI/Select'
import UserList from '@/components/User/UserList/UserList'
import { configureAction } from '@/services/configureAction'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { useContext, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
    AddGroupMembersAction,
    RemoveGroupMembersAction,
    SetGroupMemberAdminAction,
    SetGroupMemberTitleAction,
} from '@/services/groups/types'
import type { PopUpKeyType } from '@/contexts/PopUp'

export type ManageGroupMembersMember = {
    userId: number,
    name: string,
    title: string,
    admin: boolean,
    active: boolean,
}

export type ManageGroupMembersOrder = {
    order: number,
    members: ManageGroupMembersMember[],
}

type PropTypes = {
    groupId: number,
    /**
     * The order the group itself stands in. It is what the UI opens on, and the only order whose
     * memberships are the group's current ones - the rest are history.
     */
    groupOrder: number,
    /**
     * The group's memberships grouped by the order they belong to. Every order the group has
     * memberships in should be here, including `groupOrder` even when it has none yet.
     */
    orders: ManageGroupMembersOrder[],
    /**
     * The member management actions of the group type in question. Every group type that implements
     * simple member management exposes the same shapes, which is what this component is written
     * against. Leave one out and that part of the UI is not offered.
     */
    addMembersAction?: AddGroupMembersAction,
    removeMembersAction?: RemoveGroupMembersAction,
    setMemberAdminAction?: SetGroupMemberAdminAction,
    setMemberTitleAction?: SetGroupMemberTitleAction,
}

/**
 * Picks users out of the user list and adds them to the group at the order being managed.
 *
 * Removing deactivates the membership rather than deleting it, so the group's history of the order
 * stays intact - which is why a removed member goes inactive here rather than disappearing.
 *
 * Adding to an order below the group's own gives an inactive membership, since a group migrated by
 * hand holds no active memberships below its own order. Every group type that exposes these actions
 * today is migrated by hand; the note about it would need revisiting if that changed.
 */
function AddMembers({ groupId, order, addMembersAction, popUpKey }: {
    groupId: number,
    order: number,
    addMembersAction: AddGroupMembersAction,
    popUpKey: PopUpKeyType,
}) {
    const selection = useContext(UsersSelectionContext)
    const selectedUsers = selection?.users ?? []

    return (
        <div className="flex flex-col gap-2 min-w-[min(80vw,700px)]">
            {selectedUsers.length > 0 && (
                <Form
                    submitText={`Legg til ${selectedUsers.length} bruker(e) i orden ${order}`}
                    action={() => configureAction(addMembersAction, { params: { groupId, order } })({
                        data: {
                            users: selectedUsers.map(user => ({ userId: user.id, admin: false })),
                        },
                    })}
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                />
            )}
            <UserList />
        </div>
    )
}

export default function ManageGroupMembers({
    groupId,
    groupOrder,
    orders,
    addMembersAction,
    removeMembersAction,
    setMemberAdminAction,
    setMemberTitleAction,
}: PropTypes) {
    const [selectedOrder, setSelectedOrder] = useState(groupOrder)
    const addPopUpKey: PopUpKeyType = `Add members to group ${groupId} order ${selectedOrder}`

    const members = orders.find(order => order.order === selectedOrder)?.members ?? []

    // Every row is its own grid, so the columns only line up across rows if they are all laid out
    // against the same track list. The actions that are not offered at all drop their column rather
    // than leaving a gap.
    const memberColumns = [
        'minmax(6rem, 1fr)',
        setMemberTitleAction ? '20rem' : 'minmax(6rem, 1fr)',
        '9rem',
        ...(setMemberAdminAction ? ['10.5rem'] : []),
        ...(removeMembersAction ? ['6rem'] : []),
    ].join(' ')
    const columnStyle = { '--member-columns': memberColumns } as CSSProperties

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 items-start">
                <SelectNumber
                    name={`order-of-group-${groupId}`}
                    label="Orden"
                    value={selectedOrder}
                    onChange={setSelectedOrder}
                    options={orders.map(order => ({
                        value: order.order,
                        label: order.order === groupOrder
                            ? `${order.order} (gruppens orden)`
                            : `${order.order}`,
                        key: `${order.order}`,
                    }))}
                />
                {selectedOrder !== groupOrder && (
                    <p className="text-text-muted text-s">
                        Orden {selectedOrder} er historikk - gruppen selv står i orden {groupOrder}.
                        Medlemmer som legges til her blir lagt til som inaktive medlemskap.
                    </p>
                )}
            </div>

            {addMembersAction && (
                <PopUp
                    key={selectedOrder}
                    popUpKey={addPopUpKey}
                    showButtonClass="secondary-btn self-start py-2 px-4 text-s"
                    showButtonContent={<>Legg til medlemmer</>}
                >
                    <UserPagingProvider
                        serverRenderedData={[]}
                        startPage={{ page: 0, pageSize: 50 }}
                        details={{ groups: [], partOfName: '' }}
                    >
                        <UsersSelectionProvider>
                            <AddMembers
                                groupId={groupId}
                                order={selectedOrder}
                                addMembersAction={addMembersAction}
                                popUpKey={addPopUpKey}
                            />
                        </UsersSelectionProvider>
                    </UserPagingProvider>
                </PopUp>
            )}

            {members.length === 0 ? (
                <p className="text-text-muted italic">Gruppen har ingen medlemskap i orden {selectedOrder}.</p>
            ) : (
                <div className="flex flex-col gap-1">
                    <div className={[
                        'grid grid-cols-(--member-columns) items-center',
                        'gap-4 px-4 text-text-muted text-s max-mobile:hidden',
                    ].join(' ')} style={columnStyle}>
                        <span>Navn</span>
                        <span>Tittel</span>
                        <span>Status</span>
                        {setMemberAdminAction && <span />}
                        {removeMembersAction && <span />}
                    </div>
                    {members.map(member => (
                        // Keyed by order as well as user: the title input is uncontrolled, so a row
                        // React reuses across an order change would keep the value it already has
                        // and ignore the new order's `defaultValue`. The same user is usually a
                        // member of several orders, which is exactly when that bites.
                        <div
                            className={[
                                'grid grid-cols-(--member-columns) items-center gap-4 py-2 px-4 rounded-round layer',
                                'max-mobile:grid-cols-1 max-mobile:gap-2',
                                // Form reserves a line for validation messages; down a list of one-field rows that
                                // doubles the height for nothing, so it only takes space once it has something to say.
                                '[&_p:empty]:min-h-0 [&_p:empty]:m-0',
                            ].join(' ')}
                            style={columnStyle}
                            key={`${selectedOrder}-${member.userId}`}
                        >
                            <span className="min-w-0 text-text truncate">{member.name}</span>
                            {setMemberTitleAction ? (
                                <Form
                                    className="flex flex-row items-center gap-2 w-auto! [&>*:last-child]:mt-0"
                                    buttonClassName="w-[5.5rem]!"
                                    submitText="Lagre"
                                    submitColor="secondary"
                                    action={formData => {
                                        const title = formData.get('title')
                                        return configureAction(
                                            setMemberTitleAction, { params: { groupId, order: selectedOrder } }
                                        )({
                                            data: {
                                                userId: member.userId,
                                                title: typeof title === 'string' ? title : '',
                                            },
                                        })
                                    }}
                                    refreshOnSuccess
                                >
                                    <TextInput
                                        className="w-[12rem]"
                                        name="title"
                                        label="Tittel"
                                        defaultValue={member.title}
                                    />
                                </Form>
                            ) : (
                                <span className="text-text-muted text-s">{member.title}</span>
                            )}
                            <span className="flex gap-1">
                                {member.admin && <span className={[
                                    'px-2 rounded-round border text-s whitespace-nowrap',
                                    'border-accent-blue text-accent-blue',
                                ].join(' ')}>Admin</span>}
                                {!member.active && <span className={[
                                    'px-2 rounded-round border text-s whitespace-nowrap',
                                    'border-text-muted text-text-muted',
                                ].join(' ')}>Inaktiv</span>}
                            </span>
                            {/* The action cells are rendered even when this member cannot use them,
                                so that a row without them keeps the grid's columns. */}
                            {setMemberAdminAction && (
                                <span className="min-w-0 [&_button]:w-full [&>*:last-child]:mt-0">
                                    <Form
                                        submitText={member.admin ? 'Fjern admin' : 'Gjør til admin'}
                                        submitColor="secondary"
                                        action={() => configureAction(
                                            setMemberAdminAction, { params: { groupId, order: selectedOrder } }
                                        )({ data: { userId: member.userId, admin: !member.admin } })}
                                        refreshOnSuccess
                                    />
                                </span>
                            )}
                            {removeMembersAction && (
                                <span className="min-w-0 [&_button]:w-full [&>*:last-child]:mt-0">
                                    {member.active && (
                                        <Form
                                            submitText="Fjern"
                                            submitColor="red"
                                            action={() => configureAction(
                                                removeMembersAction, { params: { groupId, order: selectedOrder } }
                                            )({ data: { userIds: [member.userId] } })}
                                            refreshOnSuccess
                                            confirmation={{
                                                confirm: true,
                                                text: `Fjerne ${member.name} fra gruppen i orden `
                                                    + `${selectedOrder}? Medlemskapet blir satt inaktivt.`
                                            }}
                                        />
                                    )}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

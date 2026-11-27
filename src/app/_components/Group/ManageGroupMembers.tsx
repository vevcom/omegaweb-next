'use client'
import { buttonClassName } from '@/components/UI/buttonClassName'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import Checkbox from '@/components/UI/Checkbox'
import { SelectNumber } from '@/components/UI/Select'
import UserList from '@/components/User/UserList/UserList'
import ReorderableList from '@/components/UI/ReorderableList'
import { configureAction } from '@/services/configureAction'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { useContext, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { UserDetails, UserPageReader } from '@/services/users/types'
import type {
    AddGroupMembersAction,
    DestroyGroupMembershipAction,
    RemoveGroupMembersAction,
    ReorderGroupMembersAction,
    SetGroupMemberAdminAction,
    SetGroupMemberTitleAction,
} from '@/services/groups/types'
import type { PopUpKeyType } from '@/contexts/PopUp'

/**
 * Where a member row stacks, by the least width its columns need in rem. The rows stack by the width of the
 * component, not the screen, since it is mounted in columns of many widths. The class names are whole for Tailwind.
 */
const stackings = [
    { belowRem: 32, row: '@max-[32rem]:grid-cols-1 @max-[32rem]:gap-2', header: '@max-[32rem]:hidden' },
    { belowRem: 57.5, row: '@max-[57.5rem]:grid-cols-1 @max-[57.5rem]:gap-2', header: '@max-[57.5rem]:hidden' },
    { belowRem: 60, row: '@max-[60rem]:grid-cols-1 @max-[60rem]:gap-2', header: '@max-[60rem]:hidden' },
]

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
    /** Given, the members can be dragged into the order they are listed in. */
    reorderMembersAction?: ReorderGroupMembersAction,
    /** Given, any membership can be deleted for good, at every order. */
    destroyMembershipAction?: DestroyGroupMembershipAction,
    /** The group's own order lists its active members, with a switch to show the inactive ones too. */
    hidesInactiveByDefault?: boolean,
    /** For a group type that follows Omega's order, where a membership added to an earlier order is active too. */
    keepsEarlierOrdersActive?: boolean,
    /** Reads the users to add among. Left out, they are the user list's own: the active students. */
    readAddableUsers?: (page: { params: Parameters<UserPageReader>[0]['params'] & { groupId: number } }) =>
        ReturnType<UserPageReader>,
}

/**
 * Picks users out of the user list and adds them to the group at the order being managed.
 *
 * Removing deactivates the membership rather than deleting it, so the group's history of the order
 * stays intact - which is why a removed member goes inactive here rather than disappearing.
 *
 * Adding to an order below the group's own gives an inactive membership, since a group migrated by
 * hand holds no active memberships below its own order. A group type that follows Omega's order keeps
 * them active, which its mount says with `keepsEarlierOrdersActive`.
 */
function AddMembers({ groupId, order, addMembersAction, popUpKey, onAdded }: {
    groupId: number,
    /** Null while no order is chosen, which keeps the users picked and offers nothing to submit. */
    order: number | null,
    addMembersAction: AddGroupMembersAction,
    popUpKey: PopUpKeyType,
    onAdded?: () => void,
}) {
    const selection = useContext(UsersSelectionContext)
    const selectedUsers = selection?.users ?? []

    return (
        <div className="flex flex-col gap-2 min-w-[min(80vw,700px)]">
            {order !== null && selectedUsers.length > 0 && (
                <Form
                    submitText={`Legg til ${selectedUsers.length} bruker(e) i orden ${order}`}
                    action={() => configureAction(addMembersAction, { params: { groupId, order } })({
                        data: {
                            users: selectedUsers.map(user => ({ userId: user.id, admin: false })),
                        },
                    })}
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                    successCallback={onAdded}
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
    reorderMembersAction,
    destroyMembershipAction,
    hidesInactiveByDefault = false,
    keepsEarlierOrdersActive = false,
    readAddableUsers,
}: PropTypes) {
    const [pickedOrder, setSelectedOrder] = useState(groupOrder)
    // An order whose last membership was deleted is no longer one of the group's.
    const selectedOrder = orders.some(order => order.order === pickedOrder) ? pickedOrder : groupOrder
    const [showsInactive, setShowsInactive] = useState(false)
    // The same object across renders, since the list starts over when its details are replaced.
    const userListDetails = useMemo((): UserDetails => ({
        groups: [],
        partOfName: '',
        readPage: readAddableUsers && (({ params }) => readAddableUsers({ params: { ...params, groupId } })),
    }), [readAddableUsers, groupId])
    const addPopUpKey: PopUpKeyType = `Add members to group ${groupId} order ${selectedOrder}`
    const addAtTypedOrderPopUpKey: PopUpKeyType = `Add members to group ${groupId} at a typed order`

    const offersInactiveSwitch = hidesInactiveByDefault && selectedOrder === groupOrder
    const hidesInactive = offersInactiveSwitch && !showsInactive
    // The same lists across renders, since the reorderable list starts over when it is given another.
    const membersOfOrder = useMemo(
        () => orders.find(order => order.order === selectedOrder)?.members ?? [],
        [orders, selectedOrder],
    )
    const members = useMemo(
        () => (hidesInactive ? membersOfOrder.filter(member => member.active) : membersOfOrder),
        [membersOfOrder, hidesInactive],
    )

    // Removing and deleting share a column, so a row needs no more width for the one than for the other.
    const takesOut = Boolean(removeMembersAction) || Boolean(destroyMembershipAction)
    // Every row is its own grid, so the columns only line up across rows if they are all laid out
    // against the same track list. The actions that are not offered at all drop their column rather
    // than leaving a gap.
    const memberColumns = [
        ...(reorderMembersAction ? [{ track: '1.5rem', minRem: 1.5 }] : []),
        { track: 'minmax(6rem, 1fr)', minRem: 6 },
        setMemberTitleAction ? { track: '20rem', minRem: 20 } : { track: 'minmax(6rem, 1fr)', minRem: 6 },
        { track: '9rem', minRem: 9 },
        ...(setMemberAdminAction ? [{ track: '10.5rem', minRem: 10.5 }] : []),
        ...(takesOut ? [{ track: '6rem', minRem: 6 }] : []),
    ]
    const columnStyle = { '--member-columns': memberColumns.map(column => column.track).join(' ') } as CSSProperties
    // The tracks, the gap-4 between them and the px-4 around them.
    const rowMinRem = memberColumns.reduce((sum, column) => sum + column.minRem, 0) + memberColumns.length - 1 + 2
    const stacking = stackingFor(rowMinRem)
    const memberRowClassName = `
        grid grid-cols-(--member-columns) items-center gap-4 py-2 px-4 rounded-round layer
        ${stacking.row}
        [&_p:empty]:min-h-0 [&_p:empty]:m-0
    `

    const memberCells = (member: ManageGroupMembersMember) => (
        <>
            <span className="min-w-0 text-base-content truncate">{member.name}</span>
            {setMemberTitleAction ? (
                <Form
                    className="
                        flex flex-row items-center gap-2 w-auto!
                        [&>*:last-child]:mt-0
                    "
                    buttonClassName="w-[5.5rem]!"
                    submitText="Lagre"
                    submitColor="neutral"
                    action={configureAction(setMemberTitleAction, { params: { groupId, order: selectedOrder } })}
                    refreshOnSuccess
                >
                    <input type="hidden" name="userId" value={member.userId} />
                    <TextInput
                        className="w-[12rem]"
                        name="title"
                        label="Tittel"
                        defaultValue={member.title}
                    />
                </Form>
            ) : (
                <span className="text-base-content/80 text-s">{member.title}</span>
            )}
            <span className="flex gap-1">
                {member.admin && <span className="
                    px-2 rounded-round border text-s whitespace-nowrap border-primary text-primary
                ">Administrator</span>}
                {!member.active && <span className="
                    px-2 rounded-round border text-s whitespace-nowrap border-base-content/80 text-base-content/80
                ">Inaktiv</span>}
            </span>
            {/* The action cells are rendered even when this member cannot use them,
                so that a row without them keeps the grid's columns. */}
            {setMemberAdminAction && (
                <span className="
                    min-w-0
                    [&_button]:w-full
                    [&>*:last-child]:mt-0
                ">
                    <Form
                        submitText={member.admin ? 'Fjern admin' : 'Gjør til admin'}
                        submitColor="neutral"
                        action={configureAction(setMemberAdminAction, { params: { groupId, order: selectedOrder } })}
                        refreshOnSuccess
                    >
                        <input type="hidden" name="userId" value={member.userId} />
                        {!member.admin && <input type="hidden" name="admin" value="on" />}
                    </Form>
                </span>
            )}
            {takesOut && (
                <span className="
                    flex flex-col gap-1 min-w-0
                    [&_button]:w-full
                    [&>*]:mt-0
                ">
                    {removeMembersAction && member.active && (
                        <Form
                            submitText="Fjern"
                            submitColor="error"
                            action={configureAction(removeMembersAction, { params: { groupId, order: selectedOrder } })}
                            refreshOnSuccess
                            confirmation={{
                                confirm: true,
                                text: `Fjerne ${member.name} fra gruppen i orden `
                                    + `${selectedOrder}? Medlemskapet blir satt inaktivt.`
                            }}
                        >
                            <input type="hidden" name="userIds" value={member.userId} />
                        </Form>
                    )}
                    {destroyMembershipAction && (
                        <Form
                            submitText="Slett"
                            submitColor="neutral"
                            action={configureAction(destroyMembershipAction, { params: { groupId, order: selectedOrder } })}
                            refreshOnSuccess
                            confirmation={{ confirm: true, text: destroyConfirmation(member, selectedOrder) }}
                        >
                            <input type="hidden" name="userId" value={member.userId} />
                        </Form>
                    )}
                </span>
            )}
        </>
    )

    return (
        <div className="@container flex flex-col gap-4">
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
                {offersInactiveSwitch && (
                    <Checkbox
                        name={`shows-inactive-${groupId}`}
                        label={`Vis også de inaktive i orden ${selectedOrder}`}
                        checked={showsInactive}
                        onChange={() => setShowsInactive(!showsInactive)}
                    />
                )}
                {selectedOrder !== groupOrder && !keepsEarlierOrdersActive && (
                    <p className="text-base-content/80 text-s">
                        Orden {selectedOrder} er historikk - gruppen selv står i orden {groupOrder}.
                        Medlemmer som legges til her blir lagt til som inaktive medlemskap.
                    </p>
                )}
            </div>

            {addMembersAction && (
                <div className="flex flex-wrap gap-2">
                    <PopUp
                        key={selectedOrder}
                        popUpKey={addPopUpKey}
                        showButtonClass={buttonClassName({ color: 'neutral', size: 's' })}
                        showButtonContent={<>Legg til medlemmer i orden {selectedOrder}</>}
                    >
                        <UserPagingProvider
                            serverRenderedData={[]}
                            startPage={{ page: 0, pageSize: 50 }}
                            details={userListDetails}
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
                    <PopUp
                        popUpKey={addAtTypedOrderPopUpKey}
                        showButtonClass={buttonClassName({ color: 'neutral', size: 's' })}
                        showButtonContent={<>Legg til medlemmer i en annen orden</>}
                    >
                        <AddMembersAtTypedOrder
                            groupId={groupId}
                            groupOrder={groupOrder}
                            addMembersAction={addMembersAction}
                            popUpKey={addAtTypedOrderPopUpKey}
                            userListDetails={userListDetails}
                            keepsEarlierOrdersActive={keepsEarlierOrdersActive}
                            onAdded={setSelectedOrder}
                        />
                    </PopUp>
                </div>
            )}

            {members.length === 0 ? (
                <p className="text-base-content/80 italic">
                    Gruppen har ingen {membersOfOrder.length ? 'aktive medlemmer' : 'medlemskap'} i orden {selectedOrder}.
                </p>
            ) : (
                <div className="flex flex-col gap-1">
                    <div className={`
                        grid grid-cols-(--member-columns) items-center gap-4 px-4 text-base-content/80 text-s
                        ${stacking.header}
                    `} style={columnStyle}>
                        {reorderMembersAction && <span />}
                        <span>Navn</span>
                        <span>Tittel</span>
                        <span>Status</span>
                        {setMemberAdminAction && <span />}
                        {takesOut && <span />}
                    </div>
                    {reorderMembersAction ? (
                        // Remounted per order, since the title inputs are uncontrolled.
                        <ReorderableList
                            key={selectedOrder}
                            items={members}
                            getId={member => member.userId}
                            saveOrder={shownUserIds => configureAction(
                                reorderMembersAction, { params: { groupId, order: selectedOrder } }
                            )({ data: { userIds: withHiddenInPlace(membersOfOrder, members, shownUserIds) } })}
                            className="flex flex-col gap-1"
                            itemClassName={memberRowClassName}
                            itemStyle={columnStyle}
                            renderItem={(member, { handle }) => <>{handle}{memberCells(member)}</>}
                        />
                    ) : members.map(member => (
                        // Keyed by order as well as user: the title input is uncontrolled, so a row
                        // React reuses across an order change would keep the value it already has
                        // and ignore the new order's `defaultValue`. The same user is usually a
                        // member of several orders, which is exactly when that bites.
                        <div
                            className={memberRowClassName}
                            style={columnStyle}
                            key={`${selectedOrder}-${member.userId}`}
                        >
                            {memberCells(member)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * The order picker lists only the orders the group has memberships in, so this is how the first member of any
 * other order is added: the order is typed, up to the group's own.
 */
function AddMembersAtTypedOrder({
    groupId,
    groupOrder,
    addMembersAction,
    popUpKey,
    userListDetails,
    keepsEarlierOrdersActive,
    onAdded,
}: {
    groupId: number,
    groupOrder: number,
    addMembersAction: AddGroupMembersAction,
    popUpKey: PopUpKeyType,
    userListDetails: UserDetails,
    keepsEarlierOrdersActive: boolean,
    onAdded: (order: number) => void,
}) {
    const [typed, setTyped] = useState('')
    const order = orderOf(typed, groupOrder)

    return (
        <div className="flex flex-col gap-2">
            <NumberInput label="Orden" min={1} max={groupOrder} onChange={event => setTyped(event.target.value)} />
            <p className="text-base-content/80 text-s">
                Velg en orden til og med gruppens egen, {groupOrder}.
                {!keepsEarlierOrdersActive && ' I en tidligere orden blir medlemmene lagt til som inaktive medlemskap.'}
            </p>
            {typed.trim() !== '' && order === null && (
                <p className="text-error text-s" role="alert">Ordenen må være et helt tall fra 1 til {groupOrder}.</p>
            )}
            <UserPagingProvider serverRenderedData={[]} startPage={{ page: 0, pageSize: 50 }} details={userListDetails}>
                <UsersSelectionProvider>
                    <AddMembers
                        groupId={groupId}
                        order={order}
                        addMembersAction={addMembersAction}
                        popUpKey={popUpKey}
                        onAdded={() => order !== null && onAdded(order)}
                    />
                </UsersSelectionProvider>
            </UserPagingProvider>
        </div>
    )
}

/** The order typed, when it is one the group can have memberships in. */
function orderOf(typed: string, groupOrder: number) {
    const order = Number(typed)
    return typed.trim() !== '' && Number.isInteger(order) && order >= 1 && order <= groupOrder ? order : null
}

function destroyConfirmation(member: ManageGroupMembersMember, order: number) {
    const kept = member.active
        ? `Har ${member.name} gått ut av gruppen, bruk «Fjern» i stedet: da står medlemskapet igjen i gruppens historikk.`
        : 'Det er inaktivt og står i gruppens historikk.'
    return `Slette medlemskapet til ${member.name} i orden ${order} for godt? ${kept} `
        + '«Slett» er for et medlemskap som aldri skulle vært der, og kan ikke angres.'
}

/** The whole order's members, with those shown in their new order and those hidden kept in their places. */
function withHiddenInPlace(
    all: ManageGroupMembersMember[],
    shown: ManageGroupMembersMember[],
    shownUserIds: number[],
) {
    const shownIds = new Set(shown.map(member => member.userId))
    let next = 0
    return all.map(member => (shownIds.has(member.userId) ? shownUserIds[next++] : member.userId))
}

function stackingFor(rowMinRem: number) {
    // A column set not listed stacks at the next listed width up, a little early. One past the widest needs its own.
    return stackings.find(stacking => stacking.belowRem >= rowMinRem) ?? stackings[stackings.length - 1]
}

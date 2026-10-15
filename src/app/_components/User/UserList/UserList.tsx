'use client'
import Dropdown from '@/components/UI/Dropdown'
import SearchableDropdown from '@/components/UI/SearchableDropdown'
import TextInput from '@/components/UI/TextInput'
import { UserPagingContext } from '@/contexts/paging/UserPaging'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import UserRow from '@/components/User/UserList/UserRow'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { orderOptions } from '@/lib/groups/groupOptions'
import { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserSelectionContext } from '@/contexts/UserSelection'
import { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import type { UserPagingReturn } from '@/services/users/types'
import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import type { GroupType } from '@/prisma-generated-pn-types'
import type { ExpandedGroup, ExpandedGroupsOfAllTypes } from '@/services/groups/types'

type GroupSelectionType = Exclude<GroupType, 'INTEREST_GROUP' | 'MANUAL_GROUP'>

type DisableGroupFilters = Partial<Record<GroupSelectionType, boolean>>

type SortField = 'name' | 'username'

type PropTypes = {
    className?: string
    displayForUser?: (user: UserPagingReturn) => ReactNode
    disableFilters?: DisableGroupFilters & {
        name?: boolean,
    },
    linksToUser?: boolean,
    /**
     * Where a row leads when `linksToUser` is set. Defaults to the user's profile.
     */
    userHref?: (user: UserPagingReturn) => string,
}

function getGroupType(groups: ExpandedGroupsOfAllTypes | null, type: GroupType) {
    return groups?.[type] ?? []
}

function getGroupOptions(
    groups: ExpandedGroupsOfAllTypes | null,
    type: GroupType
): { value: number | 'NULL', label: string, key: string }[] {
    return [
        ...getGroupType(groups, type).map(group => ({
            value: group.id,
            label: group.name,
            key: group.id.toString()
        })),
        {
            value: 'NULL',
            label: 'Alle',
            key: 'NULL'
        },
    ]
}

function getOrdereOptions(group: ExpandedGroup): { value: number | 'NULL', label: string, key: string }[] {
    return [
        ...orderOptions(group),
        {
            value: 'NULL',
            label: 'Alle aktive',
            key: 'NULL'
        },
    ]
}

const sortableClassName = 'p-0! select-none whitespace-nowrap hover:text-accent-blue'
const sortButtonClassName = [
    'w-full h-auto block py-3 px-4 [font:inherit] text-inherit [text-align:inherit]',
    'border-none bg-transparent rounded-round cursor-pointer',
].join(' ')

/**
 * Display users in UserPagingContext with filters for groups and a search bar.
 * @param className - The class name of the component
 * @param displayForUser - A function that returns a ReactNode for each user. It is displayed
 * to the left of the user's name, username, study, and class.
 * @param disableFilters - An object that specifies which filters to disable. The keys are the
 * names of the filters and the values are booleans. If a key is not present, the filter is enabled.
 * @param linksToUser - Whether clicking a row navigates to the user it is for.
 * @param userHref - Where such a click leads, if not the user's profile.
 * @returns - A component that displays a list of users with filters for groups and a search bar.
 */
export default function UserList({
    className,
    displayForUser,
    disableFilters = {
        name: false,
        COMMITTEE: false,
        CLASS: false,
        STUDY_PROGRAMME: false,
        OMEGA_MEMBERSHIP_GROUP: false
    },
    linksToUser,
    userHref = user => `/users/${user.username}`,
}: PropTypes) {
    const userPaging = useContext(UserPagingContext)
    const usersSelection = useContext(UsersSelectionContext)
    const userSelection = useContext(UserSelectionContext)
    const router = useRouter()

    const groupSelected = !!userPaging?.details.selectedGroup

    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? groupsResult.groups : null
    const [groupSelection, setGroupSelection] = useState<Record<GroupSelectionType, {
            group: ExpandedGroup | null,
            groupOrder: number | 'ACTIVE'
        }>>({
            COMMITTEE: {
                group: null,
                groupOrder: 'ACTIVE'
            },
            CLASS: {
                group: null,
                groupOrder: 'ACTIVE'
            },
            STUDY_PROGRAMME: {
                group: null,
                groupOrder: 'ACTIVE'
            },
            OMEGA_MEMBERSHIP_GROUP: {
                group: null,
                groupOrder: 'ACTIVE'
            }
        })

    useEffect(() => {
        userPaging?.setDetails({
            ...userPaging.details,
            groups: Object.values(groupSelection).reduce((acc, { group, groupOrder }) => {
                if (group) {
                    acc.push({
                        groupId: group.id,
                        groupOrder
                    })
                }
                return acc
            }, [] as { groupId: number, groupOrder: number | 'ACTIVE' }[])
        })
    }, [groupSelection])

    if (!userPaging) throw new Error('Fant ikke UserPagingContext')

    const currentSort = userPaging.details.sort

    // Navn, Brukernavn, Studie and Klasse are always there, the rest follow the same
    // conditions as the header cells below. Used to span the loading row across the table.
    const columnCount = 4 +
        (usersSelection || userSelection ? 1 : 0) +
        (displayForUser ? 1 : 0) +
        (groupSelected ? 2 : 0)

    const handleChangeName = (e: ChangeEvent<HTMLInputElement>) => {
        userPaging.setDetails({ ...userPaging.details, partOfName: e.target.value })
    }

    const handleSort = (field: SortField) => {
        const direction = currentSort?.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc'
        userPaging.setDetails({ ...userPaging.details, sort: { field, direction } })
    }

    const sortIcon = (field: SortField) => {
        if (currentSort?.field !== field) return <FontAwesomeIcon icon={faSort} className="ml-1 text-[0.85em]" />
        return (
            <FontAwesomeIcon
                icon={currentSort.direction === 'asc' ? faSortUp : faSortDown}
                className="ml-1 text-[0.85em]"
            />
        )
    }

    const ariaSort = (field: SortField) => {
        if (currentSort?.field !== field) return undefined
        return currentSort.direction === 'asc' ? 'ascending' : 'descending'
    }

    const handleGroupSelect = (groupId: number | 'NULL', type: GroupSelectionType) => {
        if (!groups) return
        setGroupSelection({
            ...groupSelection,
            [type]: {
                ...groupSelection[type],
                group: flattenExpandedGroups(groups).find(group => group.id === groupId) ?? null,
            }
        })
    }

    const handleGroupOrderSelect = (order: number | 'NULL', type: GroupSelectionType) => {
        const groupOrder = order === 'NULL' ? null : order
        setGroupSelection({
            ...groupSelection,
            [type]: {
                ...groupSelection[type],
                groupOrder,
            }
        })
    }

    const stopSelectionClickPropagation = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
    }

    return (
        <div className={`${'h-full flex flex-col'} ${className}`}>
            <div className="w-full flex flex-row flex-wrap items-end mb-2 gap-4">
                {
                    !disableFilters.name && (
                        <TextInput
                            name="partOfName"
                            label="Navn"
                            onChange={handleChangeName}
                            className="mt-0!"
                        />
                    )
                }
                {
                    !disableFilters.COMMITTEE && (
                        <div className="flex flex-col gap-2 min-w-[150px]">
                            <SearchableDropdown
                                name="komite"
                                label="Komité"
                                onChange={groupId => handleGroupSelect(groupId, 'COMMITTEE')}
                                options={getGroupOptions(groups, 'COMMITTEE')}
                            />
                            {
                                groupSelection.COMMITTEE.group && <Dropdown
                                    name="orden"
                                    label="Orden"
                                    onChange={order => handleGroupOrderSelect(order, 'COMMITTEE')}
                                    options={getOrdereOptions(groupSelection.COMMITTEE.group)}
                                />
                            }
                        </div>
                    )
                }
                {
                    !disableFilters.CLASS && (
                        <div className="flex flex-col gap-2 min-w-[150px]">
                            <Dropdown
                                name="klasse"
                                label="Klasse"
                                onChange={groupId => handleGroupSelect(groupId, 'CLASS')}
                                options={getGroupOptions(groups, 'CLASS')}
                            />
                            {
                                groupSelection.CLASS.group && <Dropdown
                                    name="orden"
                                    label="Orden"
                                    onChange={order => handleGroupOrderSelect(order, 'CLASS')}
                                    options={getOrdereOptions(groupSelection.CLASS.group)}
                                />
                            }
                        </div>
                    )
                }
                {
                    !disableFilters.STUDY_PROGRAMME && (
                        <div className="flex flex-col gap-2 min-w-[150px]">
                            <Dropdown
                                name="studie"
                                label="Studieprogram"
                                onChange={groupId => handleGroupSelect(groupId, 'STUDY_PROGRAMME')}
                                options={getGroupOptions(groups, 'STUDY_PROGRAMME')}
                            />
                            {
                                groupSelection.STUDY_PROGRAMME.group && <Dropdown
                                    name="orden"
                                    label="Orden"
                                    onChange={order => handleGroupOrderSelect(order, 'STUDY_PROGRAMME')}
                                    options={getOrdereOptions(groupSelection.STUDY_PROGRAMME.group)}
                                />
                            }
                        </div>
                    )
                }
                {
                    !disableFilters.OMEGA_MEMBERSHIP_GROUP && (
                        <div className="flex flex-col gap-2 min-w-[150px]">
                            <Dropdown
                                name="medlemskap"
                                label="Medlemskap"
                                onChange={groupId => handleGroupSelect(groupId, 'OMEGA_MEMBERSHIP_GROUP')}
                                options={getGroupOptions(groups, 'OMEGA_MEMBERSHIP_GROUP')}
                            />
                            {
                                groupSelection.OMEGA_MEMBERSHIP_GROUP.group && <Dropdown
                                    name="orden"
                                    label="Orden"
                                    onChange={order => handleGroupOrderSelect(order, 'OMEGA_MEMBERSHIP_GROUP')}
                                    options={getOrdereOptions(groupSelection.OMEGA_MEMBERSHIP_GROUP.group)}
                                />
                            }
                        </div>
                    )
                }
            </div>
            <div className="flex-auto overflow-y-auto">
                <table className={[
                    'ohma-table m-0! [&_td_button]:border-none [&_td_button]:bg-transparent [&_td_button]:size-[25px]',
                    '[&_td_button]:grid [&_td_button]:place-items-center [&_td_button]:rounded-round',
                    '[&_td_button]:cursor-pointer',
                ].join(' ')}>
                    <thead>
                        <tr className="sticky top-0 z-1">
                            {(usersSelection ?? userSelection) && <th></th>}
                            {displayForUser && <th></th>}
                            <th className={sortableClassName} aria-sort={ariaSort('name')}>
                                <button type="button" className={sortButtonClassName} onClick={() => handleSort('name')}>
                                    Navn {sortIcon('name')}
                                </button>
                            </th>
                            <th className={sortableClassName} aria-sort={ariaSort('username')}>
                                <button type="button" className={sortButtonClassName} onClick={() => handleSort('username')}>
                                    Brukernavn {sortIcon('username')}
                                </button>
                            </th>
                            <th>Studie</th>
                            <th>Klasse</th>
                            {
                                groupSelected && (
                                    <>
                                        <th>Tittel</th>
                                        <th>Admin</th>
                                    </>
                                )
                            }
                        </tr>
                    </thead>
                    <tbody>
                        <EndlessScroll pagingContext={UserPagingContext} loadingInfoWrapper={loadingInfo => (
                            <tr><td colSpan={columnCount}>{loadingInfo}</td></tr>
                        )} renderer={user => (
                            <tr
                                key={user.id}
                                className={linksToUser ? 'cursor-pointer' : ''}
                                onClick={() => {
                                    if (!linksToUser) return
                                    router.push(userHref(user))
                                }}
                            >
                                { usersSelection &&
                                    <td>
                                        <button
                                            className={usersSelection.includes(user) ? 'bg-accent-blue!' : ''}
                                            aria-label={`Velg ${user.firstname} ${user.lastname}`}
                                            aria-pressed={usersSelection.includes(user)}
                                            onClick={(event) => {
                                                stopSelectionClickPropagation(event)
                                                usersSelection.toggle(user)
                                            }}>
                                            <FontAwesomeIcon icon={faCheck} />
                                        </button>
                                    </td>
                                }
                                { userSelection &&
                                    <td>
                                        <button
                                            className={userSelection.user?.id === user.id ? 'bg-accent-blue!' : ''}
                                            aria-label={`Velg ${user.firstname} ${user.lastname}`}
                                            aria-pressed={userSelection.user?.id === user.id}
                                            onClick={(event) => {
                                                stopSelectionClickPropagation(event)
                                                userSelection.setUser(user)
                                            }}>
                                            <FontAwesomeIcon icon={faCheck} />
                                        </button>
                                    </td>
                                }
                                {
                                    displayForUser && <td>{displayForUser(user)}</td>
                                }
                                <UserRow
                                    groupSelected={groupSelected}
                                    user={user}
                                    href={linksToUser ? userHref(user) : undefined}
                                />
                            </tr>
                        )} />
                    </tbody>
                </table>
            </div>
        </div>
    )
}

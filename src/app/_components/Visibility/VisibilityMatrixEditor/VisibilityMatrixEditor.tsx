'use client'
import Button from '@/components/UI/Button'
import MultiSearchableDropdown from '@/components/UI/MultiSearchableDropdown'
import { SelectNumber } from '@/components/UI/Select'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { describeAccess, listsContradict } from '@/auth/visibility/describeVisibility'
import { findGroup, orderOptions } from '@/lib/groups/groupOptions'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition, VisibilityRequirement } from '@/services/visibility/types'
import type { GroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    requirements: VisibilityRequirement[],
    onChange: (requirements: VisibilityRequirement[]) => void,
    /** Ends the sentence saying who gets in, such as "kan lese nyheten". */
    verb: string,
    /** What no requirements means here. Left out where that must not be offered, as for those administrating. */
    everyone?: string,
}

const groupTypeNames: Record<GroupType, string> = {
    OMEGA_MEMBERSHIP_GROUP: 'Medlemskap',
    CLASS: 'Klasse',
    COMMITTEE: 'Komité',
    INTEREST_GROUP: 'Interessegruppe',
    STUDY_PROGRAMME: 'Studieretning',
    MANUAL_GROUP: 'Andre grupper',
}
const NOW = -1

const modeClassName = (active: boolean) => `
    py-1 px-3 border-none rounded-[calc(var(--rounding)/2)] text-s cursor-pointer
    ${active ? 'bg-primary text-primary-content font-medium' : `
        bg-transparent text-base-content
        hover:bg-base-200
    `}
`

const groupOptions = (groups: ExpandedGroup[]) => Object.entries(groupTypeNames).flatMap(([type, section]) => (
    groups
        .filter(group => group.groupType === type)
        .sort((first, second) => first.name.localeCompare(second.name, 'nb', { numeric: true }))
        .map(group => ({ value: group.id, label: group.name, key: group.id.toString(), section }))
))

function ConditionChip({ condition, groups, onChange, onRemove }: {
    condition: VisibilityCondition,
    groups: ExpandedGroup[],
    onChange: (condition: VisibilityCondition) => void,
    onRemove: () => void,
}) {
    const [choosingWhen, setChoosingWhen] = useState(false)
    const group = findGroup(groups, condition.groupId)
    const name = group?.name ?? `gruppe #${condition.groupId}`

    return <li className="flex flex-col gap-1 min-w-0">
        <span className={`
            inline-flex items-center self-start max-w-full rounded-round border bg-base-200 text-s
            ${condition.type === 'ORDER' ? 'border-dashed border-base-content/80' : 'border-base-300'}
        `}>
            <button
                type="button"
                title="Velg om dette gjelder nå eller et tidligere år"
                aria-expanded={choosingWhen}
                onClick={() => setChoosingWhen(!choosingWhen)}
                className="py-1 pl-3 pr-1 border-none bg-transparent text-base-content text-left cursor-pointer"
            >
                {name}
                {condition.type === 'ORDER' && <span className="text-base-content/80"> · {condition.order}. orden</span>}
            </button>
            <button
                type="button"
                aria-label={`Fjern ${name}`}
                onClick={onRemove}
                className="
                    flex items-center justify-center size-6 mr-1 border-none rounded-full bg-transparent
                    text-base-content/80 cursor-pointer
                    hover:text-error
                "
            >
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </span>
        {choosingWhen && <SelectNumber
            name=""
            label="Gjelder"
            value={condition.type === 'ORDER' ? condition.order : NOW}
            options={[
                { value: NOW, label: 'De som er med nå', key: 'now' },
                ...orderOptions(group).reverse().map(option => ({
                    ...option,
                    label: `De som var med i ${option.label}. orden`,
                })),
            ]}
            onChange={value => onChange(value === NOW
                ? { type: 'ACTIVE', groupId: condition.groupId }
                : { type: 'ORDER', groupId: condition.groupId, order: value })}
        />}
    </li>
}

/**
 * A controlled editor for a single visibility matrix, which says who gets in as a sentence. A list
 * here is a requirement, so someone must be in one group of every list. It owns no persistence of
 * its own - the consumer decides whether the matrix is saved against an existing visibility
 * (VisibilityAdmin) or submitted as part of creating the thing it will guard (MakeNewCollection).
 * Its inputs have no names since the consumer submits `requirements`, and they load late, which a
 * form would count as a change.
 */
export default function VisibilityMatrixEditor({ requirements, onChange, verb, everyone }: PropTypes) {
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null

    const specific = requirements.length > 0 || everyone === undefined
    const lists = requirements.length > 0 || !specific ? requirements : [{ conditions: [] }]
    const setConditions = (listIndex: number, conditions: VisibilityCondition[]) => onChange(
        lists.map((list, index) => (index === listIndex ? { conditions } : list))
    )

    const sentence = describeAccess({ requirements }, groups, { verb, everyone })
    const unfinished = specific && lists.some(list => list.conditions.length === 0)
    // No requirements at all lets everyone in, so saying no one gets in would be wrong there.
    const nobody = requirements.some(list => list.conditions.length === 0)

    return <div className="flex flex-col gap-2 w-full min-w-0">
        <p
            aria-live="polite"
            className={`
                m-0 py-2 px-3 rounded-inner font-medium
                ${unfinished ? 'bg-warning/15' : 'bg-primary/15'}
            `}
        >
            {nobody ? 'Ingen slipper inn ennå. Velg minst én gruppe.' : sentence}
        </p>

        {everyone !== undefined && <div className="flex flex-wrap gap-1 self-start p-1 rounded-inner bg-base-300">
            <button
                type="button"
                aria-pressed={!specific}
                onClick={() => onChange([])}
                className={modeClassName(!specific)}
            >
                {everyone}
            </button>
            <button
                type="button"
                aria-pressed={specific}
                onClick={() => {
                    if (!specific) onChange([{ conditions: [] }])
                }}
                className={modeClassName(specific)}
            >
                Bestemte grupper
            </button>
        </div>}

        {specific && (groups === null ? <p className="m-0">Laster grupper...</p> : <>
            {lists.map((list, listIndex) => <div key={listIndex} className="flex flex-col gap-2 min-w-0">
                {listIndex > 0 && <span className="text-s text-base-content/80">og</span>}
                <div className="flex flex-col gap-2 p-3 rounded-inner border border-base-300">
                    <div className="flex justify-between gap-2">
                        <span className="text-s font-medium">
                            {list.conditions.length > 1 ? 'Må være i én av disse' : 'Må være i'}
                        </span>
                        {lists.length > 1 && <button
                            type="button"
                            onClick={() => onChange(lists.filter((_, index) => index !== listIndex))}
                            className="
                                p-0 border-none bg-transparent text-s text-base-content/80 underline cursor-pointer
                                hover:text-error
                            "
                        >
                            Fjern
                        </button>}
                    </div>
                    {list.conditions.length > 0 && <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
                        {list.conditions.map((condition, conditionIndex) => <ConditionChip
                            key={conditionIndex}
                            condition={condition}
                            groups={groups}
                            onChange={changed => setConditions(listIndex, list.conditions.map((other, index) => (
                                index === conditionIndex ? changed : other
                            )))}
                            onRemove={() => setConditions(
                                listIndex,
                                list.conditions.filter((_, index) => index !== conditionIndex)
                            )}
                        />)}
                    </ul>}
                    <MultiSearchableDropdown
                        name=""
                        label="Legg til gruppe"
                        options={groupOptions(groups)}
                        values={list.conditions.flatMap(({ type, groupId }) => (type === 'ACTIVE' ? [groupId] : []))}
                        hideSelected
                        onChange={groupIds => setConditions(listIndex, [
                            ...list.conditions.filter(condition => (
                                condition.type === 'ORDER' || groupIds.includes(condition.groupId)
                            )),
                            ...groupIds
                                .filter(groupId => !list.conditions.some(condition => (
                                    condition.type === 'ACTIVE' && condition.groupId === groupId
                                )))
                                .map(groupId => ({ type: 'ACTIVE' as const, groupId })),
                        ])}
                        className="max-w-none! mt-0!"
                    />
                </div>
            </div>)}
            {listsContradict({ requirements: lists }, groups) && <p className="
                m-0 py-2 px-3 rounded-inner bg-warning/15 text-s
            ">
                Ingen går i to klasser samtidig. Skal begge klassene med, legg dem i samme liste.
            </p>}
            <Button
                type="button"
                color="secondary"
                onClick={() => onChange([...lists, { conditions: [] }])}
                className="self-start m-0! py-1! px-3! text-s!"
            >
                <FontAwesomeIcon icon={faPlus} /> Og må også være i
            </Button>
        </>)}
    </div>
}

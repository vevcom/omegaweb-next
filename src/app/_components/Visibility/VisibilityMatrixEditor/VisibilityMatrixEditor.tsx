'use client'
import JsonFieldInput from '@/components/Form/JsonFieldInput'
import Button from '@/components/UI/Button'
import Checkbox from '@/components/UI/Checkbox'
import ModeSwitch from '@/components/UI/ModeSwitch'
import MultiSearchableDropdown from '@/components/UI/MultiSearchableDropdown'
import { SelectNumber } from '@/components/UI/Select'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import {
    describeMemberships,
    describeVisibility,
    groupNameOf,
    visibilityWarnings,
} from '@/components/Visibility/describeVisibility'
import { pickedGroupIds, withPickedGroups, withoutRepeats } from '@/components/Visibility/pickedGroups'
import { findGroup, orderOptions } from '@/lib/groups/groupOptions'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { DefaultMembershipRequirements } from '@/components/Visibility/pickedGroups'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition, VisibilityRequirement } from '@/services/visibility/types'
import type { GroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    /** Ends the sentence saying who gets in, such as "kan lese nyheten". */
    verb: string,
    /** What no requirements means here. Left out where that must not be offered, as for those administrating. */
    everyone?: string,
    defaultMembershipRequirements: DefaultMembershipRequirements,
} & ({
    /** The form field the matrix is posted in, as JSON, which `Zpn.json` on the schema side reads. */
    name: string,
    defaultValue?: VisibilityRequirement[],
} | {
    /** For a form that needs the matrix as it is edited, and posts it itself. */
    requirements: VisibilityRequirement[],
    onChange: (requirements: VisibilityRequirement[]) => void,
})

const groupTypeNames: Record<GroupType, string> = {
    OMEGA_MEMBERSHIP_GROUP: 'Medlemskap',
    CLASS: 'Klasse',
    COMMITTEE: 'Komité',
    INTEREST_GROUP: 'Interessegruppe',
    STUDY_PROGRAMME: 'Studieretning',
    MANUAL_GROUP: 'Andre grupper',
    REVUE_SUB_GROUP: 'Revyundergruppe',
}
const ANY_ORDER = -1

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
    const [choosing, setChoosing] = useState(false)
    const name = groupNameOf(condition, groups)

    return <li className="flex flex-col gap-1 min-w-0">
        <span className={`
            inline-flex items-center self-start max-w-full rounded-round border bg-base-200 text-s
            ${condition.order !== null ? 'border-dashed border-base-content/80' : 'border-base-300'}
        `}>
            <button
                type="button"
                title="Velg orden, og om bare de aktive eller administratorene gjelder"
                aria-expanded={choosing}
                onClick={() => setChoosing(!choosing)}
                className="py-1 pl-3 pr-1 border-none bg-transparent text-base-content text-left cursor-pointer"
            >
                {name}
                <span className="text-base-content/80">{' · '}{describeMemberships(condition)}</span>
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
        {choosing && <div className="flex flex-wrap items-center gap-x-3">
            <SelectNumber
                label="Orden"
                value={condition.order ?? ANY_ORDER}
                options={[
                    { value: ANY_ORDER, label: 'Alle ordener', key: 'any' },
                    ...orderOptions(findGroup(groups, condition.groupId)).reverse().map(option => ({
                        ...option,
                        label: `${option.label}. orden`,
                    })),
                ]}
                onChange={value => onChange({ ...condition, order: value === ANY_ORDER ? null : value })}
            />
            <Checkbox
                label="Bare aktive"
                checked={condition.onlyActive}
                onChange={event => onChange({ ...condition, onlyActive: event.target.checked })}
            />
            <Checkbox
                label="Bare administratorer"
                checked={condition.onlyAdmins}
                onChange={event => onChange({ ...condition, onlyAdmins: event.target.checked })}
            />
        </div>}
    </li>
}

/**
 * An editor for a single visibility matrix, which says who gets in as a sentence. A list here is a
 * requirement, so someone must be in one group of every list, and a group picked in one starts as
 * `defaultMembershipRequirements` says. Given `name` it is a form field that posts the matrix as JSON. Given
 * `requirements` and `onChange` it is controlled, for a form that needs the matrix as it is edited
 * and posts it itself. Its other inputs have no names, since they load late, which a form would
 * count as a change.
 */
export default function VisibilityMatrixEditor(props: PropTypes) {
    const { verb, everyone, defaultMembershipRequirements } = props
    const [ownRequirements, setOwnRequirements] = useState<VisibilityRequirement[]>(
        'defaultValue' in props ? props.defaultValue ?? [] : [],
    )
    const controlled = 'requirements' in props
    const requirements = controlled ? props.requirements : ownRequirements
    const onChange = controlled ? props.onChange : setOwnRequirements
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null

    const specific = requirements.length > 0 || everyone === undefined
    const lists = requirements.length > 0 || !specific ? requirements : [{ conditions: [] }]
    const setConditions = (listIndex: number, conditions: VisibilityCondition[]) => onChange(
        lists.map((list, index) => (index === listIndex ? { conditions } : list))
    )

    const unfinished = specific && lists.some(list => list.conditions.length === 0)
    // No requirements at all lets everyone in, so saying no one gets in would be wrong there.
    const nobody = requirements.some(list => list.conditions.length === 0)
    const sentence = unfinished
        ? 'Velg minst én gruppe.'
        : `${describeVisibility({ requirements }, groups, { everyone })} ${verb}.`

    return <div className="flex flex-col gap-2 w-full min-w-0">
        {'name' in props && <JsonFieldInput
            name={props.name}
            value={requirements}
            onReset={() => setOwnRequirements(props.defaultValue ?? [])}
        />}
        <p
            aria-live="polite"
            className={`
                m-0 py-2 px-3 rounded-inner font-medium
                ${unfinished ? 'bg-warning/15' : 'bg-primary/15'}
            `}
        >
            {nobody ? 'Ingen slipper inn ennå. Velg minst én gruppe.' : sentence}
        </p>

        {everyone !== undefined && <ModeSwitch
            compact
            value={specific ? 'specific' : 'everyone'}
            onChange={mode => {
                if (mode === 'everyone') onChange([])
                if (mode === 'specific' && !specific) onChange([{ conditions: [] }])
            }}
            options={[
                { value: 'everyone', label: everyone },
                { value: 'specific', label: 'Bestemte grupper' },
            ]}
        />}

        {specific && (groups === null ? <p className="m-0">Laster grupper...</p> : <>
            {lists.map((list, listIndex) => <div key={listIndex} className="flex flex-col gap-2 min-w-0">
                {listIndex > 0 && <span className="text-s text-base-content/80">og</span>}
                <div className="flex flex-col gap-2 p-3 rounded-inner border border-base-300">
                    <div className="flex justify-between gap-2">
                        <span className="text-s font-medium">
                            {list.conditions.length > 1 ? 'Må være i én av disse' : 'Må være i'}
                        </span>
                        {lists.length > 1 && <Button
                            type="button"
                            variant="text"
                            color="secondary"
                            onClick={() => onChange(lists.filter((_, index) => index !== listIndex))}
                        >
                            Fjern
                        </Button>}
                    </div>
                    {list.conditions.length > 0 && <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
                        {list.conditions.map((condition, conditionIndex) => <ConditionChip
                            key={chipKey(list.conditions, conditionIndex)}
                            condition={condition}
                            groups={groups}
                            onChange={changed => setConditions(listIndex, withoutRepeats(
                                list.conditions.map((other, index) => (index === conditionIndex ? changed : other))
                            ))}
                            onRemove={() => setConditions(
                                listIndex,
                                list.conditions.filter((_, index) => index !== conditionIndex)
                            )}
                        />)}
                    </ul>}
                    <MultiSearchableDropdown
                        label="Legg til gruppe"
                        options={groupOptions(groups)}
                        values={pickedGroupIds(list.conditions, groups, defaultMembershipRequirements)}
                        hideSelected
                        onChange={groupIds => setConditions(
                            listIndex,
                            withPickedGroups(list.conditions, groupIds, groups, defaultMembershipRequirements),
                        )}
                        className="max-w-none! mt-0!"
                    />
                </div>
            </div>)}
            {visibilityWarnings({ requirements: lists }, groups).map(warning => <p key={warning} className="
                m-0 py-2 px-3 rounded-inner bg-warning/15 text-s
            ">
                {warning}
            </p>)}
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

/** A chip keeps its key when what it says is changed, so the select in it stays open with the focus. */
function chipKey(conditions: VisibilityCondition[], index: number) {
    const { groupId } = conditions[index]
    return `${groupId}-${conditions.slice(0, index).filter(other => other.groupId === groupId).length}`
}

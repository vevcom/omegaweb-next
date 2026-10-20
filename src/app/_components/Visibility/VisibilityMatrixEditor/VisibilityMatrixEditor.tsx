'use client'
import Button from '@/components/UI/Button'
import { SelectNumber, SelectString } from '@/components/UI/Select'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { describeMatrix } from '@/auth/visibility/describeVisibility'
import { findGroup, orderOptions } from '@/lib/groups/groupOptions'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { VisibilityCondition, VisibilityRequirement } from '@/services/visibility/types'
import type { VisibilityRequirementGroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    requirements: VisibilityRequirement[],
    onChange: (requirements: VisibilityRequirement[]) => void,
}

/**
 * A controlled editor for a single visibility matrix. It owns no persistence of its own - the
 * consumer decides whether the matrix is saved against an existing visibility (VisibilityAdmin) or
 * submitted as part of creating the thing it will guard (MakeNewCollection).
 */
export default function VisibilityMatrixEditor({ requirements, onChange }: PropTypes) {
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null

    function addRequirement() {
        const defaultGroupId = groups?.[0]?.id
        if (defaultGroupId === undefined) return
        onChange([...requirements, { conditions: [{ type: 'ACTIVE', groupId: defaultGroupId }] }])
    }

    function removeRequirement(requirementIndex: number) {
        onChange(requirements.filter((_, index) => index !== requirementIndex))
    }

    function addCondition(requirementIndex: number) {
        const defaultGroupId = groups?.[0]?.id
        if (defaultGroupId === undefined) return
        onChange(requirements.map((requirement, index) => (
            index === requirementIndex
                ? { conditions: [...requirement.conditions, { type: 'ACTIVE', groupId: defaultGroupId }] }
                : requirement
        )))
    }

    function removeCondition(requirementIndex: number, conditionIndex: number) {
        onChange(requirements.map((requirement, index) => (
            index === requirementIndex
                ? { conditions: requirement.conditions.filter((_, index_) => index_ !== conditionIndex) }
                : requirement
        )))
    }

    function updateCondition(requirementIndex: number, conditionIndex: number, updated: VisibilityCondition) {
        onChange(requirements.map((requirement, index) => (
            index === requirementIndex
                ? {
                    conditions: requirement.conditions.map((condition, index_) => (
                        index_ === conditionIndex ? updated : condition
                    ))
                }
                : requirement
        )))
    }

    function handleConditionGroupChange(
        requirementIndex: number,
        conditionIndex: number,
        condition: VisibilityCondition,
        groupId: number
    ) {
        const group = findGroup(groups, groupId)
        updateCondition(requirementIndex, conditionIndex, condition.type === 'ORDER'
            ? { type: 'ORDER', groupId, order: group?.order ?? condition.order }
            : { type: 'ACTIVE', groupId })
    }

    function handleConditionTypeChange(
        requirementIndex: number,
        conditionIndex: number,
        condition: VisibilityCondition,
        type: VisibilityRequirementGroupType
    ) {
        const group = findGroup(groups, condition.groupId)
        updateCondition(requirementIndex, conditionIndex, type === 'ORDER'
            ? { type: 'ORDER', groupId: condition.groupId, order: group?.order ?? 0 }
            : { type: 'ACTIVE', groupId: condition.groupId })
    }

    const groupOptions = (groups ?? []).map(group => ({ value: group.id, label: group.name, key: group.id.toString() }))

    return (
        <div className="flex flex-col gap-[0.5em]">
            <p className="italic">{describeMatrix({ requirements }, groups)}</p>
            {
                groups === null ? (
                    <p>Laster grupper...</p>
                ) : (
                    <div className="flex flex-col gap-[0.75em]">
                        {
                            requirements.map((requirement, requirementIndex) => (
                                <div className="flex flex-col gap-[0.5em] p-[0.5em] border border-current" key={requirementIndex}>
                                    <div className="flex justify-between items-center">
                                        <span>Krav {requirementIndex + 1} (ett av følgende):</span>
                                        <button type="button" onClick={() => removeRequirement(requirementIndex)}>
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                    {
                                        requirement.conditions.map((condition, conditionIndex) => (
                                            <div className="flex gap-[0.5em] items-end" key={conditionIndex}>
                                                <SelectNumber
                                                    name={`req-${requirementIndex}-cond-${conditionIndex}-group`}
                                                    label="Gruppe"
                                                    value={condition.groupId}
                                                    options={groupOptions}
                                                    onChange={groupId => handleConditionGroupChange(
                                                        requirementIndex, conditionIndex, condition, groupId
                                                    )}
                                                />
                                                <SelectString
                                                    name={`req-${requirementIndex}-cond-${conditionIndex}-type`}
                                                    label="Type"
                                                    value={condition.type}
                                                    options={[
                                                        { value: 'ACTIVE', label: 'Aktivt medlem' },
                                                        { value: 'ORDER', label: 'Spesifik orden' },
                                                    ]}
                                                    onChange={type => handleConditionTypeChange(
                                                        requirementIndex,
                                                        conditionIndex,
                                                        condition,
                                                        type as VisibilityRequirementGroupType
                                                    )}
                                                />
                                                {
                                                    condition.type === 'ORDER' && (
                                                        <SelectNumber
                                                            name={`req-${requirementIndex}-cond-${conditionIndex}-order`}
                                                            label="Orden"
                                                            value={condition.order}
                                                            options={orderOptions(findGroup(groups, condition.groupId))}
                                                            onChange={order => updateCondition(
                                                                requirementIndex,
                                                                conditionIndex,
                                                                { type: 'ORDER', groupId: condition.groupId, order }
                                                            )}
                                                        />
                                                    )
                                                }
                                                <button
                                                    type="button"
                                                    onClick={() => removeCondition(requirementIndex, conditionIndex)}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        ))
                                    }
                                    <Button color="secondary" type="button" onClick={() => addCondition(requirementIndex)}>
                                        <FontAwesomeIcon icon={faPlus} /> Legg til alternativ
                                    </Button>
                                </div>
                            ))
                        }
                        <Button color="secondary" type="button" onClick={addRequirement}>
                            <FontAwesomeIcon icon={faPlus} /> Legg til krav
                        </Button>
                    </div>
                )
            }
        </div>
    )
}

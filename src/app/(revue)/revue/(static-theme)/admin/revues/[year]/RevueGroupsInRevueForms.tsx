'use client'
import RevueGroupOrderField from '@/app/(revue)/_components/RevueGroupOrderField'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import useAuthorizer from '@/hooks/useAuthorizer'
import { configureAction } from '@/services/configureAction'
import { groupTypesConfig } from '@/services/groups/constants'
import { addRevueGroupToRevueAction, removeRevueGroupFromRevueAction } from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { useState } from 'react'
import type { RevueGroupType } from '@/prisma-generated-pn-types'

type Group = { id: number, name: string, type: RevueGroupType, order: number }

type PropTypes = {
    revueId: number,
    groupsInRevue: Group[],
    /** Each with its own order, which the order to put it in at starts at. */
    groupsNotInRevue: Group[],
}

/** The groups of a revue with the orders whose members are the revue's, to put in and take out. */
export default function RevueGroupsInRevueForms({ revueId, groupsInRevue, groupsNotInRevue }: PropTypes) {
    const canAdd = useAuthorizer({ authorizer: revueGroupAuth.addToRevue }).authorized
    const canRemove = useAuthorizer({ authorizer: revueGroupAuth.removeFromRevue }).authorized
    const [pickedId, setPickedId] = useState(groupsNotInRevue[0]?.id)
    const picked = groupsNotInRevue.find(group => group.id === pickedId) ?? groupsNotInRevue[0]

    return (
        <div className="flex flex-col gap-6">
            {groupsInRevue.length === 0
                ? <p className="m-0 text-base-content/80">Revyen har ingen grupper.</p>
                : <ul className="m-0 p-0 list-none flex flex-col">
                    {groupsInRevue.map(group => (
                        <li key={group.id} className="
                            flex items-center justify-between gap-4 py-2 border-t border-base-300
                            [&_form]:w-auto
                        ">
                            <span>
                                {group.name}
                                <span className="text-base-content/80">
                                    {' '}· {groupTypesConfig[group.type].name} · orden {group.order}
                                </span>
                            </span>
                            {canRemove && <Form
                                action={configureAction(removeRevueGroupFromRevueAction, {
                                    params: { revueId, revueGroupId: group.id },
                                })}
                                submitText="Ta ut"
                                submitColor="red"
                                buttonClassName="w-24!"
                                refreshOnSuccess
                                confirmation={{
                                    confirm: true,
                                    text: `Ta ${group.name} ut av revyen? Gruppen og medlemmene dens blir som de er.`,
                                }}
                            />}
                        </li>
                    ))}
                </ul>}
            {canAdd && picked && <Form
                title="Legg til gruppe"
                action={configureAction(addRevueGroupToRevueAction, { params: { revueId } })}
                submitText="Legg til"
                refreshOnSuccess
            >
                <SelectNumber
                    name="revueGroupId"
                    label="Gruppe"
                    value={picked.id}
                    onChange={setPickedId}
                    options={groupsNotInRevue.map(group => ({
                        value: group.id,
                        label: `${group.name} (${groupTypesConfig[group.type].name.toLowerCase()})`,
                        key: group.id.toString(),
                    }))}
                />
                <RevueGroupOrderField key={picked.id} name="order" revueGroupId={picked.id} defaultOrder={picked.order} />
            </Form>}
        </div>
    )
}

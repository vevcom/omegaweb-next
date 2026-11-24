'use client'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import { SelectNumber } from '@/components/UI/Select'
import useAuthorizer from '@/hooks/useAuthorizer'
import { configureAction } from '@/services/configureAction'
import { addRevueGroupToRevueAction, removeRevueGroupFromRevueAction } from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'

type PropTypes = {
    revueId: number,
    groupsInRevue: { id: number, name: string, order: number }[],
    groupsNotInRevue: { id: number, name: string }[],
    /** Null for one who may not read Omega's order. */
    currentOrder: number | null,
}

/** The groups of a revue with the orders whose members are the revue's, to put in and take out. */
export default function RevueGroupsInRevueForms({ revueId, groupsInRevue, groupsNotInRevue, currentOrder }: PropTypes) {
    const canAdd = useAuthorizer({ authorizer: revueGroupAuth.addToRevue }).authorized
    const canRemove = useAuthorizer({ authorizer: revueGroupAuth.removeFromRevue }).authorized

    return (
        <div className="flex flex-col gap-4 min-w-[min(24rem,80vw)]">
            <h2 className="m-0 text-base-content">Grupper i revyen</h2>
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
                                <span className="text-base-content/80"> · orden {group.order}</span>
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
            {canAdd && groupsNotInRevue.length > 0 && <Form
                title="Legg til gruppe"
                action={configureAction(addRevueGroupToRevueAction, { params: { revueId } })}
                submitText="Legg til"
                refreshOnSuccess
            >
                <SelectNumber
                    name="revueGroupId"
                    label="Gruppe"
                    options={groupsNotInRevue.map(group => ({
                        value: group.id,
                        label: group.name,
                        key: group.id.toString(),
                    }))}
                />
                <NumberInput name="order" label="Orden" defaultValue={currentOrder ?? undefined} />
            </Form>}
        </div>
    )
}

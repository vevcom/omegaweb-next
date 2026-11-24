'use client'
import RevueGroupOrderField from './RevueGroupOrderField'
import RevuePaletteFields from './RevuePaletteFields'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import Form from '@/components/Form/Form'
import FormTab from '@/components/Form/FormTab'
import Checkbox from '@/components/UI/Checkbox'
import NumberInput from '@/components/UI/NumberInput'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import TextInput from '@/components/UI/TextInput'
import { groupTypesConfig } from '@/services/groups/constants'
import { createRevueAction } from '@/services/revue/actions'
import { useState } from 'react'
import type { RevueGroupsForNewRevue } from '@/services/revue/groups/types'
import type { AppHref } from '@/lib/sites/href'
import type { ReactNode } from 'react'

type PropTypes = {
    closePopUpOnSuccess?: string,
    /** Where to go once the revue is made. Left out, the page stays and reads its revues again. */
    hrefOfCreated?: (revue: { year: number }) => AppHref,
    /** The revue groups to choose from, for those who may read them. Without any the form is the revue alone. */
    groups: RevueGroupsForNewRevue | null,
}

const tabs = [{ key: 'revue', label: 'Revyen' }, { key: 'groups', label: 'Grupper' }]

/** A new revue, and the revue groups it starts with, none to begin with, each at an order chosen for it. */
export default function CreateRevueForm({ closePopUpOnSuccess, hrefOfCreated, groups }: PropTypes) {
    const previousRevue = groups?.previousRevue ?? null
    const [orders, setOrders] = useState<Map<number, number | null>>(new Map())

    const form = (className: string, children: ReactNode, disabled = false) => <Form
        title="Ny revy"
        className={className}
        action={createRevueAction}
        submitText="Legg til"
        closePopUpOnSuccess={closePopUpOnSuccess}
        refreshOnSuccess={!hrefOfCreated}
        navigateOnSuccess={hrefOfCreated}
        disabled={disabled}
    >
        {children}
    </Form>
    const revueFields = <>
        <NumberInput
            name="year"
            label="År"
            defaultValue={previousRevue ? previousRevue.year + 1 : new Date().getUTCFullYear()}
        />
        <TextInput name="name" label="Navn" />
        <RevuePaletteFields defaultPalette={defaultRevuePalette} />
    </>

    if (!groups?.groups.length) return form('min-w-[min(24rem,80vw)]', revueFields)

    const picked = Array.from(orders, ([revueGroupId, order]) => ({ revueGroupId, order }))
    const toggle = (group: RevueGroupsForNewRevue['groups'][number]) => setOrders(current => {
        const next = new Map(current)
        if (!next.delete(group.id)) next.set(group.id, group.order)
        return next
    })

    return <div className="min-w-[min(90vw,62rem)] h-[calc(100svh-10rem)]">
        <Tabs label="Ny revy" tabs={tabs}>
            <TabPanel tab={tabs.map(tab => tab.key)}>
                {form('flex flex-col min-h-full', <>
                    <input type="hidden" name="groups" value={JSON.stringify(picked)} />
                    <FormTab tab="revue">{revueFields}</FormTab>
                    <FormTab tab="groups">
                        <div className="flex flex-col gap-3">
                            <p className="m-0 text-base-content/80 max-w-[70ch]">
                                Kryss av gruppene revyen skal ha, og velg ordenen til hver av dem. Gruppene, både
                                komiteer og revyundergrupper, bør som regel migreres til den nye ordenen før de legges
                                inn i revyen. En gruppe kan også legges inn senere, fra revyens adminside.
                            </p>
                            <ul className="m-0 p-0 list-none flex flex-col">
                                {groups.groups.map(group => <li
                                    key={group.id}
                                    className="flex flex-col gap-2 py-2 border-t border-base-300"
                                >
                                    <Checkbox
                                        name={`group-${group.id}`}
                                        label={`${group.name} (${groupTypesConfig[group.type].name.toLowerCase()}${
                                            group.pensioned ? ', pensjonert' : ''
                                        })`}
                                        checked={orders.has(group.id)}
                                        onChange={() => toggle(group)}
                                    />
                                    {previousRevue && group.orderInPreviousRevue !== null && <span className="
                                        ml-7 text-s text-base-content/80
                                    ">
                                        I {previousRevue.name} i orden {group.orderInPreviousRevue}
                                    </span>}
                                    {orders.has(group.id) && <div className="ml-7">
                                        <RevueGroupOrderField
                                            revueGroupId={group.id}
                                            defaultOrder={group.order}
                                            onOrderChange={order => setOrders(
                                                current => new Map(current).set(group.id, order)
                                            )}
                                        />
                                    </div>}
                                </li>)}
                            </ul>
                        </div>
                    </FormTab>
                </>, picked.some(group => group.order === null))}
            </TabPanel>
        </Tabs>
    </div>
}

'use client'
import RevuePaletteFields from './RevuePaletteFields'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import Form from '@/components/Form/Form'
import FormTab from '@/components/Form/FormTab'
import MigrateGroupFields from '@/components/Group/MigrateGroupFields'
import Checkbox from '@/components/UI/Checkbox'
import NumberInput from '@/components/UI/NumberInput'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import TextInput from '@/components/UI/TextInput'
import { groupTypesConfig } from '@/services/groups/constants'
import { createRevueAction } from '@/services/revue/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useState } from 'react'
import type { RevueGroupsToCarryOver } from '@/services/revue/groups/types'
import type { AppHref } from '@/lib/sites/href'
import type { ReactNode } from 'react'

type PropTypes = {
    closePopUpOnSuccess?: string,
    /** Where to go once the revue is made. Left out, the page stays and reads its revues again. */
    hrefOfCreated?: (revue: { year: number }) => AppHref,
    /** The previous revue's groups, for those who may read them. Without groups the form is the revue alone. */
    carryOver: RevueGroupsToCarryOver | null,
}

type CarriedGroup = RevueGroupsToCarryOver['groups'][number]

/**
 * A new revue, with the groups of the previous revue it carries over, all ticked to begin with, and for each
 * sub group carried over who of its members go with it. A sub group left unticked is pensioned.
 */
export default function CreateRevueForm({ closePopUpOnSuccess, hrefOfCreated, carryOver }: PropTypes) {
    const groups = carryOver?.groups ?? []
    const previousRevue = carryOver?.previousRevue ?? null
    const [carried, setCarried] = useState(() => new Set(groups.map(group => group.id)))
    const [keeps, setKeeps] = useState<Map<number, Map<number, boolean>>>(new Map())
    const [year, setYear] = useState(previousRevue ? previousRevue.year + 1 : new Date().getUTCFullYear())
    const canReadCarryOver = useAuthorizer({ authorizer: revueGroupAuth.readToCarryOver })

    const form = (className: string, children: ReactNode, disabled = false) => <Form
        title="Ny revy"
        className={className}
        action={createRevueAction}
        submitText="Legg til"
        closePopUpOnSuccess={closePopUpOnSuccess}
        refreshOnSuccess={!hrefOfCreated}
        navigateOnSuccess={hrefOfCreated}
        onValuesChange={values => setYear(Number(values.get('year')))}
        disabled={disabled}
    >
        {children}
    </Form>
    const revueFields = <>
        <NumberInput name="year" label="År" defaultValue={year} />
        <TextInput name="name" label="Navn" />
        <RevuePaletteFields defaultPalette={defaultRevuePalette} />
    </>

    if (!previousRevue || groups.length === 0) {
        return form('min-w-[min(24rem,80vw)] max-w-[32rem]', <>
            {!canReadCarryOver.authorized && <p className="m-0 text-base-content/80">
                Gruppene i forrige revy blir ikke tatt med, siden det krever tilgang til å lese brukere. De kan legges
                inn etterpå fra revyens innstillinger.
            </p>}
            {revueFields}
        </>)
    }

    const carries = year > previousRevue.year
    const migrating = groups.filter(group => group.migration && carried.has(group.id))
    const withoutAdmin = migrating.filter(group => group.migration?.candidates.length
        && !Array.from(keeps.get(group.id)?.values() ?? []).some(admin => admin))
    const carriedGroups = groups.filter(group => carried.has(group.id)).map(group => ({
        revueGroupId: group.id,
        keep: Array.from(keeps.get(group.id) ?? [], ([userId, admin]) => ({ userId, admin })),
    }))
    const tabs = [
        { key: 'revue', label: 'Revyen' },
        { key: 'groups', label: 'Grupper' },
        ...(carries ? migrating : []).map(group => ({ key: `group-${group.id}`, label: group.name })),
    ]

    return <div className="flex flex-col gap-4 min-w-[min(90vw,62rem)] h-[calc(100svh-10rem)]">
        {carries && carryOver?.omegaHasNotIncremented && <p className="m-0 text-error">
            {carryOver.omegaHasNotIncremented}
        </p>}
        {carries && withoutAdmin.length > 0 && <p className="m-0 text-error">
            Velg minst én admin for {withoutAdmin.map(group => group.name).join(', ')}.
        </p>}
        <Tabs label="Ny revy" tabs={tabs}>
            <TabPanel tab={tabs.map(tab => tab.key)}>
                {form('flex flex-col min-h-full', <>
                    {carries && <input type="hidden" name="carriedGroups" value={JSON.stringify(carriedGroups)} />}
                    <FormTab tab="revue">{revueFields}</FormTab>
                    <FormTab tab="groups">
                        <CarriedGroupsFields
                            groups={groups}
                            carried={carried}
                            onCarriedChange={setCarried}
                            previousRevue={previousRevue}
                            carries={carries}
                            waitsForOmega={!!carryOver?.omegaHasNotIncremented}
                        />
                    </FormTab>
                    {carries && migrating.map(group => group.migration && <FormTab key={group.id} tab={`group-${group.id}`}>
                        <p className="text-base-content/80 max-w-[70ch]">
                            {group.name} står i orden {group.migration.groupOrder} og blir migrert til
                            orden {group.orderInNewRevue}. Velg hvem som blir med videre, og hvem av dem som skal
                            være admin. De andre beholder medlemskapet sitt i orden {group.migration.groupOrder},
                            satt inaktivt.
                        </p>
                        <MigrateGroupFields
                            groupId={group.migration.groupId}
                            groupOrder={group.migration.groupOrder}
                            newOrder={group.orderInNewRevue}
                            candidates={group.migration.candidates}
                            keep={keeps.get(group.id) ?? new Map()}
                            onKeepChange={keep => setKeeps(current => new Map(current).set(group.id, keep))}
                        />
                    </FormTab>)}
                </>, carries && (!!carryOver?.omegaHasNotIncremented || withoutAdmin.length > 0))}
            </TabPanel>
        </Tabs>
    </div>
}

function CarriedGroupsFields({ groups, carried, onCarriedChange, previousRevue, carries, waitsForOmega }: {
    groups: CarriedGroup[],
    carried: Set<number>,
    onCarriedChange: (carried: Set<number>) => void,
    previousRevue: { year: number, name: string },
    carries: boolean,
    waitsForOmega: boolean,
}) {
    const toggle = (groupId: number) => {
        const next = new Set(carried)
        if (!next.delete(groupId)) next.add(groupId)
        onCarriedChange(next)
    }

    if (!carries) {
        return <p className="m-0 text-base-content/80 max-w-[70ch]">
            Gruppene tas bare med til en revy etter {previousRevue.name} ({previousRevue.year}). En revy for et
            tidligere år lages uten grupper.
        </p>
    }
    if (waitsForOmega) {
        return <p className="m-0 text-base-content/80 max-w-[70ch]">
            Gruppene i {previousRevue.name} kan tas med når Omega har inkrementert.
        </p>
    }
    return <div className="flex flex-col gap-3">
        <p className="m-0 text-base-content/80 max-w-[70ch]">
            Gruppene i {previousRevue.name} blir med i den nye revyen. En komité får neste orden og ikke noe
            mer. En revyundergruppe blir migrert til Omegas orden, og en revyundergruppe uten hake blir pensjonert.
        </p>
        <ul className="m-0 p-0 list-none flex flex-col">
            {groups.map(group => {
                const isCarried = carried.has(group.id)
                return <li key={group.id} className="flex flex-col py-2 border-t border-base-300">
                    <Checkbox
                        name={`carry-${group.id}`}
                        label={`${group.name} (${groupTypesConfig[group.type].name.toLowerCase()})`}
                        checked={isCarried}
                        onChange={() => toggle(group.id)}
                    />
                    <span className="ml-7 text-s text-base-content/80">
                        {carriedText(group, isCarried)}
                    </span>
                </li>
            })}
        </ul>
    </div>
}

function carriedText(group: CarriedGroup, isCarried: boolean) {
    if (group.type === 'COMMITTEE') {
        return isCarried
            ? `Orden ${group.order} i forrige revy, orden ${group.orderInNewRevue} i den nye`
            : 'Blir ikke med. Komiteen blir som den er'
    }
    if (!isCarried) return 'Blir pensjonert'
    return group.migration
        ? `Blir migrert til orden ${group.orderInNewRevue}`
        : `Står allerede i orden ${group.orderInNewRevue} og blir med der`
}

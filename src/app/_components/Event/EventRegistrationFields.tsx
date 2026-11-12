'use client'
import AdminSection from './AdminSection'
import EventQuotaBar from './EventQuotaBar'
import { useEventVariantsField } from './EventVariantsField'
import { hasRegistrants, newQuotaDraft, newVariantDraft } from '@/services/events/setupDraft'
import Button from '@/components/UI/Button'
import DateInput from '@/components/UI/DateInput'
import NumberInput from '@/components/UI/NumberInput'
import OptionCards from '@/components/UI/OptionCards'
import ReorderableList from '@/components/UI/ReorderableList'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { describeAudience } from '@/auth/visibility/describeVisibility'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { QuotaDraft, VariantDraft } from '@/services/events/setupDraft'
import type { ReactNode } from 'react'

const flowStepClassName = 'm-0 py-1 pl-3 text-s text-base-content/80'

function VariantDescription({ variant, onChange }: {
    variant: VariantDraft,
    onChange: (changes: Partial<VariantDraft>) => void,
}) {
    return <TextInput
        label="Kort info over påmeldingen, for eksempel når de skal møte"
        maxLength={120}
        value={variant.description ?? ''}
        onChange={event => onChange({ description: event.target.value })}
        className="max-w-none! mt-0!"
    />
}

function QuotaRow({ quota, index, several, handle, onChange, onRemove }: {
    quota: QuotaDraft,
    index: number,
    several: boolean,
    /** Where the quota is dragged from to change the order quotas fill in. */
    handle: ReactNode,
    onChange: (changes: Partial<QuotaDraft>) => void,
    onRemove: () => void,
}) {
    const [editingWho, setEditingWho] = useState(false)
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null
    const over = quota.numOfRegistrations - quota.places

    return <section className="flex flex-col gap-2 p-3 rounded-inner bg-base-100">
        <div className="flex flex-wrap items-center gap-2">
            {several && handle}
            {several && <span className="
                grid place-items-center size-6 shrink-0 rounded-full bg-primary text-primary-content text-s font-bold
            ">{index + 1}</span>}
            {several
                ? <TextInput
                    label="Navn på kvoten"
                    value={quota.name}
                    onChange={event => onChange({ name: event.target.value })}
                    className="flex-1 min-w-40 max-w-none! mt-0!"
                />
                : <span className="flex-1">Antall plasser</span>}
            <NumberInput
                label="Plasser"
                min={0}
                value={quota.places}
                onChange={event => onChange({ places: Number(event.target.value) })}
                className="w-28! mt-0!"
            />
        </div>
        <EventQuotaBar taken={quota.numOfRegistrations} places={quota.places} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-s">
            <span className="text-base-content/80">
                {quota.numOfRegistrations} påmeldt.{' '}
                {describeAudience({ requirements: quota.visibilityRequirements }, groups)}
            </span>
            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    variant="text"
                    aria-expanded={editingWho}
                    onClick={() => setEditingWho(!editingWho)}
                >
                    {editingWho ? 'Lukk' : 'Endre hvem'}
                </Button>
                {several && <Button
                    type="button"
                    variant="text"
                    color="red"
                    aria-label="Fjern kvoten"
                    title={quota.numOfRegistrations > 0 ? 'Kvoten har påmeldte' : undefined}
                    disabled={quota.numOfRegistrations > 0}
                    onClick={onRemove}
                >
                    Fjern
                </Button>}
            </div>
        </div>
        {over > 0 && <p className="m-0 text-s text-warning">
            Når du lagrer, flyttes {over} til neste kvote de kan melde seg på, eller til ventelisten.
        </p>}
        {editingWho && <VisibilityMatrixEditor
            requirements={quota.visibilityRequirements}
            onChange={visibilityRequirements => onChange({ visibilityRequirements })}
            verb="kan melde seg på"
            everyone="Alle som er logget inn"
        />}
    </section>
}

/** The order places are given out in, from the first quota down to the waiting list. Dragging a quota changes it. */
function QuotaFlow({ variant, waitingList, addLabel, onChange }: {
    variant: VariantDraft,
    waitingList: boolean,
    /** What offers another quota, left out where the buttons at the top do it. */
    addLabel?: string,
    onChange: (changes: Partial<VariantDraft>) => void,
}) {
    const several = variant.quotas.length > 1
    const changeQuota = (key: number, changes: Partial<QuotaDraft>) => onChange({
        quotas: variant.quotas.map(quota => (quota.key === key ? { ...quota, ...changes } : quota)),
    })

    return <div className="flex flex-col gap-3">
        <div>
            <ReorderableList
                items={variant.quotas}
                getId={quota => quota.key}
                onReorder={keys => onChange({
                    quotas: keys.flatMap(key => variant.quotas.filter(quota => quota.key === key)),
                })}
                renderItem={(quota, { handle, index }) => <>
                    {index > 0 && <p className={flowStepClassName}>↓ Fylles deretter</p>}
                    <QuotaRow
                        quota={quota}
                        index={index}
                        several={several}
                        handle={handle}
                        onChange={changes => changeQuota(quota.key, changes)}
                        onRemove={() => onChange({ quotas: variant.quotas.filter(other => other.key !== quota.key) })}
                    />
                </>}
            />
            {waitingList && <>
                <p className={flowStepClassName}>↓ Når alt er fullt</p>
                <div className="flex items-center justify-between gap-2 p-3 rounded-inner bg-base-100">
                    <h4 className="m-0">Venteliste</h4>
                    <span className="tabular-nums">{variant.numOnWaitingList} venter</span>
                </div>
            </>}
        </div>
        {addLabel && <Button
            type="button"
            color="secondary"
            onClick={() => onChange({
                quotas: [...variant.quotas, newQuotaDraft(`Kvote ${variant.quotas.length + 1}`, variant.quotas)],
            })}
            className="self-start w-auto! m-0!"
        >
            <FontAwesomeIcon icon={faPlus} /> {addLabel}
        </Button>}
    </div>
}

function RegistrationPeriod({ variant, onChange }: {
    variant: VariantDraft,
    onChange: (changes: Partial<VariantDraft>) => void,
}) {
    return <div className="
        grid grid-cols-2 gap-x-4
        max-mobile:grid-cols-1
    ">
        <DateInput
            label="Påmelding åpner"
            includeTime
            defaultValue={variant.registrationStart}
            onChange={event => {
                if (event.target.value) onChange({ registrationStart: new Date(event.target.value) })
            }}
        />
        <DateInput
            label="Påmelding stenger"
            includeTime
            defaultValue={variant.registrationEnd}
            onChange={event => {
                if (event.target.value) onChange({ registrationEnd: new Date(event.target.value) })
            }}
        />
    </div>
}

type Shape = 'NONE' | 'SHARED' | 'QUOTAS' | 'VARIANTS'

const shapes: { value: Shape, title: string, hint: string }[] = [
    { value: 'NONE', title: 'Ingen påmelding', hint: 'Folk bare møter opp' },
    { value: 'SHARED', title: 'Felles plasser', hint: 'Alle i samme kø' },
    { value: 'QUOTAS', title: 'Kvoter', hint: 'Plasser holdes av til ulike grupper' },
    { value: 'VARIANTS', title: 'Varianter', hint: 'Folk velger, for eksempel med eller uten VIP' },
]

function shapeOf(variants: VariantDraft[]): Shape {
    if (variants.length === 0) return 'NONE'
    if (variants.length > 1) return 'VARIANTS'
    return variants[0].quotas.length > 1 ? 'QUOTAS' : 'SHARED'
}

/** Why the event cannot go to the shape from here, since it would take someone's place. */
function blockedReason(shape: Shape, variants: VariantDraft[]) {
    if (shape === shapeOf(variants) || shape === 'VARIANTS') return null
    if (shape === 'NONE') return variants.some(hasRegistrants) ? 'Noen er påmeldt' : null
    if (variants.slice(1).some(hasRegistrants)) return 'Noen er påmeldt en annen variant'
    const otherQuotas = variants[0]?.quotas.slice(1) ?? []
    if (shape === 'SHARED' && otherQuotas.some(quota => quota.numOfRegistrations > 0)) {
        return 'Noen er påmeldt en annen kvote'
    }
    return null
}

function variantsInShape(shape: Shape, variants: VariantDraft[], eventStart: Date): VariantDraft[] {
    if (shape === 'NONE') return []
    const first = variants.at(0) ?? newVariantDraft(shape === 'VARIANTS' ? 'Variant 1' : 'Påmelding', eventStart, [])
    if (shape === 'VARIANTS') {
        return variants.length > 1 ? variants : [first, newVariantDraft('Variant 2', eventStart, [first], first)]
    }
    if (shape === 'SHARED') {
        const places = first.quotas.reduce((sum, quota) => sum + quota.places, 0)
        return [{ ...first, quotas: [{ ...first.quotas[0], places }] }]
    }
    if (first.quotas.length > 1) return [first]
    return [{
        ...first,
        quotas: [{ ...first.quotas[0], name: 'Kvote 1' }, newQuotaDraft('Kvote 2', first.quotas)],
    }]
}

/**
 * Where the variants and quotas of an event are edited, in the `EventVariantsField` around the
 * form. Nothing here is saved until the form is, so the buttons at the top only change what the
 * form will send.
 */
export default function EventRegistrationFields({ waitingList, eventStart }: {
    waitingList: boolean,
    eventStart: Date,
}) {
    const { variants, setVariants, changeVariant } = useEventVariantsField()
    const current = shapeOf(variants)

    return <div className="flex flex-col gap-4 min-w-0 pb-4">
        <OptionCards
            options={shapes.map(shape => ({ ...shape, blocked: blockedReason(shape.value, variants) }))}
            value={current}
            onChange={shape => setVariants(variantsInShape(shape, variants, eventStart))}
        />

        {current === 'NONE' && <p className="m-0 text-base-content/80">Arrangementet vises uten påmelding.</p>}

        {variants.length === 1 && <AdminSection>
            <RegistrationPeriod variant={variants[0]} onChange={changes => changeVariant(variants[0].key, changes)} />
            <VariantDescription variant={variants[0]} onChange={changes => changeVariant(variants[0].key, changes)} />
            <QuotaFlow
                variant={variants[0]}
                waitingList={waitingList}
                addLabel={current === 'QUOTAS' ? 'Legg til kvote' : undefined}
                onChange={changes => changeVariant(variants[0].key, changes)}
            />
        </AdminSection>}

        {variants.length > 1 && <>
            {variants.map(variant => <AdminSection key={variant.key}>
                <div className="flex items-center gap-2">
                    <TextInput
                        label="Navn på varianten"
                        value={variant.name}
                        onChange={event => changeVariant(variant.key, { name: event.target.value })}
                        className="flex-1 max-w-none! mt-0!"
                    />
                    <Button
                        type="button"
                        variant="text"
                        color="red"
                        title={hasRegistrants(variant) ? 'Varianten har påmeldte' : undefined}
                        disabled={hasRegistrants(variant)}
                        onClick={() => setVariants(variants.filter(other => other.key !== variant.key))}
                    >
                        Fjern varianten
                    </Button>
                </div>
                <RegistrationPeriod variant={variant} onChange={changes => changeVariant(variant.key, changes)} />
                <VariantDescription variant={variant} onChange={changes => changeVariant(variant.key, changes)} />
                <QuotaFlow
                    variant={variant}
                    waitingList={waitingList}
                    addLabel={variant.quotas.length > 1 ? 'Legg til kvote' : 'Del varianten i kvoter'}
                    onChange={changes => changeVariant(variant.key, changes)}
                />
            </AdminSection>)}
            <Button
                type="button"
                color="secondary"
                onClick={() => setVariants([
                    ...variants,
                    newVariantDraft(`Variant ${variants.length + 1}`, eventStart, variants, variants[0]),
                ])}
                className="self-start w-auto! m-0!"
            >
                <FontAwesomeIcon icon={faPlus} /> Legg til variant
            </Button>
        </>}
    </div>
}

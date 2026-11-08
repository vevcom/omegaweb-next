'use client'
import EventQuotaBar from './EventQuotaBar'
import { hasRegistrants, newQuotaDraft, newVariantDraft } from './eventSetupDraft'
import Button from '@/components/UI/Button'
import DateInput from '@/components/UI/DateInput'
import NumberInput from '@/components/UI/NumberInput'
import ReorderableList from '@/components/UI/ReorderableList'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { describeAudience } from '@/auth/visibility/describeVisibility'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { QuotaDraft, VariantDraft } from './eventSetupDraft'
import type { ReactNode } from 'react'

const sectionClassName = `
    flex flex-col gap-3 p-4 rounded-round bg-base-200
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
`

const flowStepClassName = 'm-0 py-1 pl-3 text-s text-base-content/80'

const linkButtonClassName = `
    shrink-0 border-none bg-transparent p-0 text-s text-primary cursor-pointer
    hover:underline
`

const removeButtonClassName = `
    shrink-0 border-none bg-transparent p-0 text-s text-error cursor-pointer
    enabled:hover:underline
    disabled:text-base-content/80 disabled:cursor-not-allowed
`

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
                    name={`quotaName${quota.key}`}
                    value={quota.name}
                    onChange={event => onChange({ name: event.target.value })}
                    className="flex-1 min-w-40 max-w-none! mt-0!"
                />
                : <span className="flex-1">Antall plasser</span>}
            <NumberInput
                label="Plasser"
                name={`quotaPlaces${quota.key}`}
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
                <button
                    type="button"
                    aria-expanded={editingWho}
                    onClick={() => setEditingWho(!editingWho)}
                    className={linkButtonClassName}
                >
                    {editingWho ? 'Lukk' : 'Endre hvem'}
                </button>
                {several && <button
                    type="button"
                    aria-label="Fjern kvoten"
                    title={quota.numOfRegistrations > 0 ? 'Kvoten har påmeldte' : undefined}
                    disabled={quota.numOfRegistrations > 0}
                    onClick={onRemove}
                    className={removeButtonClassName}
                >
                    Fjern
                </button>}
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
                saveOrder={keys => {
                    onChange({ quotas: keys.flatMap(key => variant.quotas.filter(quota => quota.key === key)) })
                    return Promise.resolve({ success: true, data: undefined })
                }}
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
            onClick={() => onChange({ quotas: [...variant.quotas, newQuotaDraft(`Kvote ${variant.quotas.length + 1}`)] })}
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
            name={`registrationStart${variant.key}`}
            includeTime
            defaultValue={variant.registrationStart}
            onChange={event => {
                if (event.target.value) onChange({ registrationStart: new Date(event.target.value) })
            }}
        />
        <DateInput
            label="Påmelding stenger"
            name={`registrationEnd${variant.key}`}
            includeTime
            defaultValue={variant.registrationEnd}
            onChange={event => {
                if (event.target.value) onChange({ registrationEnd: new Date(event.target.value) })
            }}
        />
    </div>
}

type Shape = 'NONE' | 'SHARED' | 'QUOTAS' | 'VARIANTS'

const shapes: { shape: Shape, name: string, hint: string }[] = [
    { shape: 'NONE', name: 'Ingen påmelding', hint: 'Folk bare møter opp' },
    { shape: 'SHARED', name: 'Felles plasser', hint: 'Alle i samme kø' },
    { shape: 'QUOTAS', name: 'Kvoter', hint: 'Plasser holdes av til ulike grupper' },
    { shape: 'VARIANTS', name: 'Varianter', hint: 'Folk velger, for eksempel med eller uten VIP' },
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
    const first = variants.at(0) ?? newVariantDraft(shape === 'VARIANTS' ? 'Variant 1' : 'Påmelding', eventStart)
    if (shape === 'VARIANTS') {
        return variants.length > 1 ? variants : [first, newVariantDraft('Variant 2', eventStart, first)]
    }
    if (shape === 'SHARED') {
        const places = first.quotas.reduce((sum, quota) => sum + quota.places, 0)
        return [{ ...first, quotas: [{ ...first.quotas[0], places }] }]
    }
    if (first.quotas.length > 1) return [first]
    return [{
        ...first,
        quotas: [{ ...first.quotas[0], name: 'Kvote 1' }, newQuotaDraft('Kvote 2')],
    }]
}

/**
 * The variants and quotas of an event as the form holds them. Nothing here is saved until the form
 * is, so the buttons at the top only change what the form will send.
 */
export default function EventRegistrationFields({ variants, waitingList, eventStart, onChange }: {
    variants: VariantDraft[],
    waitingList: boolean,
    eventStart: Date,
    onChange: (variants: VariantDraft[]) => void,
}) {
    const current = shapeOf(variants)
    const changeVariant = (key: number, changes: Partial<VariantDraft>) => onChange(
        variants.map(variant => (variant.key === key ? { ...variant, ...changes } : variant))
    )

    return <div className="flex flex-col gap-4 min-w-0 pb-4">
        <div className="
            grid grid-cols-4 gap-2
            max-mobile:grid-cols-2
        ">
            {shapes.map(option => {
                const blocked = blockedReason(option.shape, variants)
                return <button
                    key={option.shape}
                    type="button"
                    aria-pressed={current === option.shape}
                    disabled={blocked !== null}
                    onClick={() => onChange(variantsInShape(option.shape, variants, eventStart))}
                    className={`
                        flex flex-col gap-0.5 p-2.5 rounded-inner border text-left cursor-pointer bg-base-200
                        disabled:cursor-not-allowed disabled:opacity-50
                        ${current === option.shape
        ? 'border-primary ring-1 ring-primary'
        : `
            border-base-300
            hover:bg-base-300
        `}
                    `}
                >
                    <span className="font-bold">{option.name}</span>
                    <span className="text-s text-base-content/80">{blocked ?? option.hint}</span>
                </button>
            })}
        </div>

        {current === 'NONE' && <p className="m-0 text-base-content/80">Arrangementet vises uten påmelding.</p>}

        {variants.length === 1 && <section className={sectionClassName}>
            <RegistrationPeriod variant={variants[0]} onChange={changes => changeVariant(variants[0].key, changes)} />
            <QuotaFlow
                variant={variants[0]}
                waitingList={waitingList}
                addLabel={current === 'QUOTAS' ? 'Legg til kvote' : undefined}
                onChange={changes => changeVariant(variants[0].key, changes)}
            />
        </section>}

        {variants.length > 1 && <>
            {variants.map(variant => <section key={variant.key} className={sectionClassName}>
                <div className="flex items-center gap-2">
                    <TextInput
                        label="Navn på varianten"
                        name={`variantName${variant.key}`}
                        value={variant.name}
                        onChange={event => changeVariant(variant.key, { name: event.target.value })}
                        className="flex-1 max-w-none! mt-0!"
                    />
                    <button
                        type="button"
                        title={hasRegistrants(variant) ? 'Varianten har påmeldte' : undefined}
                        disabled={hasRegistrants(variant)}
                        onClick={() => onChange(variants.filter(other => other.key !== variant.key))}
                        className={removeButtonClassName}
                    >
                        Fjern varianten
                    </button>
                </div>
                <RegistrationPeriod variant={variant} onChange={changes => changeVariant(variant.key, changes)} />
                <QuotaFlow
                    variant={variant}
                    waitingList={waitingList}
                    addLabel={variant.quotas.length > 1 ? 'Legg til kvote' : 'Del varianten i kvoter'}
                    onChange={changes => changeVariant(variant.key, changes)}
                />
            </section>)}
            <Button
                type="button"
                color="secondary"
                onClick={() => onChange([
                    ...variants,
                    newVariantDraft(`Variant ${variants.length + 1}`, eventStart, variants[0]),
                ])}
                className="self-start w-auto! m-0!"
            >
                <FontAwesomeIcon icon={faPlus} /> Legg til variant
            </Button>
        </>}
    </div>
}

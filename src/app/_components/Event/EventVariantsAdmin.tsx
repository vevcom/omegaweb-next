'use client'
import EventQuotaBar from './EventQuotaBar'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/components/UI/Slider'
import Button from '@/components/UI/Button'
import HorizontalSelector from '@/components/UI/HorizontalSelector'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import {
    createEventQuotaAction,
    destroyEventQuotaAction,
    reorderEventQuotasAction,
    updateEventQuotaAction,
    updateEventQuotaVisibilityAction,
} from '@/services/events/quotas/actions'
import {
    createEventVariantAction,
    destroyEventVariantAction,
    updateEventVariantAction,
} from '@/services/events/variants/actions'
import { configureAction } from '@/services/configureAction'
import { describeAudience } from '@/auth/visibility/describeVisibility'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Fragment, useState } from 'react'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { EventQuotaExpanded } from '@/services/events/quotas/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

type PropTypes = {
    eventId: number,
    variants: EventVariantExpanded[],
    waitingList: boolean,
}

const sectionClassName = `
    flex flex-col gap-3 p-4 rounded-round bg-surface-raised
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0 [&>p]:text-s [&>p]:text-text-muted
`

/** The ids with the item at `index` swapped one step in `direction`. */
function orderAfterMoving(ids: number[], index: number, direction: 'UP' | 'DOWN') {
    const swapped = [...ids]
    const other = direction === 'UP' ? index - 1 : index + 1
    swapped[index] = ids[other]
    swapped[other] = ids[index]
    return swapped
}

function ReorderButtons({ index, count, reorder }: {
    index: number,
    count: number,
    reorder: (direction: 'UP' | 'DOWN') => ReturnType<Parameters<typeof Form>[0]['action']>,
}) {
    return <div className="flex gap-1">
        {index > 0 && <Form
            action={() => reorder('UP')}
            submitText={<FontAwesomeIcon icon={faArrowUp} />}
            buttonClassName="w-auto!"
            refreshOnSuccess
        />}
        {index < count - 1 && <Form
            action={() => reorder('DOWN')}
            submitText={<FontAwesomeIcon icon={faArrowDown} />}
            buttonClassName="w-auto!"
            refreshOnSuccess
        />}
    </div>
}

function VariantFields({ variant, shared }: { variant?: EventVariantExpanded, shared: boolean }) {
    const [takesPayment, setTakesPayment] = useState(variant?.takesPayment ?? false)
    return <>
        {!shared && <TextInput label="Navn" name="name" defaultValue={variant?.name} />}
        <DateInput label="Påmeldingsstart" name="registrationStart" defaultValue={variant?.registrationStart} includeTime />
        <DateInput label="Påmeldingsslutt" name="registrationEnd" defaultValue={variant?.registrationEnd} includeTime />
        <Slider
            label="Tar betaling"
            name="takesPayment"
            defaultChecked={variant?.takesPayment}
            onChange={changeEvent => setTakesPayment(changeEvent.target.checked)}
        />
        {takesPayment && <>
            <NumberInput
                label="Pris"
                name="price"
                min={0}
                defaultValue={variant?.price ? variant.price / 100 : undefined}
            />
            <DateInput
                label="Betalingsstart"
                name="paymentStart"
                defaultValue={variant?.paymentStart ?? undefined}
                includeTime
            />
            <DateInput
                label="Betalingsslutt"
                name="paymentEnd"
                defaultValue={variant?.paymentEnd ?? undefined}
                includeTime
            />
            <Slider
                label="Flytt ubetalte bakerst på ventelisten"
                name="requeueUnpaidRegistrations"
                defaultChecked={variant?.requeueUnpaidRegistrations}
            />
        </>}
    </>
}

function VariantAdmin({ variant, shared }: {
    variant: EventVariantExpanded,
    /** The only variant of the event, which registrants never see named and which is removed from the shapes above. */
    shared: boolean,
}) {
    const registered = variant.numOfRegistrations + variant.numOnWaitingList

    return <section className={sectionClassName}>
        <Form
            key={variant.id}
            action={configureAction(updateEventVariantAction, { params: { id: variant.id } })}
            submitText="Lagre"
            refreshOnSuccess
        >
            <FormSection legend={shared ? 'Påmeldingsperiode og betaling' : 'Om varianten'} columns={2}>
                <VariantFields variant={variant} shared={shared} />
            </FormSection>
        </Form>
        {!shared && (registered === 0 ? <Form
            action={configureAction(destroyEventVariantAction, { params: { id: variant.id } })}
            submitText="Fjern varianten"
            submitColor="red"
            confirmation={{ confirm: true, text: 'Er du sikker på at du vil fjerne denne varianten?' }}
            refreshOnSuccess
        /> : <p>Varianten kan fjernes når ingen er påmeldt den.</p>)}
    </section>
}

function QuotaAdmin({ quota, index, quotaIds, variantId }: {
    quota: EventQuotaExpanded,
    index: number,
    /** Every quota of the variant in order, which a reorder names in full. */
    quotaIds: number[],
    variantId: number,
}) {
    const [editing, setEditing] = useState(false)
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null
    const several = quotaIds.length > 1

    return <section className="flex flex-col gap-2 p-3 rounded-inner bg-surface-base">
        <div className="flex flex-wrap items-center gap-2">
            {several && <span className="
                grid place-items-center size-6 shrink-0 rounded-full bg-accent-blue text-text-inv text-s font-bold
            ">{index + 1}</span>}
            <h4 className="m-0 mr-auto">{quota.name}</h4>
            <span className="tabular-nums">{quota.numOfRegistrations} / {quota.places}</span>
            {several && <ReorderButtons
                index={index}
                count={quotaIds.length}
                reorder={direction => configureAction(reorderEventQuotasAction, { params: { variantId } })({
                    data: { quotaIds: orderAfterMoving(quotaIds, index, direction) },
                })}
            />}
        </div>
        <EventQuotaBar taken={quota.numOfRegistrations} places={quota.places} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-s">
            <span className="text-text-muted">{describeAudience(quota.visibility, groups)}</span>
            <button
                type="button"
                aria-expanded={editing}
                onClick={() => setEditing(!editing)}
                className="
                    border-none bg-transparent p-0 text-accent-blue cursor-pointer
                    hover:underline
                "
            >
                {editing ? 'Lukk' : 'Endre'}
            </button>
        </div>
        {editing && <>
            <Form
                action={configureAction(updateEventQuotaAction, { params: { id: quota.id } })}
                submitText="Lagre"
                refreshOnSuccess
            >
                <FormSection legend="Om kvoten" columns={2}>
                    <TextInput label="Navn" name="name" defaultValue={quota.name} />
                    <NumberInput label="Plasser" name="places" min={0} defaultValue={quota.places} />
                </FormSection>
            </Form>
            <p className="m-0 font-medium">Hvem kan melde seg på gjennom kvoten (tomt betyr alle)</p>
            <VisibilityAdmin
                visibility={quota.visibility}
                visibilityId={quota.visibilityId}
                updateVisibilityAction={configureAction(
                    updateEventQuotaVisibilityAction,
                    { implementationParams: { id: quota.id } }
                )}
            />
            {quota.numOfRegistrations === 0 ? <Form
                action={configureAction(destroyEventQuotaAction, { params: { id: quota.id } })}
                submitText="Fjern kvoten"
                submitColor="red"
                confirmation={{ confirm: true, text: 'Er du sikker på at du vil fjerne denne kvoten?' }}
                refreshOnSuccess
            /> : <p className="m-0 text-s text-text-muted">
                Sett plassene til 0 for å tømme kvoten før du fjerner den. De påmeldte flyttes til neste kvote de kan
                melde seg på, eller til ventelisten.
            </p>}
        </>}
    </section>
}

function NewQuotaForm({ variantId, onAdded }: { variantId: number, onAdded: () => void }) {
    const [requirements, setRequirements] = useState<VisibilityRequirement[]>([])
    return <Form
        key={variantId}
        action={configureAction(createEventQuotaAction, { params: { variantId } })}
        submitText="Legg til kvote"
        successCallback={onAdded}
        refreshOnSuccess
    >
        <FormSection legend="Ny kvote" columns={2}>
            <TextInput label="Navn" name="name" />
            <NumberInput label="Plasser" name="places" min={0} />
        </FormSection>
        <p className="m-0 font-medium">Hvem kan melde seg på gjennom kvoten (tomt betyr alle)</p>
        <VisibilityMatrixEditor requirements={requirements} onChange={setRequirements} />
        <input type="hidden" name="visibilityRequirements" value={JSON.stringify(requirements)} />
    </Form>
}

const flowStepClassName = 'm-0 py-1 pl-3 text-s text-text-muted'

/** The order places are given out in, from the first quota down to the waiting list. */
function QuotasAdmin({ variant, waitingList, adding, onAdd, onAdded }: {
    variant: EventVariantExpanded,
    waitingList: boolean,
    adding: boolean,
    onAdd: () => void,
    onAdded: () => void,
}) {
    return <section className={sectionClassName}>
        <h3>Plasser</h3>
        <div className="flex flex-col">
            {variant.quotas.map((quota, index) => <Fragment key={quota.id}>
                {index > 0 && <p className={flowStepClassName}>↓ Fylles deretter</p>}
                <QuotaAdmin
                    quota={quota}
                    index={index}
                    quotaIds={variant.quotas.map(other => other.id)}
                    variantId={variant.id}
                />
            </Fragment>)}
            {waitingList && <>
                {variant.quotas.length > 0 && <p className={flowStepClassName}>↓ Når alt er fullt</p>}
                <div className="flex items-center justify-between gap-2 p-3 rounded-inner bg-surface-base">
                    <h4 className="m-0">Venteliste</h4>
                    <span className="tabular-nums">{variant.numOnWaitingList} venter</span>
                </div>
            </>}
        </div>
        {adding || variant.quotas.length === 0
            ? <NewQuotaForm variantId={variant.id} onAdded={onAdded} />
            : variant.quotas.length > 1 && <Button color="secondary" onClick={onAdd} className="self-start w-auto! m-0!">
                <FontAwesomeIcon icon={faPlus} /> Legg til kvote
            </Button>}
    </section>
}

function NewVariantForm({ eventId, shared, onCreated }: { eventId: number, shared: boolean, onCreated: () => void }) {
    return <section className={sectionClassName}>
        <h3>{shared ? 'Når er påmeldingen åpen?' : 'Ny variant'}</h3>
        {!shared && <p>
            En variant er én måte å delta på, for eksempel med eller uten VIP, med egen påmeldingsperiode og pris.
            Den som melder seg på velger variant.
        </p>}
        <Form
            action={configureAction(createEventVariantAction, { params: { eventId } })}
            submitText={shared ? 'Slå på påmelding' : 'Legg til variant'}
            successCallback={onCreated}
            refreshOnSuccess
        >
            {shared && <input type="hidden" name="name" value="Påmelding" />}
            <FormSection legend={shared ? 'Påmeldingsperiode og betaling' : 'Om varianten'} columns={2}>
                <VariantFields shared={shared} />
            </FormSection>
        </Form>
    </section>
}

type Shape = 'NONE' | 'SHARED' | 'QUOTAS' | 'VARIANTS'

const shapes: { shape: Shape, name: string, hint: string }[] = [
    { shape: 'NONE', name: 'Ingen påmelding', hint: 'Folk bare møter opp' },
    { shape: 'SHARED', name: 'Felles plasser', hint: 'Alle i samme kø' },
    { shape: 'QUOTAS', name: 'Kvoter', hint: 'Plasser holdes av til ulike grupper' },
    { shape: 'VARIANTS', name: 'Varianter', hint: 'Folk velger, for eksempel med eller uten VIP' },
]

function shapeOf(variants: EventVariantExpanded[]): Shape {
    if (variants.length === 0) return 'NONE'
    if (variants.length > 1) return 'VARIANTS'
    return variants[0].quotas.length > 1 ? 'QUOTAS' : 'SHARED'
}

/** Why the event cannot go to the shape from here. Nothing is removed by picking one, so what is in the way is named. */
function blockedReason(shape: Shape, variants: EventVariantExpanded[]) {
    if (shape === shapeOf(variants) || shape === 'VARIANTS') return null
    if (variants.length > 1) return 'Fjern variantene først'
    if (shape === 'NONE' && variants.some(variant => variant.numOfRegistrations + variant.numOnWaitingList > 0)) {
        return 'Noen er påmeldt'
    }
    if (shape === 'SHARED' && variants[0]?.quotas.length > 1) return 'Fjern kvotene først'
    return null
}

export default function EventVariantsAdmin({ eventId, variants, waitingList }: PropTypes) {
    const [selectedId, setSelectedId] = useState<number | null>(variants[0]?.id ?? null)
    const [picked, setPicked] = useState<Shape | null>(null)
    const selected = variants.find(variant => variant.id === selectedId) ?? variants[0] ?? null
    const current = shapeOf(variants)
    const shape = picked ?? current
    const shared = variants.length < 2 && !(picked === 'VARIANTS' && variants.length === 0)
    // The first variant only sets the event up for what was picked, which still has its own step.
    const finishStep = () => {
        if (variants.length > 0) setPicked(null)
    }

    return <div className="
        flex flex-col gap-4 min-w-0
        [&>h2]:m-0
    ">
        <h2>Påmelding</h2>

        <div className="
            grid grid-cols-4 gap-2
            max-mobile:grid-cols-2
        ">
            {shapes.map(option => {
                const blocked = blockedReason(option.shape, variants)
                return <button
                    key={option.shape}
                    type="button"
                    aria-pressed={shape === option.shape}
                    disabled={blocked !== null}
                    onClick={() => setPicked(option.shape === current ? null : option.shape)}
                    className={`
                        flex flex-col gap-0.5 p-2.5 rounded-inner border text-left cursor-pointer bg-surface-raised
                        disabled:cursor-not-allowed disabled:opacity-50
                        ${shape === option.shape
        ? 'border-accent-blue ring-1 ring-accent-blue'
        : `
            border-surface-subtle
            hover:bg-surface-hover
        `}
                    `}
                >
                    <span className="font-bold">{option.name}</span>
                    <span className="text-s text-text-muted">{blocked ?? option.hint}</span>
                </button>
            })}
        </div>

        {shape === 'NONE' && (selected ? <section className={sectionClassName}>
            <p>Fjerner påmeldingen med plassene og kvotene sine. Ingen er påmeldt, så ingen mister noe.</p>
            <Form
                action={configureAction(destroyEventVariantAction, { params: { id: selected.id } })}
                submitText="Fjern påmeldingen"
                submitColor="red"
                confirmation={{ confirm: true, text: 'Er du sikker på at du vil fjerne påmeldingen?' }}
                successCallback={finishStep}
                refreshOnSuccess
            />
        </section> : <p className="m-0 text-text-muted">Arrangementet vises uten påmelding.</p>)}

        {shape !== 'NONE' && (selected === null || picked === 'VARIANTS') && <NewVariantForm
            eventId={eventId}
            shared={shared && selected === null}
            onCreated={finishStep}
        />}

        {shape !== 'NONE' && selected && picked !== 'VARIANTS' && <>
            {variants.length > 1 && <div className="flex flex-wrap items-center gap-2">
                <HorizontalSelector
                    name="variant"
                    value={selected.id}
                    onChange={setSelectedId}
                    options={variants.map(variant => ({ value: variant.id, label: variant.name }))}
                />
                <Button color="secondary" onClick={() => setPicked('VARIANTS')} className="w-auto! m-0!">
                    <FontAwesomeIcon icon={faPlus} /> Legg til variant
                </Button>
            </div>}
            <QuotasAdmin
                variant={selected}
                waitingList={waitingList}
                adding={picked === 'QUOTAS'}
                onAdd={() => setPicked('QUOTAS')}
                onAdded={finishStep}
            />
            <VariantAdmin variant={selected} shared={variants.length === 1} />
        </>}
    </div>
}

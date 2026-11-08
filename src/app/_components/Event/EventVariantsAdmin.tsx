'use client'
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { EventQuotaExpanded } from '@/services/events/quotas/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

type PropTypes = {
    eventId: number,
    variants: EventVariantExpanded[],
}

const sectionClassName = `
    flex flex-col gap-3 p-4 rounded-round layer
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0 [&>p]:text-s [&>p]:text-base-content/80
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

function VariantFields({ variant }: { variant?: EventVariantExpanded }) {
    const [takesPayment, setTakesPayment] = useState(variant?.takesPayment ?? false)
    return <>
        <TextInput label="Navn" name="name" defaultValue={variant?.name} />
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

function VariantAdmin({ variant }: { variant: EventVariantExpanded }) {
    const registered = variant.numOfRegistrations + variant.numOnWaitingList

    return <section className={sectionClassName}>
        <p>{variant.numOfRegistrations} av {variant.places} plasser er tatt, {variant.numOnWaitingList} venter.</p>
        <Form
            key={variant.id}
            action={configureAction(updateEventVariantAction, { params: { id: variant.id } })}
            submitText="Lagre"
            refreshOnSuccess
        >
            <FormSection legend="Om varianten" columns={2}>
                <VariantFields variant={variant} />
            </FormSection>
        </Form>
        {registered === 0 ? <Form
            action={configureAction(destroyEventVariantAction, { params: { id: variant.id } })}
            submitText="Fjern varianten"
            submitColor="red"
            confirmation={{ confirm: true, text: 'Er du sikker på at du vil fjerne denne varianten?' }}
            refreshOnSuccess
        /> : <p>Varianten kan fjernes når ingen er påmeldt den.</p>}
    </section>
}

function QuotaAdmin({ quota, index, quotaIds, variantId }: {
    quota: EventQuotaExpanded,
    index: number,
    /** Every quota of the variant in order, which a reorder names in full. */
    quotaIds: number[],
    variantId: number,
}) {
    return <section className="flex flex-col gap-2 p-3 rounded-inner bg-base-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="m-0">{index + 1}. {quota.name} · {quota.numOfRegistrations} / {quota.places}</h4>
            <ReorderButtons
                index={index}
                count={quotaIds.length}
                reorder={direction => configureAction(reorderEventQuotasAction, { params: { variantId } })({
                    data: { quotaIds: orderAfterMoving(quotaIds, index, direction) },
                })}
            />
        </div>
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
        /> : <p className="m-0 text-s text-base-content/80">
            Sett plassene til 0 for å tømme kvoten før du fjerner den. De påmeldte flyttes til neste kvote de kan
            melde seg på, eller til ventelisten.
        </p>}
    </section>
}

function NewQuotaForm({ variantId }: { variantId: number }) {
    const [requirements, setRequirements] = useState<VisibilityRequirement[]>([])
    return <Form
        key={variantId}
        action={configureAction(createEventQuotaAction, { params: { variantId } })}
        submitText="Legg til kvote"
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

function QuotasAdmin({ variant }: { variant: EventVariantExpanded }) {
    return <section className={sectionClassName}>
        <p>Kvotene fylles ovenfra. En ledig plass går til den første i køen som passer kvoten.</p>
        {variant.quotas.map((quota, index) => <QuotaAdmin
            key={quota.id}
            quota={quota}
            index={index}
            quotaIds={variant.quotas.map(other => other.id)}
            variantId={variant.id}
        />)}
        <NewQuotaForm variantId={variant.id} />
    </section>
}

function NewVariantForm({ eventId }: { eventId: number }) {
    return <section className={sectionClassName}>
        <h3>Ny variant</h3>
        <p>En variant er én måte å delta på, med egen påmeldingsperiode og pris. Den som melder seg på velger variant.</p>
        <Form
            action={configureAction(createEventVariantAction, { params: { eventId } })}
            submitText="Legg til variant"
            refreshOnSuccess
        >
            <FormSection legend="Om varianten" columns={2}>
                <VariantFields />
            </FormSection>
        </Form>
    </section>
}

type View = 'VARIANT' | 'QUOTAS'

export default function EventVariantsAdmin({ eventId, variants }: PropTypes) {
    const [selectedId, setSelectedId] = useState<number | null>(variants[0]?.id ?? null)
    const [view, setView] = useState<View>('VARIANT')
    const selected = variants.find(variant => variant.id === selectedId) ?? null

    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,48rem)]
        [&>h2]:m-0
    ">
        <h2>Varianter og kvoter</h2>

        <div className="flex flex-wrap items-center gap-2">
            {variants.length > 0 && <HorizontalSelector
                name="variant"
                value={selectedId ?? -1}
                onChange={setSelectedId}
                options={variants.map(variant => ({ value: variant.id, label: variant.name }))}
            />}
            <Button
                color={selected ? 'secondary' : 'primary'}
                onClick={() => setSelectedId(null)}
                aria-label="Ny variant"
                className="w-auto! m-0!"
            >
                <FontAwesomeIcon icon={faPlus} />
            </Button>
        </div>

        {selected ? <>
            <HorizontalSelector
                name="view"
                value={view}
                onChange={setView}
                options={[{ value: 'VARIANT', label: 'Om varianten' }, { value: 'QUOTAS', label: 'Kvoter' }]}
            />
            {view === 'VARIANT' ? <VariantAdmin variant={selected} /> : <QuotasAdmin variant={selected} />}
        </> : <NewVariantForm eventId={eventId} />}
    </div>
}

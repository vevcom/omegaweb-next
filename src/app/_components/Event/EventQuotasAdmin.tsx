'use client'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import DateInput from '@/components/UI/DateInput'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import {
    createEventQuotaAction,
    destroyEventQuotaAction,
    reorderEventQuotasAction,
    updateEventQuotaAction,
    updateEventQuotaVisibilityAction,
} from '@/services/events/quotas/actions'
import { configureAction } from '@/services/configureAction'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { EventQuotaExpanded } from '@/services/events/quotas/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

type PropTypes = {
    event: { id: number, takesPayment: boolean },
    /** The quotas in fill order. */
    quotas: EventQuotaExpanded[],
}

const sectionClassName = `
    flex flex-col gap-3 p-4 rounded-round layer
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0 [&>p]:text-s [&>p]:text-text-muted
`

/** The fields of one quota, shared by the editor of each quota and the form for a new one. */
function QuotaFields({ quota, takesPayment }: { quota?: EventQuotaExpanded, takesPayment: boolean }) {
    return <>
        <TextInput label="Navn" name="name" defaultValue={quota?.name} />
        <NumberInput label="Plasser" name="places" min={0} defaultValue={quota?.places} />
        <DateInput label="Påmeldingsstart" name="registrationStart" defaultValue={quota?.registrationStart} includeTime />
        <DateInput label="Påmeldingsslutt" name="registrationEnd" defaultValue={quota?.registrationEnd} includeTime />
        {takesPayment && (
            <NumberInput label="Pris" name="price" min={0} defaultValue={quota?.price ? quota.price / 100 : undefined} />
        )}
    </>
}

/**
 * The quotas of an event: their order, which is the order they fill in, each one's places, period,
 * price and who may register through it, and a form for one more.
 */
export default function EventQuotasAdmin({ event, quotas }: PropTypes) {
    const [newRequirements, setNewRequirements] = useState<VisibilityRequirement[]>([])
    const reorder = configureAction(reorderEventQuotasAction, { params: { eventId: event.id } })

    /** The ids with the quota at `index` swapped one step in `direction`. */
    const orderAfterMoving = (index: number, direction: 'UP' | 'DOWN') => {
        const ids = quotas.map(quota => quota.id)
        const other = direction === 'UP' ? index - 1 : index + 1
        ids[index] = quotas[other].id
        ids[other] = quotas[index].id
        return ids
    }

    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,48rem)]
        [&>h2]:m-0
    ">
        <h2>Kvoter</h2>
        <p className="m-0 text-s text-text-muted">
            Kvotene fylles ovenfra: den som melder seg på får plass i den første kvoten de kan melde seg
            på som har ledig. Ventelisten er felles, og en ledig plass går til den første på den som
            passer kvoten.
        </p>

        {quotas.map((quota, index) => <section key={quota.id} className={sectionClassName}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3>{index + 1}. {quota.name}</h3>
                <div className="flex gap-1">
                    {index > 0 && <Form
                        action={() => reorder({ data: { quotaIds: orderAfterMoving(index, 'UP') } })}
                        submitText={<FontAwesomeIcon icon={faArrowUp} />}
                        buttonClassName="w-auto!"
                        refreshOnSuccess
                    />}
                    {index < quotas.length - 1 && <Form
                        action={() => reorder({ data: { quotaIds: orderAfterMoving(index, 'DOWN') } })}
                        submitText={<FontAwesomeIcon icon={faArrowDown} />}
                        buttonClassName="w-auto!"
                        refreshOnSuccess
                    />}
                </div>
            </div>
            <p>{quota.numOfRegistrations} av {quota.places} plasser er tatt.</p>
            <Form
                action={configureAction(updateEventQuotaAction, { params: { id: quota.id } })}
                submitText="Lagre"
                refreshOnSuccess
            >
                <FormSection legend="Om kvoten" columns={2}>
                    <QuotaFields quota={quota} takesPayment={event.takesPayment} />
                </FormSection>
            </Form>
            <p className="font-medium">Hvem kan melde seg på gjennom kvoten (tomt betyr alle)</p>
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
            /> : <p>Kvoten kan fjernes når ingen har plass i den. Flytt eller meld av de påmeldte først.</p>}
        </section>)}

        <section className={sectionClassName}>
            <h3>Ny kvote</h3>
            <Form
                action={configureAction(createEventQuotaAction, { params: { eventId: event.id } })}
                submitText="Legg til kvote"
                refreshOnSuccess
            >
                <FormSection legend="Om kvoten" columns={2}>
                    <QuotaFields takesPayment={event.takesPayment} />
                </FormSection>
                <p className="m-0 font-medium">Hvem kan melde seg på gjennom kvoten (tomt betyr alle)</p>
                <VisibilityMatrixEditor requirements={newRequirements} onChange={setNewRequirements} />
                <input type="hidden" name="visibilityRequirements" value={JSON.stringify(newRequirements)} />
            </Form>
        </section>
    </div>
}

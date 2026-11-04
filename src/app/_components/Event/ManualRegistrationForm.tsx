'use client'
import Form from '@/components/Form/Form'
import UserList from '@/components/User/UserList/UserList'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import UserSelectionProvider, { UserSelectionContext } from '@/contexts/UserSelection'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber, SelectNumberPossibleNULL } from '@/components/UI/Select'
import {
    createEventRegistrationAsAdminAction,
    createGuestEventRegistrationAction,
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useContext, useState } from 'react'
import type { ActionReturn } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventRegistration } from '@/prisma-generated-pn-types'

type Variant = { id: number, name: string, quotas: { id: number, name: string }[] }
type Placement = { variantId: number, quotaId: number | undefined }

/** Which variant, and which of its quotas, the administrator puts the registration in. */
function usePlacement(variants: Variant[]) {
    const [variantId, setVariantId] = useState(variants[0]?.id)
    const [quotaId, setQuotaId] = useState<number | 'NULL'>('NULL')
    const variant = variants.find(candidate => candidate.id === variantId) ?? variants[0]
    const placement: Placement = { variantId: variant.id, quotaId: quotaId === 'NULL' ? undefined : quotaId }

    const picker = <>
        {variants.length > 1 && <SelectNumber
            label="Variant"
            name="variantId"
            options={variants.map(candidate => ({ value: candidate.id, label: candidate.name }))}
            value={variant.id}
            onChange={value => {
                setVariantId(value)
                setQuotaId('NULL')
            }}
        />}
        {variant.quotas.length > 1 && <SelectNumberPossibleNULL
            label="Kvote"
            name="quotaId"
            options={[
                { value: 'NULL', label: 'Første kvote med ledig plass' },
                ...variant.quotas.map(quota => ({ value: quota.id, label: quota.name })),
            ]}
            value={quotaId}
            onChange={setQuotaId}
        />}
    </>
    return { placement, picker }
}

function ManualRegistrationFormInner({ eventId, variants }: { eventId: number, variants: Variant[] }) {
    const userSelectionContext = useContext(UserSelectionContext)
    if (!userSelectionContext) throw new Error('Fant ikke UserSelectionContext')
    const { placement, picker } = usePlacement(variants)

    const action = async (): Promise<ActionReturn<EventRegistration>> => {
        if (!userSelectionContext.user) {
            return {
                success: false,
                errorCode: 'BAD PARAMETERS',
                httpCode: 400,
                error: [{
                    message: 'Ingen bruker er valgt'
                }]
            }
        }

        return await createEventRegistrationAsAdminAction({
            params: { eventId, userId: userSelectionContext.user.id, ...placement },
        })
    }

    return <Form
        submitText="Registrer valgt bruker som arrangør"
        title="Registrer bruker manuelt"
        action={action}
    >
        {picker}
    </Form>
}

function GuestRegistrationForm({ eventId, variants }: { eventId: number, variants: Variant[] }) {
    const { placement, picker } = usePlacement(variants)

    return <Form
        submitText="Registrer gjest"
        title="Registrer gjest uten bruker"
        action={configureAction(createGuestEventRegistrationAction, { params: { eventId, ...placement } })}
    >
        <TextInput name="name" label="Navn" />
        <TextInput name="note" label="Notat" />
        {picker}
    </Form>
}

export default function ManualRegistrationForm({
    eventId,
    variants,
    capabilities,
}: {
    eventId: number,
    variants: Variant[],
    capabilities: CapabilitiesJsObject<'canRegisterAsAdmin' | 'canRegisterGuest'>,
}) {
    if (variants.length === 0) return null

    return <div className="min-w-[70vw]">
        {capabilities.canRegisterGuest.authorized && <GuestRegistrationForm eventId={eventId} variants={variants} />}
        {capabilities.canRegisterAsAdmin.authorized && <UserPagingProvider
            serverRenderedData={[]}
            startPage={{
                pageSize: 50,
                page: 0,
            }}
            details={{
                groups: [],
                partOfName: ''
            }}
        >
            <UserSelectionProvider>
                <ManualRegistrationFormInner eventId={eventId} variants={variants} />
                <UserList />
            </UserSelectionProvider>
        </UserPagingProvider>}
    </div>
}

'use client'
import Form from '@/components/Form/Form'
import UserList from '@/components/User/UserList/UserList'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import UserSelectionProvider, { UserSelectionContext } from '@/contexts/UserSelection'
import TextInput from '@/components/UI/TextInput'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import {
    createEventRegistrationAsAdminAction,
    createGuestEventRegistrationAction,
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useContext, useState } from 'react'
import type { ActionReturn } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventRegistration } from '@/prisma-generated-pn-types'

type Quota = { id: number, name: string }

/** Which quota the administrator puts the registration in. 'NULL' leaves it to the first with a place. */
function QuotaPicker({ quotas, value, onChange }: {
    quotas: Quota[],
    value: number | 'NULL',
    onChange: (value: number | 'NULL') => void,
}) {
    if (quotas.length < 2) return null
    return <SelectNumberPossibleNULL
        label="Kvote"
        name="quotaId"
        options={[
            { value: 'NULL', label: 'Første kvote med ledig plass' },
            ...quotas.map(quota => ({ value: quota.id, label: quota.name })),
        ]}
        value={value}
        onChange={onChange}
    />
}

function ManualRegistrationFormInner({
    eventId,
    quotas,
}: {
    eventId: number,
    quotas: Quota[],
}) {
    const userSelectionContext = useContext(UserSelectionContext)
    if (!userSelectionContext) throw new Error('Fant ikke UserSelectionContext')
    const [quotaId, setQuotaId] = useState<number | 'NULL'>('NULL')

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

        return await createEventRegistrationAsAdminAction(
            {
                params: {
                    eventId,
                    userId: userSelectionContext.user.id,
                    quotaId: quotaId === 'NULL' ? undefined : quotaId,
                }
            }
        )
    }

    return <Form
        submitText="Registrer valgt bruker som arrangør"
        title="Registrer bruker manuelt"
        action={action}
    >
        <QuotaPicker quotas={quotas} value={quotaId} onChange={setQuotaId} />
    </Form>
}

function GuestRegistrationForm({ eventId, quotas }: { eventId: number, quotas: Quota[] }) {
    const [quotaId, setQuotaId] = useState<number | 'NULL'>('NULL')

    return <Form
        submitText="Registrer gjest"
        title="Registrer gjest uten bruker"
        action={configureAction(createGuestEventRegistrationAction, {
            params: { eventId, quotaId: quotaId === 'NULL' ? undefined : quotaId },
        })}
    >
        <TextInput name="name" label="Navn" />
        <TextInput name="note" label="Notat" />
        <QuotaPicker quotas={quotas} value={quotaId} onChange={setQuotaId} />
    </Form>
}

export default function ManualRegistrationForm({
    eventId,
    quotas,
    capabilities,
}: {
    eventId: number,
    /** The quotas of the event in fill order. */
    quotas: Quota[],
    capabilities: CapabilitiesJsObject<'canRegisterAsAdmin' | 'canRegisterGuest'>,
}) {
    return <div className="min-w-[70vw]">
        {capabilities.canRegisterGuest.authorized && <GuestRegistrationForm eventId={eventId} quotas={quotas} />}
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
                <ManualRegistrationFormInner eventId={eventId} quotas={quotas} />
                <UserList />
            </UserSelectionProvider>
        </UserPagingProvider>}
    </div>
}

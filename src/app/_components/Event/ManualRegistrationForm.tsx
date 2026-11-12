'use client'
import Form from '@/components/Form/Form'
import HorizontalSelector from '@/components/UI/HorizontalSelector'
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
type PropTypes = {
    eventId: number,
    variants: Variant[],
    capabilities: CapabilitiesJsObject<'canRegisterAsAdmin' | 'canRegisterGuest'>,
}

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

function MemberRegistrationForm({ eventId, placement }: { eventId: number, placement: Placement }) {
    const userSelectionContext = useContext(UserSelectionContext)
    if (!userSelectionContext) throw new Error('Fant ikke UserSelectionContext')
    const { user, setUser } = userSelectionContext

    const action = async (): Promise<ActionReturn<EventRegistration>> => {
        if (!user) {
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
            params: { eventId, userId: user.id, ...placement },
        })
    }

    return <Form
        submitText={user ? `Meld på ${user.firstname} ${user.lastname}` : 'Velg en bruker'}
        action={action}
        disabled={!user}
        refreshOnSuccess
        successCallback={() => setUser(null)}
        className="sticky -bottom-1 z-2 pt-3 pb-1 bg-base-100"
        buttonClassName="w-full!"
    />
}

function GuestRegistrationForm({ eventId, placement }: { eventId: number, placement: Placement }) {
    return <Form
        submitText="Meld på gjesten"
        action={configureAction(createGuestEventRegistrationAction, { params: { eventId, ...placement } })}
        refreshOnSuccess
    >
        <TextInput name="name" label="Navn" />
        <TextInput name="note" label="Notat" />
    </Form>
}

/** The one chosen where both may be registered, and otherwise the one that may. */
function whoToRegister(choice: 'member' | 'guest', canRegisterMembers: boolean, canRegisterGuests: boolean) {
    if (canRegisterMembers && canRegisterGuests) return choice
    return canRegisterMembers ? 'member' : 'guest'
}

function RegisterOthers({ eventId, variants, capabilities }: PropTypes) {
    const { placement, picker } = usePlacement(variants)
    const canRegisterMembers = capabilities.canRegisterAsAdmin.authorized
    const canRegisterGuests = capabilities.canRegisterGuest.authorized
    const [choice, setChoice] = useState<'member' | 'guest'>('member')
    const who = whoToRegister(choice, canRegisterMembers, canRegisterGuests)

    return <div className="flex flex-col gap-3">
        {canRegisterMembers && canRegisterGuests && <HorizontalSelector
            name="registerWho"
            value={who}
            onChange={setChoice}
            options={[
                { value: 'member', label: 'Medlem' },
                { value: 'guest', label: 'Gjest uten bruker' },
            ]}
            className="self-start"
        />}
        <div className="
            grid grid-cols-2 gap-x-4
            max-mobile:grid-cols-1
        ">
            {picker}
        </div>
        {who === 'guest' && <GuestRegistrationForm eventId={eventId} placement={placement} />}
        {who === 'member' && <UserPagingProvider
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
                <UserList disableFilters={{
                    COMMITTEE: true,
                    CLASS: true,
                    STUDY_PROGRAMME: true,
                    OMEGA_MEMBERSHIP_GROUP: true,
                }} />
                <MemberRegistrationForm eventId={eventId} placement={placement} />
            </UserSelectionProvider>
        </UserPagingProvider>}
    </div>
}

export default function ManualRegistrationForm(props: PropTypes) {
    if (props.variants.length === 0) return null
    return <RegisterOthers {...props} />
}

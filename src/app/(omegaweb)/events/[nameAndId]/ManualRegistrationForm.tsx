'use client'
import styles from './ManualRegistrationForm.module.scss'
import Form from '@/components/Form/Form'
import UserList from '@/components/User/UserList/UserList'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import UserSelectionProvider, { UserSelectionContext } from '@/contexts/UserSelection'
import TextInput from '@/components/UI/TextInput'
import {
    createEventRegistrationAsAdminAction,
    createGuestEventRegistrationAction,
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useContext } from 'react'
import type { EventRegistrationWithWaitingList } from '@/services/events/registration/types'
import type { ActionReturn } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

function ManualRegistrationFormInner({
    eventId,
}: {
    eventId: number,
}) {
    const userSelectionContext = useContext(UserSelectionContext)
    if (!userSelectionContext) throw new Error('Fant ikke UserSelectionContext')

    const action = async (): Promise<ActionReturn<EventRegistrationWithWaitingList>> => {
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
                }
            }
        )
    }

    return <Form
        submitText="Registrer valgt bruker som arrangør"
        title="Registrer bruker manuelt"
        action={action}
    >
    </Form>
}

export default function ManualRegistrationForm({
    eventId,
    capabilities,
}: {
    eventId: number,
    capabilities: CapabilitiesJsObject<'canRegisterAsAdmin' | 'canRegisterGuest'>,
}) {
    return <div className={styles.ManualRegistrationForm}>
        {capabilities.canRegisterGuest.authorized && <Form
            submitText="Registrer gjest"
            title="Registrer gjest uten bruker"
            action={configureAction(createGuestEventRegistrationAction, { params: { eventId } })}
        >
            <TextInput name="name" label="Navn" />
            <TextInput name="note" label="Notat" />
        </Form>}
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
                <ManualRegistrationFormInner eventId={eventId} />
                <UserList />
            </UserSelectionProvider>
        </UserPagingProvider>}
    </div>
}

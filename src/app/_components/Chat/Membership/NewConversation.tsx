'use client'
import { chatAction } from './chatAction'
import useChatUsersToPick from './useChatUsersToPick'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import PickUsersPopUp from '@/components/User/UserList/PickUsersPopUp'
import useAuthorizer from '@/hooks/useAuthorizer'
import { MAX_INVITED_AT_ONCE, startGroup } from '@/lib/chatSession/membership'
import { createActionError } from '@/services/actionError'
import { chatUserAuth } from '@/services/chat/users/auth'
import { useState } from 'react'
import type { AppHref } from '@/lib/sites/href'
import type { ActionReturn } from '@/services/actionTypes'
import type { UserBasic } from '@/services/users/types'
import type { MatrixClient } from 'matrix-js-sdk'

/**
 * Where a conversation is started: the user picks whom it is with. One person and no name is the
 * direct message with them, which has a page of its own and is made by its first message. Anything
 * else is a group, which is made here and has a name. It is there for whoever may read those to
 * pick from.
 */
export default function NewConversation({ client }: { client: MatrixClient }) {
    const { readPage, matrixIdOf } = useChatUsersToPick()
    const canPick = useAuthorizer({ authorizer: chatUserAuth.readPage }).authorized

    if (!canPick) return null
    return (
        <PickUsersPopUp popUpKey="new chat conversation" buttonText="Ny samtale" readPage={readPage}>
            {picked => <StartWith client={client} picked={picked} matrixIdOf={matrixIdOf} />}
        </PickUsersPopUp>
    )
}

function StartWith({ client, picked, matrixIdOf }: {
    client: MatrixClient,
    picked: UserBasic[],
    matrixIdOf: (user: UserBasic) => string | undefined,
}) {
    const [name, setName] = useState('')
    const groupName = name.trim()
    const isDirect = picked.length === 1 && groupName === ''

    const start = async (): Promise<ActionReturn<AppHref>> => {
        if (isDirect) return { success: true, data: chatLinks.directMessage(picked[0]) }
        if (!groupName) return createActionError('BAD DATA', [{ path: ['name'], message: 'En gruppe må ha et navn' }])
        return chatAction(async () => {
            const group = await startGroup(client, groupName, picked.flatMap(user => matrixIdOf(user) ?? []))
            return chatLinks.room({ id: group.roomId })
        })()
    }

    if (picked.length === 0) return <p className="m-0 text-base-content/80">Velg hvem du vil skrive til.</p>
    if (picked.length > MAX_INVITED_AT_ONCE) {
        return <p className="m-0" role="alert">Du kan invitere høyst {MAX_INVITED_AT_ONCE} om gangen.</p>
    }
    return (
        <Form
            submitText={isDirect ? `Skriv til ${picked[0].firstname}` : 'Lag gruppe'}
            action={start}
            navigateOnSuccess={href => href}
        >
            <p className="m-0 text-base-content/80">
                Én person uten navn er en direktemelding. Flere personer, eller et navn, er en gruppe.
            </p>
            <TextInput
                name="name"
                label="Navn på gruppen"
                maxLength={60}
                value={name}
                onChange={event => setName(event.target.value)}
            />
        </Form>
    )
}

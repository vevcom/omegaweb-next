'use client'

import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { createMailingListExternalRelationAction } from '@/services/mail/actions'
import {
    updateMailAddressExternalAction,
    destroyMailAddressExternalAction
} from '@/services/mail/mailAddressExternal/actions'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { mailAuth } from '@/services/mail/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRouter } from 'next/navigation'
import type { MailingList } from '@/prisma-generated-pn-types'
import type { MailFlowObject } from '@/services/mail/types'

export default function EditMailAddressExternal({
    id,
    data,
    mailingLists,
}: {
    id: number,
    data: MailFlowObject,
    mailingLists: MailingList[],
}) {
    const { push, refresh } = useRouter()

    const focusedExternal = data.mailaddressExternal.find(external => external.id === id)
    if (!focusedExternal) throw new Error('Fant ikke den eksterne adressen')

    const canAdmin = useAuthorizer({
        authorizer: mailAddressExternalAuth.update
    }).authorized
    const canAddRelation = useAuthorizer({
        authorizer: mailAuth.createMailingListExternalRelation
    }).authorized

    const connectedListIds = new Set(data.mailingList.map(list => list.id))
    const availableLists = mailingLists.filter(list => !connectedListIds.has(list.id))

    return <>
        {canAdmin && <Form
            title="Rediger ekstern adresse"
            submitText="Oppdater"
            action={updateMailAddressExternalAction}
        >
            <input type="hidden" name="id" value={focusedExternal.id} />
            <TextInput name="address" label="Adresse" defaultValue={focusedExternal.address} />
            <TextInput name="description" label="Beskrivelse" defaultValue={focusedExternal.description ?? ''} />
        </Form>}

        {canAddRelation && availableLists.length > 0 && <Form
            title="Sett på e-postliste"
            submitText="Legg til"
            action={createMailingListExternalRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="mailAddressExternalId" value={focusedExternal.id} />
            <SelectNumber
                options={availableLists.map(list => ({ value: list.id, label: list.name }))}
                name="mailingListId"
                label="E-postliste"
            />
        </Form>}

        {canAdmin && <Form
            action={configureAction(destroyMailAddressExternalAction, { params: { id: focusedExternal.id } })}
            successCallback={() => push('/admin/mail/mailaddressExternal')}
            submitText="Slett adressen"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: 'Sikker på at du vil slette denne eksterne adressen? Dette kan ikke angres.',
            }}
        />}
    </>
}

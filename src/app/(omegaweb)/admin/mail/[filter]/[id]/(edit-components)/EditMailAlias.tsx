'use client'

import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { createAliasMailingListRelationAction } from '@/services/mail/actions'
import { updateMailAliasAction, destroyMailAliasAction } from '@/services/mail/alias/actions'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailAuth } from '@/services/mail/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRouter } from 'next/navigation'
import type { MailingList } from '@/prisma-generated-pn-types'
import type { MailFlowObject } from '@/services/mail/types'

export default function EditMailAlias({
    id,
    data,
    mailingLists,
}: {
    id: number,
    data: MailFlowObject,
    mailingLists: MailingList[],
}) {
    const { push, refresh } = useRouter()

    const focusedAlias = data.alias.find(alias => alias.id === id)
    if (!focusedAlias) throw new Error('Fant ikke e-postaliaset')

    const canUpdateAlias = useAuthorizer({ authorizer: mailAliasAuth.update }).authorized
    const canDestroyAlias = useAuthorizer({ authorizer: mailAliasAuth.destroy }).authorized
    const canAddRelation = useAuthorizer({
        authorizer: mailAuth.createAliasMailingListRelation
    }).authorized

    const connectedListIds = new Set(data.mailingList.map(list => list.id))
    const availableLists = mailingLists.filter(list => !connectedListIds.has(list.id))

    return <>
        {canUpdateAlias && <Form
            title="Rediger alias"
            submitText="Oppdater"
            action={configureAction(updateMailAliasAction, { params: { id: focusedAlias.id } })}
        >
            <TextInput name="address" label="Adresse" defaultValue={focusedAlias.address} />
            <TextInput name="description" label="Beskrivelse" defaultValue={focusedAlias.description} />
        </Form>}

        {canAddRelation && availableLists.length > 0 && <Form
            title="Koble til e-postliste"
            submitText="Legg til"
            action={createAliasMailingListRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="mailAliasId" value={focusedAlias.id} />
            <SelectNumber
                options={availableLists.map(list => ({ value: list.id, label: list.name }))}
                name="mailingListId"
                label="E-postliste"
            />
        </Form>}

        {canDestroyAlias && <Form
            action={configureAction(destroyMailAliasAction, { params: { id: focusedAlias.id } })}
            successCallback={() => push('/admin/mail/alias')}
            submitText="Slett aliaset"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: 'Er du sikker på at du vil slette dette aliaset? Dette kan ikke angres.',
            }}
        />}
    </>
}

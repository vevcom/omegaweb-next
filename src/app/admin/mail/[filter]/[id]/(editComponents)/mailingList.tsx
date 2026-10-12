'use client'

import AddUserToMailingList from './AddUserToMailingList'
import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import {
    createAliasMailingListRelationAction,
    createMailingListExternalRelationAction,
    createMailingListGroupRelationAction,
} from '@/services/mail/actions'
import { updateMailingListAction, destroyMailingListAction } from '@/services/mail/list/actions'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAuth } from '@/services/mail/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRouter } from 'next/navigation'
import type { MailAddressExternal, MailAlias } from '@/prisma-generated-pn-types'
import type { ExpandedGroup } from '@/services/groups/types'
import type { MailFlowObject } from '@/services/mail/types'

export default function EditMailingList({
    id,
    data,
    mailaliases,
    mailAddressExternal,
    groups,
}: {
    id: number,
    data: MailFlowObject,
    mailaliases: MailAlias[],
    mailAddressExternal: MailAddressExternal[],
    groups: ExpandedGroup[],
}) {
    const { push, refresh } = useRouter()

    const focusedMailingList = data.mailingList.find(list => list.id === id)
    if (!focusedMailingList) throw new Error('Fant ikke e-postlisten')

    const canAdmin = useAuthorizer({ authorizer: mailingListAuth.update }).authorized
    const canAddRelation = useAuthorizer({
        authorizer: mailAuth.createAliasMailingListRelation
    }).authorized

    // Only offer what is not already connected - the flow graphic is where existing
    // connections are shown and removed.
    const connectedAliasIds = new Set(data.alias.map(alias => alias.id))
    const availableAliases = mailaliases.filter(alias => !connectedAliasIds.has(alias.id))
    const connectedGroupIds = new Set(data.group.map(group => group.id))
    const availableGroups = groups.filter(group => !connectedGroupIds.has(group.id))
    const connectedExternalIds = new Set(data.mailaddressExternal.map(external => external.id))
    const availableExternal = mailAddressExternal.filter(external => !connectedExternalIds.has(external.id))

    return <>
        {canAdmin && <Form
            title="Rediger e-postliste"
            submitText="Oppdater"
            action={updateMailingListAction}
        >
            <input type="hidden" name="id" value={focusedMailingList.id} />
            <TextInput name="name" label="Navn" defaultValue={focusedMailingList.name} />
            <TextInput name="description" label="Beskrivelse" defaultValue={focusedMailingList.description} />
        </Form>}

        {canAddRelation && availableAliases.length > 0 && <Form
            title="Koble til alias"
            submitText="Legg til"
            action={createAliasMailingListRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" value={focusedMailingList.id} name="mailingListId" />
            <SelectNumber
                options={availableAliases.map(alias => ({ value: alias.id, label: alias.address }))}
                name="mailAliasId"
                label="E-postalias"
            />
        </Form>}

        {canAddRelation && availableGroups.length > 0 && <Form
            title="Legg til gruppe"
            submitText="Legg til"
            action={createMailingListGroupRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="mailingListId" value={focusedMailingList.id} />
            <SelectNumber
                options={availableGroups.map(group => ({ value: group.id, label: group.name }))}
                name="groupId"
                label="Gruppe"
            />
        </Form>}

        {canAddRelation && availableExternal.length > 0 && <Form
            title="Legg til ekstern adresse"
            submitText="Legg til"
            action={createMailingListExternalRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="mailingListId" value={focusedMailingList.id} />
            <SelectNumber
                options={availableExternal.map(external => ({ value: external.id, label: external.address }))}
                name="mailAddressExternalId"
                label="Ekstern e-postadresse"
            />
        </Form>}

        {canAdmin && <Form
            action={configureAction(destroyMailingListAction, { params: { id: focusedMailingList.id } })}
            successCallback={() => push('/admin/mail/mailingList')}
            submitText="Slett e-postlisten"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: 'Sikker på at du vil slette denne e-postlisten? Dette kan ikke angres.',
            }}
        />}

        {canAddRelation && <AddUserToMailingList mailingListId={focusedMailingList.id} />}
    </>
}

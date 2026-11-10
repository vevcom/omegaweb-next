'use client'
import AddUserToMailingList from './AddUserToMailingList'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import { mailServerLinks } from '@/pageKits/mailServer/links'

import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import {
    createAliasMailingListRelationAction,
    createMailingListExternalRelationAction,
    createMailingListGroupRelationAction,
} from '@/services/mail/actions'
import {
    updateMailingListAction,
    updateMailingListVisibilityAction,
    destroyMailingListAction,
} from '@/services/mail/list/actions'
import { mailingListAuth } from '@/services/mail/list/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailAddressExternal, MailAlias } from '@/prisma-generated-pn-types'
import type { ExpandedGroup } from '@/services/groups/types'
import type { MailFlowObject } from '@/services/mail/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

export default function EditMailingList({
    config,
    id,
    data,
    mailaliases,
    mailAddressExternal,
    groups,
    owners,
}: {
    config: MailServerPagesConfig,
    id: number,
    data: MailFlowObject,
    mailaliases: MailAlias[],
    mailAddressExternal: MailAddressExternal[],
    groups: ExpandedGroup[],
    owners: VisibilityMatrix,
}) {
    const { push, refresh } = useSiteRouter()
    const links = mailServerLinks(config)

    const focusedMailingList = data.mailingList.find(list => list.id === id)
    if (!focusedMailingList) throw new Error('Fant ikke e-postlisten')

    const canUpdateMailingList = useAuthorizer({
        authorizer: mailingListAuth.update.data({ visibility: owners }),
    }).authorized
    const canDestroyMailingList = useAuthorizer({
        authorizer: mailingListAuth.destroy.data({ visibility: owners }),
    }).authorized
    const canUpdateOwners = useAuthorizer({
        authorizer: mailingListAuth.updateVisibility.data({ visibility: owners }),
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
        {canUpdateMailingList && <Form
            title="Rediger e-postliste"
            submitText="Oppdater"
            action={configureAction(updateMailingListAction, { params: { id: focusedMailingList.id } })}
        >
            <TextInput name="name" label="Navn" defaultValue={focusedMailingList.name} />
            <TextInput name="description" label="Beskrivelse" defaultValue={focusedMailingList.description} />
        </Form>}

        {canUpdateOwners && <div className="flex flex-col gap-2">
            <h3 className="m-0">Eiere</h3>
            <VisibilityAdmin
                visibility={owners}
                visibilityId={focusedMailingList.ownerVisibilityId}
                updateVisibilityAction={configureAction(
                    updateMailingListVisibilityAction,
                    { implementationParams: { id: focusedMailingList.id } },
                )}
            />
        </div>}

        {availableAliases.length > 0 && <Form
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

        {availableGroups.length > 0 && <Form
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

        {availableExternal.length > 0 && <Form
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

        {canDestroyMailingList && <Form
            action={configureAction(destroyMailingListAction, { params: { id: focusedMailingList.id } })}
            successCallback={() => push(links.part('mailingList'))}
            submitText="Slett e-postlisten"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: 'Er du sikker på at du vil slette denne e-postlisten? Dette kan ikke angres.',
            }}
        />}

        <AddUserToMailingList mailingListId={focusedMailingList.id} />
    </>
}

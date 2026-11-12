'use client'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import { mailServerLinks } from '@/pageKits/mailServer/links'

import MailAddressForm from '@/components/Mail/MailAddressForm'
import MailForwardingForm from '@/components/Mail/MailForwardingForm'
import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { createAliasMailingListRelationAction } from '@/services/mail/actions'
import {
    updateMailAliasAddressAction,
    updateMailAliasAddressForwardingAction,
    updateMailAliasDescriptionAction,
    updateMailAliasVisibilityAction,
    destroyMailAliasAction,
} from '@/services/mail/alias/actions'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailAddress, MailingList } from '@/prisma-generated-pn-types'
import type { MailFlowObject } from '@/services/mail/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

export default function EditMailAlias({
    config,
    id,
    data,
    mailAddress,
    mailingLists,
    domains,
    owners,
    mailboxes,
}: {
    config: MailServerPagesConfig,
    id: number,
    data: MailFlowObject,
    /** The row of the alias's address, which says whether its mail is forwarded. */
    mailAddress: MailAddress,
    mailingLists: MailingList[],
    /** The domains an alias may be on. */
    domains: string[],
    owners: VisibilityMatrix,
    /** Whether this installation keeps a mailbox per alias, see lib/mailServerSync/constants.ts. */
    mailboxes: boolean,
}) {
    const { push, refresh } = useSiteRouter()
    const links = mailServerLinks(config)

    const focusedAlias = data.alias.find(alias => alias.id === id)
    if (!focusedAlias) throw new Error('Fant ikke e-postaliaset')
    const canUpdateAddress = useAuthorizer({
        authorizer: mailAliasAuth.updateMailAddress.data({ visibility: owners }),
    }).authorized
    const canUpdateDescription = useAuthorizer({
        authorizer: mailAliasAuth.updateDescription.data({ visibility: owners }),
    }).authorized
    const canUpdateForwarding = useAuthorizer({
        authorizer: mailAliasAuth.updateMailAddressForwarding.data({ visibility: owners }),
    }).authorized
    const canDestroyAlias = useAuthorizer({ authorizer: mailAliasAuth.destroy.data({ visibility: owners }) }).authorized
    const canUpdateOwners = useAuthorizer({
        authorizer: mailAliasAuth.updateVisibility.data({ visibility: owners }),
    }).authorized

    const connectedListIds = new Set(data.mailingList.map(list => list.id))
    const availableLists = mailingLists.filter(list => !connectedListIds.has(list.id))

    return <>
        {canUpdateAddress && <MailAddressForm
            action={configureAction(
                configureAction(updateMailAliasAddressAction, { implementationParams: { id: focusedAlias.id } }),
                { params: { mailAddressId: mailAddress.id } },
            )}
            address={focusedAlias.address}
            domains={domains}
        />}

        {canUpdateDescription && <Form
            title="Rediger beskrivelse"
            submitText="Oppdater"
            action={configureAction(updateMailAliasDescriptionAction, { params: { id: focusedAlias.id } })}
        >
            <TextInput name="description" label="Beskrivelse" defaultValue={focusedAlias.description} />
        </Form>}

        {mailboxes && <div className="flex flex-col gap-2">
            <h3 className="m-0">Postkasse</h3>
            <p className="m-0 text-base-content/80">
                Et alias er til korrespondanse. Alle som mottar e-posten til aliaset, gjennom e-postlistene det
                er koblet til, leser den også i en felles postkasse i webmailen, og kan svare og sende e-post
                som aliaset derfra. Informasjon som bare skal ut til mange, sendes som et varsel.
            </p>
            {!canUpdateForwarding && <p className="m-0 text-base-content/80">
                {mailAddress.forwardsToPrivateEmail
                    ? 'E-posten videresendes også til den private e-posten til hver mottaker.'
                    : 'E-posten videresendes ikke, og leses bare i postkassen.'}
            </p>}
        </div>}

        {mailboxes && canUpdateForwarding && <MailForwardingForm
            action={configureAction(
                configureAction(updateMailAliasAddressForwardingAction, { implementationParams: { id: focusedAlias.id } }),
                { params: { mailAddressId: mailAddress.id } },
            )}
            forwardsToPrivateEmail={mailAddress.forwardsToPrivateEmail}
        >
            <p className="m-0 text-base-content/80">
                Med videresending får hver mottaker også en kopi til sin private e-post. Uten leses e-posten
                bare i postkassen.
            </p>
        </MailForwardingForm>}

        {canUpdateOwners && <div className="flex flex-col gap-2">
            <h3 className="m-0">Eiere</h3>
            <VisibilityAdmin
                visibility={owners}
                visibilityId={focusedAlias.ownerVisibilityId}
                updateVisibilityAction={configureAction(
                    updateMailAliasVisibilityAction,
                    { implementationParams: { id: focusedAlias.id } },
                )}
            />
        </div>}

        {availableLists.length > 0 && <Form
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
            successCallback={() => push(links.part('alias'))}
            submitText="Slett aliaset"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: 'Er du sikker på at du vil slette dette aliaset? Dette kan ikke angres.',
            }}
        />}
    </>
}

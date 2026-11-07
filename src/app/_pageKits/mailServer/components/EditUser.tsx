'use client'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { createMailingListUserRelationAction } from '@/services/mail/actions'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailFlowObject } from '@/services/mail/types'
import type { MailingList } from '@/prisma-generated-pn-types'

export default function EditUser({
    id,
    data,
    mailingLists
}: {
    id: number,
    data: MailFlowObject,
    mailingLists: MailingList[]
}) {
    const { refresh } = useSiteRouter()

    const focusedUser = data.user.find(user => user.id === id)
    if (!focusedUser) throw new Error('Fant ikke brukeren')

    // Lists the user is on via a group are still selectable - a direct relation outlives the
    // group membership. Only already-direct relations are left out.
    const directListIds = new Set(data.mailingList.filter(list => list.direct).map(list => list.id))
    const availableLists = mailingLists.filter(list => !directListIds.has(list.id))

    return <>
        {availableLists.length > 0 && <Form
            title="Sett på e-postliste"
            submitText="Legg til"
            action={createMailingListUserRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="userId" value={focusedUser.id} />
            <SelectNumber
                options={availableLists.map(list => ({ value: list.id, label: list.name }))}
                name="mailingListId"
                label="E-postliste"
            />
        </Form>}
    </>
}

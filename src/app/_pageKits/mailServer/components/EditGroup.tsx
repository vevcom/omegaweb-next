'use client'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { createMailingListGroupRelationAction } from '@/services/mail/actions'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailFlowObject } from '@/services/mail/types'
import type { MailingList } from '@/prisma-generated-pn-types'

export default function EditGroup({
    id,
    data,
    mailingLists
}: {
    id: number,
    data: MailFlowObject,
    mailingLists: MailingList[]
}) {
    const { refresh } = useSiteRouter()

    const connectedListIds = new Set(data.mailingList.map(list => list.id))
    const availableLists = mailingLists.filter(list => !connectedListIds.has(list.id))

    return <>
        {availableLists.length > 0 && <Form
            title="Sett på e-postliste"
            submitText="Legg til"
            action={createMailingListGroupRelationAction}
            successCallback={refresh}
        >
            <input type="hidden" name="groupId" value={id} />
            <SelectNumber
                options={availableLists.map(list => ({ value: list.id, label: list.name }))}
                name="mailingListId"
                label="E-postliste"
            />
        </Form>}
    </>
}

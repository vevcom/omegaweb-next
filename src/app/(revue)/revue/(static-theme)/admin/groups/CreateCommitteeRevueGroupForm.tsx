'use client'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { createRevueGroupAction } from '@/services/revue/groups/actions'

type PropTypes = {
    /** The committees that are no revue group yet. */
    committees: { id: number, name: string }[],
    closePopUpOnSuccess: string,
}

/** A committee made a revue group, under a name of the revue's own, in no revue until it is put in one. */
export default function CreateCommitteeRevueGroupForm({ committees, closePopUpOnSuccess }: PropTypes) {
    return (
        <Form
            title="Komité som revygruppe"
            className="min-w-[min(24rem,80vw)]"
            action={configureAction(createRevueGroupAction, { params: {} })}
            submitText="Legg til"
            closePopUpOnSuccess={closePopUpOnSuccess}
            navigateOnSuccess={(revueGroup?: { name: string }) => (revueGroup ? revueAdminLinks.group(revueGroup) : null)}
        >
            <input type="hidden" name="type" value="COMMITTEE" />
            <SelectNumber
                name="committeeId"
                label="Komité"
                options={committees.map(committee => ({
                    value: committee.id,
                    label: committee.name,
                    key: committee.id.toString(),
                }))}
            />
            <TextInput name="name" label="Navn på revysiden" />
        </Form>
    )
}

'use client'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { createRevueGroupAction } from '@/services/revue/groups/actions'

type PropTypes = {
    /** The committees that are no revue group yet, or null for one who may not read the committees. */
    committees: { id: number, name: string }[] | null,
    closePopUpOnSuccess: string,
}

/** A new revue sub group, or a committee made a revue group, each in no revue until it is put in one. */
export default function CreateRevueGroupForms({ committees, closePopUpOnSuccess }: PropTypes) {
    const formProps = {
        className: 'min-w-[min(24rem,80vw)]',
        action: configureAction(createRevueGroupAction, { params: {} }),
        submitText: 'Legg til',
        closePopUpOnSuccess,
        navigateOnSuccess: (revueGroup?: { name: string }) => (revueGroup ? revueAdminLinks.group(revueGroup) : null),
    }

    return <div className="flex flex-col gap-8">
        <Form title="Ny revyundergruppe" {...formProps}>
            <input type="hidden" name="type" value="REVUE_SUB_GROUP" />
            <TextInput name="name" label="Navn" />
        </Form>
        {committees && committees.length > 0 && <Form title="Komité som revygruppe" {...formProps}>
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
        </Form>}
    </div>
}

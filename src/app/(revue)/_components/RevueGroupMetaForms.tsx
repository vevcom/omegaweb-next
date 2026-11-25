'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { destroyRevueGroupAction, updateRevueGroupAction } from '@/services/revue/groups/actions'
import type { AppHref } from '@/lib/sites/href'
import type { RevueGroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    group: { id: number, name: string, type: RevueGroupType },
    closePopUpOnSuccess?: string,
    /** Where to go once the group is renamed, as its name is its address. */
    hrefOfUpdated: (group: { name: string }) => AppHref,
    hrefAfterDestroy: AppHref,
}

/** A revue group's name to change, and the group to delete. */
export default function RevueGroupMetaForms({ group, closePopUpOnSuccess, hrefOfUpdated, hrefAfterDestroy }: PropTypes) {
    const params = { params: { revueGroupId: group.id } }

    return (
        <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
            <Form
                title="Innstillinger"
                action={configureAction(updateRevueGroupAction, params)}
                submitText="Lagre"
                closePopUpOnSuccess={closePopUpOnSuccess}
                navigateOnSuccess={(updated?: { name: string }) => (updated ? hrefOfUpdated(updated) : null)}
            >
                <TextInput name="name" label="Navn" defaultValue={group.name} />
            </Form>
            <Form
                action={configureAction(destroyRevueGroupAction, params)}
                submitText="Slett gruppen"
                submitColor="red"
                closePopUpOnSuccess={closePopUpOnSuccess}
                navigateOnSuccess={hrefAfterDestroy}
                confirmation={{
                    confirm: true,
                    text: group.type === 'REVUE_SUB_GROUP'
                        ? `Vil du slette ${group.name} med alle medlemskapene, også de i andre revyer?`
                        : `Vil du slette ${group.name} fra revysiden? Komiteen og medlemmene dens blir som de er.`,
                }}
            />
        </div>
    )
}

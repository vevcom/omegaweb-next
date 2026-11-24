'use client'
import { revueLinks } from '@/app/(revue)/links'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { destroyRevueGroupAction, updateRevueGroupAction } from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import type { RevueGroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    group: { id: number, name: string, type: RevueGroupType },
    revue: { year: number },
}

export default function RevueGroupSettings({ group, revue }: PropTypes) {
    const editable = useEditMode({ authorizer: revueGroupAuth.update })
    const popUpKey = `RevueGroupSettings${group.id}`
    const params = { params: { revueGroupId: group.id } }
    const updateGroup = configureAction(updateRevueGroupAction, params)

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                p-2 text-base-content/80 bg-transparent border-none cursor-pointer
                hover:text-base-content
            "
            showButtonContent={<FontAwesomeIcon icon={faGear} />}
            ariaLabel={`Innstillinger for ${group.name}`}
        >
            <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                <Form
                    title="Innstillinger"
                    action={updateGroup}
                    submitText="Lagre"
                    closePopUpOnSuccess={popUpKey}
                    navigateOnSuccess={updated => revueLinks.revueGroup(revue, updated)}
                >
                    <TextInput name="name" label="Navn" defaultValue={group.name} />
                </Form>
                <Form
                    action={configureAction(destroyRevueGroupAction, params)}
                    submitText="Slett gruppen"
                    submitColor="red"
                    closePopUpOnSuccess={popUpKey}
                    navigateOnSuccess={revueLinks.revue(revue)}
                    confirmation={{
                        confirm: true,
                        text: group.type === 'REVUE_SUB_GROUP'
                            ? `Vil du slette ${group.name} med alle medlemskapene, også de i andre revyer?`
                            : `Vil du slette ${group.name} fra revysiden? Komiteen og medlemmene dens blir som de er.`,
                    }}
                />
            </div>
        </PopUp>
    )
}

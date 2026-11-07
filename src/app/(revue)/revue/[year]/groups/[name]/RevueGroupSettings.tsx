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

type PropTypes = {
    group: { id: number, name: string },
    revue: { year: number },
}

export default function RevueGroupSettings({ group, revue }: PropTypes) {
    const editable = useEditMode({ authorizer: revueGroupAuth.update })
    const popUpKey = `RevueGroupSettings${group.id}`
    const params = { params: { groupId: group.id } }
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
                    navigateOnSuccess={updated => (updated ? revueLinks.revueGroup(revue, updated) : null)}
                >
                    <TextInput name="name" label="Navn" defaultValue={group.name} />
                </Form>
                <Form
                    action={configureAction(destroyRevueGroupAction, params)}
                    submitText="Slett undergruppe"
                    submitColor="red"
                    closePopUpOnSuccess={popUpKey}
                    navigateOnSuccess={revueLinks.revue(revue)}
                    confirmation={{
                        confirm: true,
                        text: `Vil du slette ${group.name} med alle medlemmene?`,
                    }}
                />
            </div>
        </PopUp>
    )
}
